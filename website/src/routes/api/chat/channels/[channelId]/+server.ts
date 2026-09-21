import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatChannel, chatChannelMember, chatChannelHidden } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
import { uploadGroupImage } from '$lib/server/s3';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const channelId = Number(params.channelId);
	if (isNaN(channelId)) throw error(400, 'Invalid channel ID');

	const [channel] = await db
		.select()
		.from(chatChannel)
		.where(eq(chatChannel.id, channelId))
		.limit(1);
	if (!channel || channel.type !== 'GROUP') throw error(404, 'Group not found');

	if (channel.ownerId !== userId) throw error(403, 'Only the group leader can delete this group');

	// Fetch members to notify before deleting (FKs cascade the rest).
	const members = await db
		.select({ userId: chatChannelMember.userId })
		.from(chatChannelMember)
		.where(eq(chatChannelMember.channelId, channelId));

	await db.delete(chatChannel).where(eq(chatChannel.id, channelId));

	const removedPayload = JSON.stringify({ type: 'chat_channel_removed', channelId });
	for (const m of members) {
		try {
			await redis.publish(`chat:${m.userId}`, removedPayload);
		} catch {}
	}

	return json({ success: true });
};

// Share the auth + channel helpers used by all the actions below.
async function getChannel(channelId: number) {
	const [channel] = await db
		.select()
		.from(chatChannel)
		.where(eq(chatChannel.id, channelId))
		.limit(1);
	if (!channel || channel.type !== 'GROUP') throw error(404, 'Group not found');
	return channel;
}

async function isMember(channelId: number, userId: number) {
	const [row] = await db
		.select({ userId: chatChannelMember.userId })
		.from(chatChannelMember)
		.where(and(eq(chatChannelMember.channelId, channelId), eq(chatChannelMember.userId, userId)))
		.limit(1);
	return !!row;
}

async function memberUserIds(channelId: number): Promise<number[]> {
	const rows = await db
		.select({ userId: chatChannelMember.userId })
		.from(chatChannelMember)
		.where(eq(chatChannelMember.channelId, channelId));
	return rows.map((r) => r.userId);
}

async function broadcastUpdate(channelId: number, memberIds: number[], extra: Record<string, unknown> = {}) {
	const payload = JSON.stringify({ type: 'chat_channel_updated', channelId, ...extra });
	for (const m of memberIds) {
		try {
			await redis.publish(`chat:${m}`, payload);
		} catch {}
	}
}

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const channelId = Number(params.channelId);
	if (isNaN(channelId)) throw error(400, 'Invalid channel ID');

	const contentType = request.headers.get('content-type') || '';

	const channel = await getChannel(channelId);
	if (!(await isMember(channelId, userId))) throw error(404, 'Not a member of this group');

	// ---- Multipart: rename + set group image in one request ----
	if (contentType.includes('multipart/form-data')) {
		const form = await request.formData();
		const nameField = String(form.get('name') || '').trim();
		const imageField = form.get('image');

		const updates: Partial<{ name: string; image: string }> = {};
		let imageUpdated = false;

		if (nameField) {
			if (nameField.length > 60) throw error(400, 'Group name must be 60 characters or less');
			updates.name = nameField;
		}

		if (imageField && !(imageField instanceof File)) {
			throw error(400, 'Invalid image upload');
		}
		if (imageField instanceof File && imageField.size > 0) {
			const arrayBuffer = await imageField.arrayBuffer();
			const key = await uploadGroupImage(channelId, new Uint8Array(arrayBuffer), imageField.type);
			updates.image = key;
			imageUpdated = true;
		}

		if (Object.keys(updates).length === 0) throw error(400, 'Nothing to update');

		await db.update(chatChannel).set(updates).where(eq(chatChannel.id, channelId));
		const memberIds = await memberUserIds(channelId);
		await broadcastUpdate(channelId, memberIds, {
			name: updates.name,
			image: imageUpdated ? updates.image : undefined
		});

		const refreshed = await getChannel(channelId);
		return json({
			success: true,
			channel: {
				...refreshed,
				name: refreshed.name,
				image: refreshed.image
			}
		});
	}

	const body = await request.json().catch(() => ({}));
	const action = body.action;

	if (action === 'transfer') {
		// Leader gives leadership to another member.
		if (channel.ownerId !== userId) throw error(403, 'Only the group leader can transfer leadership');
		const newLeaderId = Number(body.memberId);
		if (!Number.isInteger(newLeaderId)) throw error(400, 'Invalid member');
		if (newLeaderId === userId) throw error(400, 'You are already the leader');
		if (!(await isMember(channelId, newLeaderId))) throw error(404, 'Member not found');

		await db
			.update(chatChannel)
			.set({ ownerId: newLeaderId })
			.where(eq(chatChannel.id, channelId));

		const memberIds = await memberUserIds(channelId);
		await broadcastUpdate(channelId, memberIds, { ownerId: newLeaderId, transferredTo: newLeaderId });
		return json({ success: true, ownerId: newLeaderId });
	}

	if (action === 'rename') {
		const name = String(body.name || '').trim();
		if (!name) throw error(400, 'Group name is required');
		if (name.length > 60) throw error(400, 'Group name must be 60 characters or less');

		await db.update(chatChannel).set({ name }).where(eq(chatChannel.id, channelId));
		const memberIds = await memberUserIds(channelId);
		await broadcastUpdate(channelId, memberIds, { name });
		return json({ success: true, name });
	}

	if (action === 'image') {
		// Set a group image that was uploaded through the dedicated upload route.
		const image = String(body.image || '').trim();
		if (!image.startsWith('groups/')) throw error(400, 'Invalid image');

		await db.update(chatChannel).set({ image }).where(eq(chatChannel.id, channelId));
		const memberIds = await memberUserIds(channelId);
		await broadcastUpdate(channelId, memberIds, { image });
		return json({ success: true, image });
	}

	if (action === 'hide') {
		if (channel.ownerId === userId) {
			throw error(400, 'As the group leader, delete the group to remove it for everyone');
		}
		if (!(await isMember(channelId, userId))) throw error(404, 'Not a member of this group');

		await db
			.insert(chatChannelHidden)
			.values({ channelId, userId })
			.onConflictDoNothing();

		return json({ success: true, action: 'hide' });
	}

	if (action === 'leave') {
		if (channel.ownerId === userId) {
			throw error(400, 'Transfer leadership first, then you can leave');
		}

		await db
			.delete(chatChannelMember)
			.where(and(eq(chatChannelMember.channelId, channelId), eq(chatChannelMember.userId, userId)));
		// Leaving also removes the group from the user's history entirely.
		await db
			.delete(chatChannelHidden)
			.where(and(eq(chatChannelHidden.channelId, channelId), eq(chatChannelHidden.userId, userId)));

		return json({ success: true, action: 'leave' });
	}

	throw error(400, 'Unknown action');
};