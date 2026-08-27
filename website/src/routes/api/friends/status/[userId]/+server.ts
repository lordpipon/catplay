import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { friendship } from '$lib/server/db/schema';
import { eq, or, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);
	const targetId = Number(params.userId);

	if (!targetId) throw error(400, 'Invalid user ID');

	const rows = await db
		.select({
			id: friendship.id,
			requesterId: friendship.requesterId,
			addresseeId: friendship.addresseeId,
			status: friendship.status
		})
		.from(friendship)
		.where(
			or(
				and(eq(friendship.requesterId, userId), eq(friendship.addresseeId, targetId)),
				and(eq(friendship.requesterId, targetId), eq(friendship.addresseeId, userId))
			)
		)
		.limit(1);

	const row = rows[0];
	if (!row) return json({ status: 'none' });

	return json({
		status: row.status,
		// 'outgoing' = I sent it, 'incoming' = they sent it to me
		direction:
			row.requesterId === userId
				? 'outgoing'
				: 'incoming',
		id: row.id
	});
};
