import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, friendship } from '$lib/server/db/schema';
import { eq, or, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

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

	if (action === 'send') {
		const existing = await db.select().from(friendship).where(
			or(
				and(eq(friendship.requesterId, userId), eq(friendship.addresseeId, targetId)),
				and(eq(friendship.requesterId, targetId), eq(friendship.addresseeId, userId))
			)
		).limit(1);
		if (existing.length) return json({ error: 'Request already exists' }, { status: 400 });
		await db.insert(friendship).values({ requesterId: userId, addresseeId: targetId, status: 'pending' });
		return json({ success: true });
	}

	if (action === 'accept') {
		await db.update(friendship).set({ status: 'accepted', updatedAt: new Date() })
			.where(and(eq(friendship.requesterId, targetId), eq(friendship.addresseeId, userId)));
		return json({ success: true });
	}

	if (action === 'decline' || action === 'remove') {
		await db.delete(friendship).where(
			or(
				and(eq(friendship.requesterId, userId), eq(friendship.addresseeId, targetId)),
				and(eq(friendship.requesterId, targetId), eq(friendship.addresseeId, userId))
			)
		);
		return json({ success: true });
	}

	return json({ error: 'Invalid action' }, { status: 400 });
};
