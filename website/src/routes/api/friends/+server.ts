import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, friendship } from '$lib/server/db/schema';
import { eq, or, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { createNotification } from '$lib/server/notification';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const rows = await db
		.select({
			id: friendship.id,
			requesterId: friendship.requesterId,
			addresseeId: friendship.addresseeId,
			status: friendship.status,
			createdAt: friendship.createdAt,
			requesterName: user.name,
			requesterUsername: user.username,
			requesterImage: user.image
		})
		.from(friendship)
		.leftJoin(user, eq(user.id, friendship.requesterId))
		.where(or(eq(friendship.requesterId, userId), eq(friendship.addresseeId, userId)));

	return json(rows);
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);
	const { targetUserId, action } = await request.json();
	const targetId = Number(targetUserId);

	if (userId === targetId) throw error(400, 'Cannot be friends with yourself');

	const existing = await db.select().from(friendship).where(
		or(
			and(eq(friendship.requesterId, userId), eq(friendship.addresseeId, targetId)),
			and(eq(friendship.requesterId, targetId), eq(friendship.addresseeId, userId))
		)
	).limit(1);

	if (action === 'send') {
		if (existing.length) {
			if (existing[0].status === 'accepted') throw error(400, 'Already friends');
			if (existing[0].status === 'pending' && existing[0].requesterId === userId)
				throw error(400, 'Request already sent');
		}
		await db.insert(friendship).values({
			requesterId: userId,
			addresseeId: targetId,
			status: 'pending'
		});

		// Notify the recipient
		const [requester] = await db
			.select({ name: user.name, username: user.username })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		try {
			await createNotification(
				targetId.toString(),
				'FRIEND',
				'New friend request',
				`@${requester.username} (${requester.name}) sent you a friend request`,
				'/notifications'
			);
		} catch (e) {
			console.error('Failed to send friend request notification:', e);
		}
		return json({ success: true });
	}

	if (existing.length === 0) throw error(400, 'No request exists');

	if (action === 'accept') {
		// Only the addressee can accept
		if (existing[0].addresseeId !== userId) throw error(403, 'Cannot accept this request');
		await db.update(friendship).set({ status: 'accepted', updatedAt: new Date() })
			.where(eq(friendship.id, existing[0].id));

		// Notify the requester
		const [accepter] = await db
			.select({ name: user.name, username: user.username })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		try {
			await createNotification(
				existing[0].requesterId.toString(),
				'FRIEND',
				'Friend request accepted',
				`@${accepter.username} accepted your friend request! You can now message each other.`,
				'/chat'
			);
		} catch (e) {
			console.error('Failed to send accept notification:', e);
		}
		return json({ success: true });
	}

	if (action === 'decline' || action === 'remove') {
		await db.delete(friendship).where(eq(friendship.id, existing[0].id));
		return json({ success: true });
	}

	return json({ error: 'Invalid action' }, { status: 400 });
};
