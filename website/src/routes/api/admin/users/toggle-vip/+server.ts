import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, globalSetting } from '$lib/server/db/schema';
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

	const currentlyVip = hasFlag(target.flags, 'IS_VIP');
	const newFlags = currentlyVip
		? target.flags & ~UserFlags.IS_VIP
		: target.flags | UserFlags.IS_VIP;

	await db.transaction(async (tx) => {
		await tx.update(user).set({ flags: newFlags, updatedAt: new Date() }).where(eq(user.id, target.id));

		if (currentlyVip) {
			await tx.delete(globalSetting).where(eq(globalSetting.key, `vip_expires_${target.id}`));
		} else {
			const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
			await tx.insert(globalSetting).values({ key: `vip_expires_${target.id}`, value: expires.toISOString() });
		}
	});

	const action = currentlyVip ? 'revoked' : 'granted';
	await writeAdminLog(Number(authSession.user.id), `VIP ${action} for @${target.username}`);

	return json({ success: true, isVip: !currentlyVip, username: target.username });
};
