import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { writeAdminLog } from '$lib/server/admin-log';
import { hasFlag, UserFlags } from '$lib/data/flags';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });
	if (!authSession?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(authSession.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
		throw error(403, 'Head admin access required');
	}

	const { username } = await request.json();
	if (!username?.trim()) throw error(400, 'Username is required');

	const [target] = await db
		.select({ id: user.id, username: user.username, flags: user.flags })
		.from(user)
		.where(eq(user.username, username.trim()))
		.limit(1);

	if (!target) throw error(404, 'User not found');

	const isDeveloper = hasFlag(target.flags, 'DEVELOPER_BADGE');
	const newFlags = isDeveloper
		? target.flags & ~UserFlags.DEVELOPER_BADGE
		: target.flags | UserFlags.DEVELOPER_BADGE;

	await db.update(user).set({ flags: newFlags, updatedAt: new Date() }).where(eq(user.id, target.id));

	const action = isDeveloper ? 'revoked' : 'granted';
	await writeAdminLog(
		Number(authSession.user.id),
		'TOGGLE_DEVELOPER',
		target.id,
		`Developer badge ${action} for @${target.username}`
	);

	return json({ success: true, isDeveloper: !isDeveloper, username: target.username });
};