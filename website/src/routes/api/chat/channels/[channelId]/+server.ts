import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatChannel, chatChannelMember, chatChannelHidden } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
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

	if (channel.ownerId !== userId) throw error(403, 'Only the group owner can delete this group');

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

// Share the auth + channel helpers used by both POST actions below.
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

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const channelId = Number(params.channelId);
	if (isNaN(channelId)) throw error(400, 'Invalid channel ID');

	const body = await request.json().catch(() => ({}));
	const action = body.action;

	const channel = await getChannel(channelId);

	if (action === 'hide') {
		if (channel.ownerId === userId) {
			throw error(400, 'As the owner, delete the group to remove it for everyone');
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
			throw error(400, 'Owners can only delete the group, not leave it');
		}
		if (!(await isMember(channelId, userId))) throw error(404, 'Not a member of this group');

		await db
			.delete(chatChannelMember)
			.where(and(eq(chatChannelMember.channelId, channelId), eq(chatChannelMember.userId, userId)));
		// Forget any hidden marker so a future re-add shows the group again.
		await db
			.delete(chatChannelHidden)
			.where(and(eq(chatChannelHidden.channelId, channelId), eq(chatChannelHidden.userId, userId)));

		return json({ success: true, action: 'leave' });
	}

	throw error(400, 'Unknown action');
};