import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redis } from '$lib/server/redis';

export type ChickenDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface ChickenSession {
	sessionToken: string;
	betAmount: number;
	difficulty: ChickenDifficulty;
	laneCars: boolean[];
	currentLane: number;
	currentMultiplier: number;
	status: 'active' | 'won' | 'lost';
	startTime: number;
	lastActivity: number;
	userId: number;
	version: number;
}

export const chk_config: Record<ChickenDifficulty, { lanes: number; survival: number }> = {
	easy: { lanes: 24, survival: 0.97 },
	medium: { lanes: 18, survival: 0.9 },
	hard: { lanes: 14, survival: 0.8 },
	extreme: { lanes: 10, survival: 0.66 }
};

export function chk_multiplier(steps: number, difficulty: ChickenDifficulty): number {
	const s = chk_config[difficulty].survival;
	return Math.floor(0.99 * Math.pow(1 / s, steps) * 100) / 100;
}

const chk_prefix = 'chicken:session:';
export const getSessionKey = (token: string) => `${chk_prefix}${token}`;

export async function chickenCleanupInactiveGames() {
	const now = Date.now();
	const keys: string[] = [];
	let cursor = '0';
	do {
		const scanResult = await redis.scan(cursor, { MATCH: `${chk_prefix}*` });
		cursor = scanResult.cursor;
		keys.push(...scanResult.keys);
	} while (cursor !== '0');

	for (const key of keys) {
		const sessionRaw = await redis.get(key);
		if (!sessionRaw) continue;
		const game = JSON.parse(sessionRaw) as ChickenSession;

		if (now - game.lastActivity > 5 * 60 * 1000) {
			if (game.currentLane === 0 && game.status === 'active') {
				try {
					const deleted = await redis.del(getSessionKey(game.sessionToken));
					if (!deleted) continue;

					const [userData] = await db
						.select({ baseCurrencyBalance: user.baseCurrencyBalance })
						.from(user)
						.where(eq(user.id, game.userId))
						.for('update')
						.limit(1);

					if (!userData) continue;

					const newBal =
						Math.round((Number(userData.baseCurrencyBalance) + game.betAmount) * 100000000) /
						100000000;

					await db
						.update(user)
						.set({ baseCurrencyBalance: newBal.toFixed(8), updatedAt: new Date() })
						.where(eq(user.id, game.userId));
				} catch (e) {
					console.error('Chicken cleanup refund failed:', e);
				}
			} else {
				await redis.del(getSessionKey(game.sessionToken));
			}
		}
	}
}
