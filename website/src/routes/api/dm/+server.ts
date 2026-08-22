import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, directMessage, friendship } from '$lib/server/db/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// GET /api/dm?with=userId — conversation thread
// GET /api/dm — list all conversations
export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);
	const withUser = url.searchParams.get('with');

	if (withUser) {
		const otherId = Number(withUser);
		// Mark as read
		await db.update(directMessage).set({ isRead: true })
			.where(and(eq(directMessage.senderId, otherId), eq(directMessage.recipientId, userId)));

		const messages = await db.select({
			id: directMessage.id,
			senderId: directMessage.senderId,
			recipientId: directMessage.recipientId,
			content: directMessage.content,
			isRead: directMessage.isRead,
			createdAt: directMessage.createdAt,
			senderName: user.name,
			senderUsername: user.username,
			senderImage: user.image
		})
		.from(directMessage)
		.leftJoin(user, eq(user.id, directMessage.senderId))
		.where(or(
			and(eq(directMessage.senderId, userId), eq(directMessage.recipientId, otherId)),
			and(eq(directMessage.senderId, otherId), eq(directMessage.recipientId, userId))
		))
		.orderBy(directMessage.createdAt)
		.limit(100);

		return json(messages);
	}

	// List conversations (last message per conversation partner)
	const conversations = await db.execute(sql`
		SELECT DISTINCT ON (other_user)
			other_user,
			u.name, u.username, u.image,
			dm.content as last_message,
			dm.created_at,
			dm.is_read,
			dm.sender_id
		FROM (
			SELECT
				CASE WHEN sender_id = ${userId} THEN recipient_id ELSE sender_id END as other_user,
				content, created_at, is_read, sender_id, id
			FROM direct_message
			WHERE sender_id = ${userId} OR recipient_id = ${userId}
		) dm
		JOIN "user" u ON u.id = dm.other_user
		ORDER BY other_user, dm.created_at DESC
	`);

	return json(conversations.rows);
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);
	const { recipientId, content } = await request.json();

	if (!content?.trim() || content.trim().length > 1000) return json({ error: 'Invalid message' }, { status: 400 });

	// Must be friends
	const [friendRow] = await db.select().from(friendship).where(
		and(
			or(
				and(eq(friendship.requesterId, userId), eq(friendship.addresseeId, Number(recipientId))),
				and(eq(friendship.requesterId, Number(recipientId)), eq(friendship.addresseeId, userId))
			),
			eq(friendship.status, 'accepted')
		)
	).limit(1);

	if (!friendRow) return json({ error: 'You can only message friends' }, { status: 403 });

	const [msg] = await db.insert(directMessage).values({
		senderId: userId,
		recipientId: Number(recipientId),
		content: content.trim()
	}).returning();

	return json(msg);
};
