import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { changelogEntry } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const entries = await db.select().from(changelogEntry).orderBy(desc(changelogEntry.createdAt)).limit(50);
	return json(entries);
};
