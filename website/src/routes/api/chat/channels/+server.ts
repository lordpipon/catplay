import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, chatChannel, chatChannelMember, friendship } from '$lib/server/db/schema';
import { eq, and, or, inArray, ne, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	// Get user flags to check if admin/head admin
	const [userData] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!userData) throw error(404, 'User not found');

	const isAdmin = hasFlag(userData.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN');
	const isHeadAdmin = hasFlag(userData.flags, 'IS_HEAD_ADMIN');

	// Base query condition for channels: DMs where user is a participant
	const conditions = [
		and(
			eq(chatChannel.type, 'DIRECT'),
			or(eq(chatChannel.user1Id, userId), eq(chatChannel.user2Id, userId))
		)
	];

	// GROUP chats the user is a member of
	const groupRows = await db
		.select({ channelId: chatChannelMember.channelId })
		.from(chatChannelMember)
		.where(eq(chatChannelMember.userId, userId));
	const groupChannelIds = groupRows.map((r) => r.channelId);
	if (groupChannelIds.length > 0) {
		conditions.push(
			and(eq(chatChannel.type, 'GROUP'), inArray(chatChannel.id, groupChannelIds))
		);
	}

	if (isAdmin) conditions.push(eq(chatChannel.type, 'ADMIN_GLOBAL'));
	if (isHeadAdmin) conditions.push(eq(chatChannel.type, 'HEAD_ADMIN'));

	if (isHeadAdmin) {
		// Head Admins can see ALL DIRECT channels!
		conditions.push(eq(chatChannel.type, 'DIRECT'));
	}

	const channels = await db
		.select()
		.from(chatChannel)
		.where(or(...conditions));

	// For DMs, fetch the other user's info to display; for groups, fetch all members
	const memberChannelIds = channels.map((c) => c.id);
	const userIdsToFetch = new Set<number>();
	channels.forEach((c) => {
		if (c.type === 'DIRECT' && c.user1Id !== null && c.user2Id !== null) {
			userIdsToFetch.add(c.user1Id);
			userIdsToFetch.add(c.user2Id);
		}
	});

	// Member maps for GROUP channels (channelId -> array of member users)
	const groupMemberMap = new Map<number, { id: number; username: string; image: string | null }[]>();
	if (groupChannelIds.length > 0) {
		const memberRows = await db
			.select({
				channelId: chatChannelMember.channelId,
				userId: chatChannelMember.userId
			})
			.from(chatChannelMember)
			.where(inArray(chatChannelMember.channelId, memberChannelIds));
		memberRows.forEach((r) => {
			userIdsToFetch.add(r.userId);
			if (!groupMemberMap.has(r.channelId)) groupMemberMap.set(r.channelId, []);
			groupMemberMap.get(r.channelId)!.push({ id: r.userId, username: '', image: null });
		});
	}

	let usersInfo = new Map();
	if (userIdsToFetch.size > 0) {
		const fetchedUsers = await db
			.select({
				id: user.id,
				username: user.username,
				image: user.image
			})
			.from(user)
			.where(inArray(user.id, Array.from(userIdsToFetch)));

		fetchedUsers.forEach((u) => usersInfo.set(u.id, u));
		// Join usernames/images into group member placeholders
		groupMemberMap.forEach((members, chId) => {
			groupMemberMap.set(
				chId,
				members.map((m) => ({
					...m,
					username: usersInfo.get(m.id)?.username ?? 'Unknown User',
					image: usersInfo.get(m.id)?.image ?? null
				}))
			);
		});
	}

	// Fetch or create Global Public Chat (only one can ever exist via unique index)
	let globalChat = (
		await db
			.select()
			.from(chatChannel)
			.where(
				and(
					eq(chatChannel.type, 'DIRECT'),
					isNull(chatChannel.user1Id),
					isNull(chatChannel.user2Id)
				)
			)
			.orderBy(chatChannel.id)
			.limit(1)
	)[0];

	if (!globalChat) {
		// Try to insert, ignoring race-condition duplicates (unique partial index on chat_channel)
		const inserted = await db
			.insert(chatChannel)
			.values({
				type: 'DIRECT',
				user1Id: null,
				user2Id: null
			})
			.onConflictDoNothing()
			.returning();

		globalChat =
			inserted[0] ||
			(
				await db
					.select()
					.from(chatChannel)
					.where(
						and(
							eq(chatChannel.type, 'DIRECT'),
							isNull(chatChannel.user1Id),
							isNull(chatChannel.user2Id)
						)
					)
					.orderBy(chatChannel.id)
					.limit(1)
			)[0];
	}

	// Safety net: remove any stale duplicate global chat rows that predate the unique index
	if (globalChat) {
			await db
				.delete(chatChannel)
				.where(
					and(
						eq(chatChannel.type, 'DIRECT'),
						isNull(chatChannel.user1Id),
						isNull(chatChannel.user2Id),
						ne(chatChannel.id, globalChat.id)
					)
				);
		}

	const processedChannels = channels.map((c) => {
		let name = '';
		let image = null;
		let members: { id: number; username: string; image: string | null }[] | null = null;

		if (c.type === 'DIRECT') {
			if (c.user1Id === null && c.user2Id === null) {
				name = 'Global Chat';
				image = null; // or some icon
			} else {
				// Determine the 'other' user to display, or show both if Head Admin is snooping
				const isParticipant = c.user1Id === userId || c.user2Id === userId;

				if (isParticipant) {
					const otherId = c.user1Id === userId ? c.user2Id : c.user1Id;
					const otherUser = usersInfo.get(otherId);
					name = otherUser ? `@${otherUser.username}` : 'Unknown User';
					image = otherUser ? otherUser.image : null;
				} else {
					// Head Admin snooping
					const u1 = usersInfo.get(c.user1Id);
					const u2 = usersInfo.get(c.user2Id);
					name = `${u1 ? '@' + u1.username : 'Unknown'} & ${u2 ? '@' + u2.username : 'Unknown'}`;
				}
			}
		} else if (c.type === 'GROUP') {
			members = groupMemberMap.get(c.id) ?? [];
			const otherMembers = members.filter((m) => m.id !== userId);
			name = otherMembers.length
				? otherMembers.slice(0, 3).map((m) => m.username).join(', ') +
					(otherMembers.length > 3 ? ` +${otherMembers.length - 3}` : '')
				: 'Group Chat';
		} else if (c.type === 'ADMIN_GLOBAL') {
			name = 'Global Admin Chat';
		} else if (c.type === 'HEAD_ADMIN') {
			name = 'Head Admin Chat';
		}

		return {
			...c,
			name,
			image,
			members,
			kind: 'channel'
		};
	});

	// If globalChat wasn't in `channels` because the user didn't fetch it explicitly in the OR conditions
	// Actually, the OR condition `or(eq(chatChannel.user1Id, userId), ...)` wouldn't fetch it!
	// So we need to prepend it to processedChannels if not already there.
	if (!processedChannels.some((c) => c.id === globalChat.id)) {
		processedChannels.unshift({
			...globalChat,
			name: 'Global Chat',
			image: null
		});
	}

	const channelIds = processedChannels.map((c) => c.id);

	// Last message per channel (preview)
	const lastMessages: Record<number, { content: string; createdAt: string; senderId: number }> = {};
	if (channelIds.length > 0) {
		const rows = await db.execute(sql`
			SELECT DISTINCT ON (channel_id) channel_id, content, created_at, sender_id
			FROM chat_message
			WHERE channel_id IN (${sql.join(channelIds.map((id) => sql`${id}`), sql`, `)})
			ORDER BY channel_id, created_at DESC
		`);
		(rows?.rows ?? []).forEach((r: any) => {
			lastMessages[Number(r.channel_id)] = {
				content: String(r.content ?? ''),
				createdAt: String(r.created_at),
				senderId: Number(r.sender_id)
			};
		});
	}

	// Attach preview + a stable "sortAt" to each channel
	const merged: any[] = processedChannels.map((c) => {
		const last = lastMessages[c.id];
		return {
			...c,
			kind: 'channel',
			lastMessage: last?.content ?? null,
			lastMessageAt: last?.createdAt ?? null,
			sortAt: last?.createdAt ?? c.createdAt
		};
	});

	// Accepted friends — merge as virtual DM entries when there's no existing channel.
	// Merged for everyone (including Head Admins). Dedupe only against DIRECT channels
	// the current user is a participant of — other users' channels (visible to Head
	// Admins) must not suppress their own friends.
	{
		const myId = userId;
		const requester = alias(user, 'requester');
		const addressee = alias(user, 'addressee');
		const friendRows = await db
			.select({
				friendshipId: friendship.id,
				requesterId: friendship.requesterId,
				addresseeId: friendship.addresseeId,
				requesterName: requester.name,
				requesterUsername: requester.username,
				requesterImage: requester.image,
				addresseeName: addressee.name,
				addresseeUsername: addressee.username,
				addresseeImage: addressee.image
			})
			.from(friendship)
			.leftJoin(requester, eq(requester.id, friendship.requesterId))
			.leftJoin(addressee, eq(addressee.id, friendship.addresseeId))
			.where(and(or(eq(friendship.requesterId, myId), eq(friendship.addresseeId, myId)), eq(friendship.status, 'accepted')));

		const existingPartnerIds = new Set<number>(
			merged
				.filter(
					(c) =>
						c.type === 'DIRECT' &&
						c.user1Id !== null &&
						c.user2Id !== null &&
						c.id !== globalChat.id &&
						(Number(c.user1Id) === myId || Number(c.user2Id) === myId)
				)
				.map((c) => (Number(c.user1Id) === myId ? Number(c.user2Id) : Number(c.user1Id)))
		);

		friendRows.forEach((f) => {
			const otherIsRequester = f.requesterId !== myId;
			const partnerId = otherIsRequester ? f.requesterId : f.addresseeId;
			const username = otherIsRequester ? f.requesterUsername : f.addresseeUsername;
			const image = otherIsRequester ? f.requesterImage : f.addresseeImage;

			if (existingPartnerIds.has(partnerId)) return;

			const existing = merged.find(
				(c) =>
					c.type === 'DIRECT' &&
					((Number(c.user1Id) === myId && Number(c.user2Id) === partnerId) ||
						(Number(c.user1Id) === partnerId && Number(c.user2Id) === myId))
			);
			if (existing) return;

			merged.push({
				id: null,
				type: 'DIRECT',
				user1Id: null,
				user2Id: null,
				createdAt: new Date(0).toISOString(),
				name: `@${username}`,
				image,
				kind: 'friend',
				partnerId,
				username,
				lastMessage: null,
				lastMessageAt: null,
				sortAt: new Date(0).toISOString()
			});
		});
	}

	// Head Admins see every DIRECT channel — sort real DMs they participate in
	// first, then snooped ones, so participating channels don't get buried.
	if (isHeadAdmin) {
		merged.sort((a) => (Number(a.user1Id) === userId || Number(a.user2Id) === userId ? -1 : 1));
	}

	return json({ channels: merged });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const body = await request.json();

	const [userData] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (!userData) throw error(404, 'User not found');
	const isHeadAdmin = hasFlag(userData.flags, 'IS_HEAD_ADMIN');

	// ---- Create a group chat ----
	if (body.type === 'group') {
		const memberIds: number[] = body.memberIds;
		if (!Array.isArray(memberIds) || memberIds.length < 2) {
			throw error(400, 'Group chats need at least 2 other members');
		}

		const uniqueIds = Array.from(new Set(memberIds)).filter((m) => m !== userId);
		if (uniqueIds.length < 2) throw error(400, 'Group chats need at least 2 other members');

		if (!isHeadAdmin) {
			// Only friends can be added to a group (not Head Admin)
			const friendRows = await db
				.select({ requesterId: friendship.requesterId, addresseeId: friendship.addresseeId })
				.from(friendship)
				.where(
					and(
						eq(friendship.status, 'accepted'),
						or(
							and(eq(friendship.requesterId, userId), inArray(friendship.addresseeId, uniqueIds)),
							and(inArray(friendship.requesterId, uniqueIds), eq(friendship.addresseeId, userId))
						)
					)
				);

			const validFriendIds = new Set<number>();
			friendRows.forEach((f) => {
				validFriendIds.add(f.requesterId === userId ? f.addresseeId : f.requesterId);
			});
			const invalid = uniqueIds.filter((m) => !validFriendIds.has(m));
			if (invalid.length > 0) throw error(403, 'You can only add friends to a group');
		}

		const allMemberIds = [userId, ...uniqueIds];

		const [newChannel] = await db
			.insert(chatChannel)
			.values({ type: 'GROUP' })
			.returning();

		await db.insert(chatChannelMember).values(
			allMemberIds.map((memberId) => ({ channelId: newChannel.id, userId: memberId }))
		);

		// Build member info for the response
		const memberUsers = await db
			.select({ id: user.id, username: user.username, image: user.image })
			.from(user)
			.where(inArray(user.id, allMemberIds));

		const otherMembers = memberUsers.filter((m) => m.id !== userId);
		const name = otherMembers
			.slice(0, 3)
			.map((m) => m.username)
			.join(', ') + (otherMembers.length > 3 ? ` +${otherMembers.length - 3}` : '');

		return json({
			channel: {
				...newChannel,
				name,
				image: null,
				members: memberUsers,
				kind: 'channel',
				lastMessage: null,
				lastMessageAt: null
			}
		});
	}

	// ---- Create a direct chat ----
	const { targetUserId } = body;

	if (!targetUserId) throw error(400, 'targetUserId is required');

	if (userId === targetUserId) throw error(400, 'Cannot chat with yourself');

	if (!isHeadAdmin) {
		// Check if they are friends (only friends can start a DM, unless Head Admin)
		const isFriends = await db
			.select()
			.from(friendship)
			.where(
				or(
					and(eq(friendship.requesterId, userId), eq(friendship.addresseeId, targetUserId)),
					and(eq(friendship.requesterId, targetUserId), eq(friendship.addresseeId, userId))
				)
			)
			.limit(1);

		if (isFriends.length === 0) throw error(403, 'You can only chat with friends');
	}

	const user1Id = Math.min(userId, targetUserId);
	const user2Id = Math.max(userId, targetUserId);

	// Get or create channel
	let channel = await db
		.select()
		.from(chatChannel)
		.where(
			and(
				eq(chatChannel.type, 'DIRECT'),
				eq(chatChannel.user1Id, user1Id),
				eq(chatChannel.user2Id, user2Id)
			)
		)
		.limit(1);

	if (channel.length === 0) {
		const newChannel = await db
			.insert(chatChannel)
			.values({
				type: 'DIRECT',
				user1Id,
				user2Id
			})
			.returning();
		return json({ channel: newChannel[0] });
	}

	return json({ channel: channel[0] });
};
