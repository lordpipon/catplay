import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, friendship } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const requests = await db
		.select({
			id: friendship.id,
			requesterId: friendship.requesterId,
			requesterName: user.name,
			requesterUsername: user.username,
			requesterImage: user.image,
			createdAt: friendship.createdAt
		})
		.from(friendship)
		.leftJoin(user, eq(user.id, friendship.requesterId))
		.where(and(eq(friendship.addresseeId, userId), eq(friendship.status, 'pending')))
		.orderBy(friendship.createdAt);

	return json({ requests });
};
