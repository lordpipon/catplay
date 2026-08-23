import { db } from './db';
import { globalSetting } from './db/schema';
import { like, inArray } from 'drizzle-orm';
import { user } from './db/schema';

let cache: { usernames: Set<string>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getActiveVipUsernames(): Promise<Set<string>> {
	if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.usernames;

	const rows = await db
		.select({ key: globalSetting.key, value: globalSetting.value })
		.from(globalSetting)
		.where(like(globalSetting.key, 'vip_expires_%'));

	const now = new Date();
	const userIds: string[] = [];
	for (const row of rows) {
		if (row.value === 'permanent' || new Date(row.value) > now) {
			userIds.push(row.key.replace('vip_expires_', ''));
		}
	}

	let usernames = new Set<string>();
	if (userIds.length > 0) {
		const rows2 = await db
			.select({ username: user.username })
			.from(user)
			.where(inArray(user.id, userIds));
		usernames = new Set(rows2.map((r) => r.username.toLowerCase()));
	}

	cache = { usernames, fetchedAt: Date.now() };
	return usernames;
}
