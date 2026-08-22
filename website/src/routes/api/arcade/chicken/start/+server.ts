import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
import { getSessionKey, chk_config, chk_multiplier, type ChickenDifficulty, type ChickenSession } from '$lib/server/games/chicken';
import { validateBetAmount } from '$lib/utils';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (hasFlag(currentUser?.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });

	try {
		const { betAmount, difficulty } = await request.json();

		if (!difficulty || !Object.keys(chk_config).includes(difficulty)) {
			return json({ error: 'Invalid difficulty' }, { status: 400 });
		}

		const config = chk_config[difficulty as ChickenDifficulty];
		const bet = validateBetAmount(betAmount);

		const laneCars: boolean[] = [];
		for (let i = 0; i < config.lanes; i++) {
			laneCars.push(Math.random() >= config.survival);
		}

		const result = await db.transaction(async (tx) => {
			const [row] = await tx
				.select({ baseCurrencyBalance: user.baseCurrencyBalance })
				.from(user)
				.where(eq(user.id, userId))
				.for('update')
				.limit(1);

			const balance = Math.round(Number(row.baseCurrencyBalance) * 100000000) / 100000000;

			if (bet > balance) {
				throw new Error(
					`Insufficient funds. You need $${bet.toFixed(2)} but only have $${balance.toFixed(2)}`
				);
			}

			const bytes = new Uint8Array(8);
			crypto.getRandomValues(bytes);
			const token = Array.from(bytes)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			const now = Date.now();
			const newBalance = balance - bet;

			const game: ChickenSession = {
				sessionToken: token,
				betAmount: bet,
				difficulty: difficulty as ChickenDifficulty,
				laneCars,
				currentLane: 0,
				currentMultiplier: 1,
				status: 'active',
				startTime: now,
				lastActivity: now,
				userId,
				version: 0
			};

			await redis.set(getSessionKey(token), JSON.stringify(game));

			await tx
				.update(user)
				.set({ baseCurrencyBalance: newBalance.toFixed(8), updatedAt: new Date() })
				.where(eq(user.id, userId));

			return { sessionToken: token, newBalance, lanes: config.lanes };
		});

		return json(result);
	} catch (e) {
		if (e instanceof Error && e.message.startsWith('Insufficient funds')) {
			return json({ error: e.message }, { status: 400 });
		}
		console.error('Chicken start error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
