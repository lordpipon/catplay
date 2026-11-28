import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { desc, eq, and, not, like, or, isNull, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	if (!session?.user) {
		throw error(401, 'Not authenticated');
	}

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);

	if (!currentUser || !hasFlag(currentUser.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN')) {
		throw error(403, 'Admin access required');
	}

	try {
		const bannedUsers = await db
			.select({
				id: user.id,
				name: user.name,
				username: user.username,
				banReason: user.banReason,
				banExpires: user.banExpires
			})
			.from(user)
			.where(
				and(
					eq(user.isBanned, true),
					or(isNull(user.banExpires), gt(user.banExpires, new Date())),
					not(like(user.banReason, '%Account deletion requested%'))
				)
			)
			.orderBy(desc(user.updatedAt));

		return json(bannedUsers);
	} catch (e) {
		console.error('Failed to fetch banned users:', e);
		throw error(500, 'Internal server error');
	}
};
