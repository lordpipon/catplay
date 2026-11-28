import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, session } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { writeAdminLog } from '$lib/server/admin-log';
import type { RequestHandler } from './$types';
import { hasFlag, UserFlags } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });

	if (!authSession?.user) {
		throw error(401, 'Not authenticated');
	}

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(authSession.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN')) {
		throw error(403, 'Admin access required');
	}

	const body = await request.json().catch(() => ({}));
	const username = body.username;
	const reason = body.reason;
	const durationSeconds = Number(body.durationSeconds ?? 0);
	const allowedDurations = new Set([0, 3600, 86400, 604800, 2592000]);

	if (!username?.trim() || !reason?.trim()) {
		throw error(400, 'Username and reason are required');
	}
	if (!allowedDurations.has(durationSeconds)) {
		throw error(400, 'Invalid ban duration');
	}

	try {
		// 2. Fetch the target user's details, including head admin status
		const [targetUser] = await db
			.select({
				id: user.id,
				username: user.username,
				flags: user.flags
			})
			.from(user)
			.where(eq(user.username, username.trim()))
			.limit(1);

		if (!targetUser) {
			throw error(404, 'User not found');
		}

		// 3. New Permissions Logic
		if (hasFlag(targetUser.flags, 'IS_HEAD_ADMIN')) {
			throw error(400, 'Cannot ban head admin users');
		}

		if (hasFlag(targetUser.flags, 'IS_ADMIN') && !hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
			throw error(403, 'Only head admins can ban other admin users');
		}
		if (targetUser.id === Number(authSession.user.id)) {
			throw error(403, "Can't ban yourself");
		}

		await db.transaction(async (tx) => {
			await tx
				.update(user)
				.set({
					isBanned: true,
					banReason: reason.trim(),
					banExpires: durationSeconds > 0 ? new Date(Date.now() + durationSeconds * 1000) : null,
					flags: sql`${targetUser.flags} & ~${UserFlags.IS_ADMIN}`, // <-- Automatically strips admin status on ban
					updatedAt: new Date()
				})
				.where(eq(user.id, targetUser.id));

			await tx.delete(session).where(eq(session.userId, targetUser.id));
		});

		try {
			const { clearUserCache } = await import('$lib/../hooks.server.js');
			clearUserCache(targetUser.id.toString());
		} catch (e) {
			console.warn('Failed to clear user cache:', e);
		}

		const durationLabel = durationSeconds ? `${durationSeconds / 3600}h` : 'permanent';
		writeAdminLog(
			Number(authSession.user.id),
			'BAN',
			targetUser.id,
			`Reason: ${reason.trim()} (${durationLabel})`
		);

		return json({ success: true });
	} catch (e: any) {
		if (e.status) throw e;
		console.error('Failed to ban user:', e);
		throw error(500, 'Internal server error');
	}
};
