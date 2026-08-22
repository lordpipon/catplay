import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, changelogEntry } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { hasFlag } from '$lib/data/flags';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const entries = await db.select().from(changelogEntry).orderBy(desc(changelogEntry.createdAt)).limit(50);
	return json(entries);
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, Number(session.user.id))).limit(1);
	if (!hasFlag(currentUser?.flags, 'IS_HEAD_ADMIN')) throw error(403, 'Head admin only');

	const { title, content, tag } = await request.json();
	if (!title?.trim() || !content?.trim()) return json({ error: 'Title and content required' }, { status: 400 });

	const [entry] = await db.insert(changelogEntry).values({
		title: title.trim(),
		content: content.trim(),
		tag: tag || 'update',
		createdBy: Number(session.user.id)
	}).returning();

	return json(entry);
};

export const DELETE: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, Number(session.user.id))).limit(1);
	if (!hasFlag(currentUser?.flags, 'IS_HEAD_ADMIN')) throw error(403, 'Head admin only');

	const { id } = await request.json();
	await db.delete(changelogEntry).where(eq(changelogEntry.id, id));
	return json({ success: true });
};
