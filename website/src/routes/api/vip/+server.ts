import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, globalSetting } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hasFlag, UserFlags } from '$lib/data/flags';
import type { RequestHandler } from './$types';

const VIP_COST = 1000; // gems per month
const VIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ isVip: false, gems: 0, cost: VIP_COST, expiresAt: null });

	const userId = Number(session.user.id);
	const [u] = await db.select({ flags: user.flags, gems: user.gems }).from(user).where(eq(user.id, userId)).limit(1);

	const [expirySetting] = await db.select().from(globalSetting).where(eq(globalSetting.key, `vip_expires_${userId}`));
	const expiresAt = expirySetting?.value ?? null;

	// No expiry record = not VIP (but don't strip admin-granted VIP)
	if (!expiresAt) {
		// Only strip the flag if they're not an admin (admins can be granted VIP manually)
		if (hasFlag(u?.flags, 'IS_VIP') && !hasFlag(u?.flags, 'IS_ADMIN') && !hasFlag(u?.flags, 'IS_HEAD_ADMIN')) {
			const newFlags = BigInt(u.flags ?? 0) & ~UserFlags.IS_VIP;
			await db.update(user).set({ flags: newFlags, updatedAt: new Date() }).where(eq(user.id, userId));
		}
		const stillVip = hasFlag(u?.flags, 'IS_VIP') && (hasFlag(u?.flags, 'IS_ADMIN') || hasFlag(u?.flags, 'IS_HEAD_ADMIN'));
		return json({ isVip: stillVip, gems: u?.gems ?? 0, cost: VIP_COST, expiresAt: stillVip ? 'permanent' : null });
	}

	const isExpired = new Date(expiresAt) < new Date();

	// Auto-revoke if expired
	if (isExpired && hasFlag(u?.flags, 'IS_VIP')) {
		const newFlags = BigInt(u.flags ?? 0) & ~UserFlags.IS_VIP;
		await db.update(user).set({ flags: newFlags, updatedAt: new Date() }).where(eq(user.id, userId));
		await db.delete(globalSetting).where(eq(globalSetting.key, `vip_expires_${userId}`));
		return json({ isVip: false, gems: u?.gems ?? 0, cost: VIP_COST, expiresAt: null });
	}

	return json({
		isVip: !isExpired && hasFlag(u?.flags, 'IS_VIP'),
		gems: u?.gems ?? 0,
		cost: VIP_COST,
		expiresAt: isExpired ? null : expiresAt
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const result = await db.transaction(async (tx) => {
		const [u] = await tx.select({ flags: user.flags, gems: user.gems }).from(user).where(eq(user.id, userId)).for('update').limit(1);

		if ((u.gems ?? 0) < VIP_COST) throw new Error(`Not enough gems. Need ${VIP_COST}, have ${u.gems ?? 0}`);

		// Double-check: re-read gems inside transaction to prevent race conditions
		if (Number(u.gems) < VIP_COST) throw new Error('Insufficient gems');

		// Check if already VIP — extend instead of reject
		const [existingSetting] = await tx.select().from(globalSetting).where(eq(globalSetting.key, `vip_expires_${userId}`));
		const currentExpiry = existingSetting?.value ? new Date(existingSetting.value) : new Date();
		const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
		const newExpiry = new Date(baseDate.getTime() + VIP_DURATION_MS);

		const newFlags = BigInt(u.flags ?? 0) | UserFlags.IS_VIP;
		const newGems = (u.gems ?? 0) - VIP_COST;

		await tx.update(user).set({ flags: newFlags, gems: newGems, updatedAt: new Date() }).where(eq(user.id, userId));

		// Upsert expiry setting
		await tx.insert(globalSetting).values({ key: `vip_expires_${userId}`, value: newExpiry.toISOString(), updatedAt: new Date(), updatedBy: userId })
			.onConflictDoUpdate({ target: globalSetting.key, set: { value: newExpiry.toISOString(), updatedAt: new Date(), updatedBy: userId } });

		return { newGems, isVip: true, expiresAt: newExpiry.toISOString() };
	});

	return json(result);
};
