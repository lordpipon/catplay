import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { publishArcadeActivity } from '$lib/server/arcade-activity';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import { validateBetAmount } from '$lib/utils';
import { getArcadeMultiplier } from '$lib/server/events';
import { DUCKS } from '$lib/arcade/duck-race-data';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

function pickWinner(): number {
	const r = randomBytes(4).readUInt32BE(0) / 0x100000000;
	let cumulative = 0;
	for (const duck of DUCKS) {
		cumulative += duck.probability;
		if (r < cumulative) return duck.id;
	}
	return DUCKS.length - 1;
}

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);
	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, userId)).limit(1);
	if (hasFlag(currentUser?.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });

	try {
		const { bet: duckId, amount } = await request.json();
		const chosenDuck = Number(duckId);

		if (isNaN(chosenDuck) || chosenDuck < 0 || chosenDuck >= DUCKS.length)
			return json({ error: 'Invalid duck selection' }, { status: 400 });

		const roundedBet = validateBetAmount(amount);
		const duck = DUCKS[chosenDuck];

		const result = await db.transaction(async (tx) => {
			const [userData] = await tx
				.select({
					baseCurrencyBalance: user.baseCurrencyBalance,
					arcadeLosses: user.arcadeLosses,
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

			const currentBalance = Number(userData.baseCurrencyBalance);
			const roundedBalance = Math.round(currentBalance * 100000000) / 100000000;

			if (roundedBet > roundedBalance)
				throw new Error(`Insufficient funds. You need $${roundedBet.toFixed(2)} but only have $${roundedBalance.toFixed(2)}`);

			const winnerId = pickWinner();
			const eventMult = await getArcadeMultiplier();
			const isWin = winnerId === chosenDuck;
			const finalMult = isWin ? duck.multiplier * eventMult : 0;
			const payout = roundedBet * finalMult;
			const newBalance = roundedBalance - roundedBet + payout;
			const netResult = payout - roundedBet;

			const updateData: any = {
				baseCurrencyBalance: newBalance.toFixed(8),
				updatedAt: new Date(),
				totalArcadeGamesPlayed: (userData.totalArcadeGamesPlayed || 0) + 1,
				totalArcadeWagered: `${Number(userData.totalArcadeWagered || 0) + roundedBet}`
			};

			if (isWin) {
				updateData.arcadeWins = `${Number(userData.arcadeWins || 0) + netResult}`;
				const newStreak = (userData.arcadeWinStreak || 0) + 1;
				updateData.arcadeWinStreak = newStreak;
				updateData.arcadeBestWinStreak = Math.max(newStreak, userData.arcadeBestWinStreak || 0);
			} else {
				updateData.arcadeLosses = `${Number(userData.arcadeLosses || 0) + Math.abs(netResult)}`;
				updateData.arcadeWinStreak = 0;
			}

			await tx.update(user).set(updateData).where(eq(user.id, userId));

			const finishPositions: number[] = [];
			const losers = DUCKS.map((_, i) => i).filter(i => i !== winnerId);
			for (const idx of losers) {
				finishPositions[idx] = 1 + Math.random() * 3.5;
			}
			finishPositions[winnerId] = 5;

			return {
				won: isWin,
				chosenDuck,
				winnerDuck: winnerId,
				finishPositions,
				multiplier: finalMult,
				newBalance,
				payout,
				amountWagered: roundedBet
			};
		});

		await publishArcadeActivity(userId, result.won ? result.payout : result.amountWagered, result.won, 'duck-race', 2500);
		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], { arcadeWon: result.won, arcadeWager: result.amountWagered });

		return json(result);
	} catch (e) {
		console.error('Duck race error:', e);
		if (e instanceof Error && e.message.startsWith('Insufficient funds'))
			return json({ error: e.message }, { status: 400 });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
