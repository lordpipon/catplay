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
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function getColor(n: number): 'red' | 'black' | 'green' {
	if (n === 0) return 'green';
	return RED_NUMBERS.has(n) ? 'red' : 'black';
}

// Unbiased random integer in [0, max)
function randomInt(max: number): number {
	const limit = Math.floor(0x100000000 / max) * max;
	let r: number;
	do { r = randomBytes(4).readUInt32BE(0); } while (r >= limit);
	return r % max;
}

function getPayoutMultiplier(bet: string, result: number): number {
	const color = getColor(result);
	switch (bet) {
		case 'red':    return color === 'red'   ? 1.8 : 0;  // was 2x
		case 'black':  return color === 'black' ? 1.8 : 0;  // was 2x
		case 'green':  return color === 'green' ? 8   : 0;  // was 10x
		case 'odd':    return result !== 0 && result % 2 !== 0 ? 1.8 : 0;
		case 'even':   return result !== 0 && result % 2 === 0 ? 1.8 : 0;
		case '1-18':   return result >= 1  && result <= 18 ? 1.8 : 0;
		case '19-36':  return result >= 19 && result <= 36 ? 1.8 : 0;
		case '1st12':  return result >= 1  && result <= 12 ? 2.5 : 0; // was 3x
		case '2nd12':  return result >= 13 && result <= 24 ? 2.5 : 0;
		case '3rd12':  return result >= 25 && result <= 36 ? 2.5 : 0;
		default: {
			const num = parseInt(bet);
			if (!isNaN(num) && num >= 0 && num <= 36) return result === num ? 25 : 0; // was 30x
			return 0;
		}
	}
}

const VALID_BETS = new Set(['red','black','green','odd','even','1-18','19-36','1st12','2nd12','3rd12']);

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, userId)).limit(1);
	if (hasFlag(currentUser?.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });

	try {
		const { bet, amount } = await request.json();
		const betStr = String(bet);
		const isNumberBet = /^\d+$/.test(betStr) && parseInt(betStr) >= 0 && parseInt(betStr) <= 36;
		if (!VALID_BETS.has(betStr) && !isNumberBet)
			return json({ error: 'Invalid bet type' }, { status: 400 });

		const roundedBet = validateBetAmount(amount);

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

			const spinResult = randomInt(37); // 0–36 unbiased
			const eventMult = await getArcadeMultiplier();
			const payoutMult = getPayoutMultiplier(betStr, spinResult);
			const finalMult = payoutMult > 0 ? payoutMult * eventMult : 0;
			const payout = roundedBet * finalMult;
			const newBalance = roundedBalance - roundedBet + payout;
			const netResult = payout - roundedBet;
			const isWin = netResult > 0;

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

			return {
				won: isWin,
				spinResult,
				color: getColor(spinResult),
				multiplier: finalMult,
				newBalance,
				payout,
				amountWagered: roundedBet
			};
		});

		await publishArcadeActivity(userId, result.won ? result.payout : result.amountWagered, result.won, 'roulette', 2500);
		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], { arcadeWon: result.won, arcadeWager: result.amountWagered });

		return json(result);
	} catch (e) {
		console.error('Roulette error:', e);
		if (e instanceof Error && e.message.startsWith('Insufficient funds'))
			return json({ error: e.message }, { status: 400 });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
