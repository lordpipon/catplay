import { db } from '$lib/server/db';
import { globalSetting } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface EventSettings {
	multiplier: number;
	label: string;
	active: boolean;
	endsAt: string;
}

export async function getArcadeMultiplier(): Promise<number> {
	try {
		const [active] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier_active'));
		if (active?.value !== 'true') return 1;

		const [endsAt] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_event_ends_at'));
		if (endsAt?.value && new Date(endsAt.value) < new Date()) return 1;

		const [mult] = await db.select().from(globalSetting).where(eq(globalSetting.key, 'arcade_multiplier'));
		return Number(mult?.value ?? 1);
	} catch {
		return 1;
	}
}
