import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { globalSetting } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const [mult] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier'));
	const [label] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier_label'));
	const [active] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier_active'));
	const [endsAt] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_event_ends_at'));

	return json({
		multiplier: Number(mult?.value ?? 1),
		label: label?.value ?? 'Normal',
		active: active?.value === 'true',
		endsAt: endsAt?.value ?? ''
	});
};
