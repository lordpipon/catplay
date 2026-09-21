import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatChannel, chatChannelMember } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const channelId = Number(params.channelId);
	const memberId = Number(params.memberId);
	if (isNaN(channelId) || isNaN(memberId)) throw error(400, 'Invalid channel or member ID');

	const [channel] = await db
		.select()
		.from(chatChannel)
		.where(eq(chatChannel.id, channelId))
		.limit(1);
	if (!channel || channel.type !== 'GROUP') throw error(404, 'Group not found');

	if (channel.ownerId !== userId) throw error(403, 'Only the group owner can remove members');
	if (memberId === userId) throw error(400, 'You cannot remove yourself');

	const deleted = await db
		.delete(chatChannelMember)
		.where(
			and(
				eq(chatChannelMember.channelId, channelId),
				eq(chatChannelMember.userId, memberId)
			)
		)
		.returning({ channelId: chatChannelMember.channelId });

	if (deleted.length === 0) throw error(404, 'Member not found in this group');

	// Let the removed member's UI drop the channel immediately.
	try {
		await redis.publish(`chat:${memberId}`, JSON.stringify({ type: 'chat_channel_removed', channelId }));
	} catch {}

	return json({ success: true });
};