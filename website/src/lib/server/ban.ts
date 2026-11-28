import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from './db';
import { user } from './db/schema';

type BanLike = {
	isBanned?: boolean | null;
	banExpires?: Date | string | null;
};

/** Timed bans stop being active once their expiry passes. Permanent bans never expire. */
export function isBanActive(value: BanLike | null | undefined, now = new Date()): boolean {
	if (!value?.isBanned) return false;
	if (!value.banExpires) return true;
	return new Date(value.banExpires).getTime() > now.getTime();
}

/** Clear an expired timed ban. Safe to call on every authenticated request. */
export async function clearExpiredBan(userId: number, now = new Date()): Promise<boolean> {
	const rows = await db
		.update(user)
		.set({ isBanned: false, banReason: null, banExpires: null, updatedAt: now })
		.where(
			and(
				eq(user.id, userId),
				eq(user.isBanned, true),
				isNotNull(user.banExpires),
				sql`${user.banExpires} <= ${now}`
			)
		)
		.returning({ id: user.id });
	return rows.length > 0;
}
