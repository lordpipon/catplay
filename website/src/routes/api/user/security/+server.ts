import { auth } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
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

	return json({
		hasPassword,
		googleLinked,
		canUnlinkGoogle: googleLinked && (hasPassword || accounts.length > 1)
	});
};
