import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username')?.trim();
	if (!username) throw error(400, 'Username is required');

	const found = await db
		.select({
			id: user.id,
			username: user.username,
			name: user.name,
			image: user.image
		})
		.from(user)
		.where(eq(user.username, username))
		.limit(1);

	if (found.length === 0) throw error(404, 'User not found');

	return json(found[0]);
};
