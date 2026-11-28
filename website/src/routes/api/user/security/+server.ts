import { auth } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account, user } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const userId = Number(session.user.id);
	const accounts = await db
		.select({ providerId: account.providerId, hasPassword: account.password })
		.from(account)
		.where(eq(account.userId, userId));

	const hasPassword = accounts.some((a) => a.providerId === 'credential' && !!a.hasPassword);
	const googleLinked = accounts.some((a) => a.providerId === 'google');

	const [userRecord] = await db
		.select({ twoFactorEnabled: user.twoFactorEnabled })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	return json({
		hasPassword,
		googleLinked,
		twoFactorEnabled: userRecord?.twoFactorEnabled ?? false,
		canUnlinkGoogle: googleLinked && (hasPassword || accounts.length > 1)
	});
};
