import { auth } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const userId = Number(session.user.id);

	const body = await request.json().catch(() => null);
	const newPassword = body?.newPassword;
	if (!newPassword || typeof newPassword !== 'string')
		return json({ error: 'New password is required' }, { status: 400 });
	if (newPassword.length < 8) return json({ error: 'Password must be at least 8 characters' }, { status: 400 });

	const [existing] = await db
		.select({ id: account.id })
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'credential')))
		.limit(1);
	if (existing && existing.id != null) {
		const [cred] = await db
			.select({ hasPw: account.password })
			.from(account)
			.where(eq(account.id, existing.id))
			.limit(1);
		if (cred?.hasPw) return json({ error: 'Password already set' }, { status: 400 });
	}

	const ctx = await auth.$context;
	const passwordHash = await ctx.password.hash(newPassword);

	if (existing) {
		await db.update(account).set({ password: passwordHash }).where(eq(account.id, existing.id));
	} else {
		await ctx.internalAdapter.linkAccount({
			userId: session.user.id,
			providerId: 'credential',
			accountId: session.user.id,
			password: passwordHash
		});
	}

	return json({ success: true });
};
