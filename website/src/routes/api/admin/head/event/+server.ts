import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, globalSetting } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { hasFlag } from '$lib/data/flags';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const settings = await db.select().from(globalSetting).where(
		eq(globalSetting.key, 'arcade_multiplier')
	);
	const multiplier = settings[0]?.value ?? '1';
	const label = (await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier_label')))[0]?.value ?? 'Normal';
	const active = (await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier_active')))[0]?.value === 'true';
	const endsAt = (await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_event_ends_at')))[0]?.value ?? '';
	return json({ multiplier: Number(multiplier), label, active, endsAt });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, Number(session.user.id))).limit(1);
	if (!hasFlag(currentUser?.flags, 'IS_HEAD_ADMIN')) throw error(403, 'Head admin only');

	const { multiplier, label, active, endsAt } = await request.json();

	if (typeof multiplier !== 'number' || multiplier < 1 || multiplier > 100) {
		return json({ error: 'Multiplier must be between 1 and 100' }, { status: 400 });
	}

	const userId = Number(session.user.id);
	const now = new Date();

	await db.insert(globalSetting).values({ key: 'arcade_multiplier', value: String(multiplier), updatedAt: now, updatedBy: userId })
		.onConflictDoUpdate({ target: globalSetting.key, set: { value: String(multiplier), updatedAt: now, updatedBy: userId } });
	await db.insert(globalSetting).values({ key: 'arcade_multiplier_label', value: label || 'Event', updatedAt: now, updatedBy: userId })
		.onConflictDoUpdate({ target: globalSetting.key, set: { value: label || 'Event', updatedAt: now, updatedBy: userId } });
	await db.insert(globalSetting).values({ key: 'arcade_multiplier_active', value: active ? 'true' : 'false', updatedAt: now, updatedBy: userId })
		.onConflictDoUpdate({ target: globalSetting.key, set: { value: active ? 'true' : 'false', updatedAt: now, updatedBy: userId } });
	await db.insert(globalSetting).values({ key: 'arcade_event_ends_at', value: endsAt || '', updatedAt: now, updatedBy: userId })
		.onConflictDoUpdate({ target: globalSetting.key, set: { value: endsAt || '', updatedAt: now, updatedBy: userId } });

	return json({ success: true });
};
