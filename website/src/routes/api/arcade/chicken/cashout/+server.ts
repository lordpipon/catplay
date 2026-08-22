import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { redis } from '$lib/server/redis';
import { getSessionKey, type ChickenSession } from '$lib/server/games/chicken';
import { publishArcadeActivity } from '$lib/server/arcade-activity';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	try {
		const { sessionToken } = await request.json();
		const userId = Number(session.user.id);

		const raw = await redis.get(getSessionKey(sessionToken));
		const game = raw ? (JSON.parse(raw) as ChickenSession) : null;

		if (!game) return json({ error: 'Invalid session' }, { status: 400 });
		if (game.userId !== userId) return json({ error: 'Unauthorized' }, { status: 403 });
		if (game.currentLane === 0)
			return json({ error: 'Cross at least one lane before cashing out' }, { status: 400 });

		const deleted = await redis.del(getSessionKey(sessionToken));
		if (!deleted) return json({ error: 'Session already processed' }, { status: 400 });

		const payout =
			Math.round(game.betAmount * game.currentMultiplier * 100000000) / 100000000;

		const newBalance = await db.transaction(async (tx) => {
			const [row] = await tx
				.select({
					baseCurrencyBalance: user.baseCurrencyBalance,
					arcadeWins: user.arcadeWins,
					totalArcadeGamesPlayed: user.totalArcadeGamesPlayed,
					arcadeWinStreak: user.arcadeWinStreak,
					arcadeBestWinStreak: user.arcadeBestWinStreak,
					totalArcadeWagered: user.totalArcadeWagered
				})
				.from(user)
				.where(eq(user.id, userId))
				.for('update')
				.limit(1);

			if (!row) throw new Error('User not found');

			const bal = Number(row.baseCurrencyBalance);
			const newBal = Math.round((bal + payout) * 100000000) / 100000000;
			const streak = (row.arcadeWinStreak || 0) + 1;

			await tx
				.update(user)
				.set({
					baseCurrencyBalance: newBal.toFixed(8),
					arcadeWins: `${Number(row.arcadeWins || 0) + (payout - game.betAmount)}`,
					arcadeWinStreak: streak,
					arcadeBestWinStreak: Math.max(streak, row.arcadeBestWinStreak || 0),
					totalArcadeGamesPlayed: (row.totalArcadeGamesPlayed || 0) + 1,
					totalArcadeWagered: `${Number(row.totalArcadeWagered || 0) + game.betAmount}`,
					updatedAt: new Date()
				})
				.where(eq(user.id, userId));

			return newBal;
		});

		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], {
			arcadeWon: true,
			arcadeWager: game.betAmount,
			lanesCrossed: game.currentLane,
			difficulty: game.difficulty
		});

		await publishArcadeActivity(userId, payout, true, 'chicken', 2500);

		return json({
			status: 'cashed_out',
			currentLane: game.currentLane,
			multiplier: game.currentMultiplier,
			payout,
			newBalance,
			allCarLanes: game.laneCars
		});
	} catch (e) {
		console.error('Chicken cashout error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
