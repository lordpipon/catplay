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

const HORSES = [
	{ name: 'Thunder', emoji: '🐴', odds: 2.0,  weight: 30 },
	{ name: 'Blaze',   emoji: '🦄', odds: 3.0,  weight: 22 },
	{ name: 'Storm',   emoji: '🐎', odds: 4.5,  weight: 18 },
	{ name: 'Shadow',  emoji: '🏇', odds: 6.0,  weight: 14 },
	{ name: 'Lucky',   emoji: '🐴', odds: 8.0,  weight: 10 },
	{ name: 'Ghost',   emoji: '🦄', odds: 15.0, weight: 6  },
];

const TOTAL_WEIGHT = HORSES.reduce((s, h) => s + h.weight, 0);

function randomInt(max: number): number {
	const limit = Math.floor(0x100000000 / max) * max;
	let r: number;
	do { r = randomBytes(4).readUInt32BE(0); } while (r >= limit);
	return r % max;
}

function runRace(): number {
	const rand = randomInt(TOTAL_WEIGHT);
	let cumulative = 0;
	for (let i = 0; i < HORSES.length; i++) {
		cumulative += HORSES[i].weight;
		if (rand < cumulative) return i;
	}
	return HORSES.length - 1;
}

// Generate a fake race progress (finishing positions with times)
function generateRaceResult(winnerId: number): { positions: number[]; times: number[] } {
	const positions = [winnerId];
	const remaining = HORSES.map((_, i) => i).filter(i => i !== winnerId);
	while (remaining.length) {
		const idx = randomInt(remaining.length);
		positions.push(remaining.splice(idx, 1)[0]);
	}
	const times = positions.map((_, i) => +(28 + i * 0.4 + (randomInt(100) / 100)).toFixed(2));
	return { positions, times };
}

export const GET: RequestHandler = async () => {
	return json({ horses: HORSES });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, userId)).limit(1);
	if (hasFlag(currentUser?.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });

	try {
		const { amount, horseIndex } = await request.json();
		const roundedBet = validateBetAmount(amount);
		const betHorse = Number(horseIndex);
		if (betHorse < 0 || betHorse >= HORSES.length) return json({ error: 'Invalid horse' }, { status: 400 });

		const winnerIndex = runRace();
		const { positions, times } = generateRaceResult(winnerIndex);
		const won = winnerIndex === betHorse;
		const horse = HORSES[betHorse];
		const winner = HORSES[winnerIndex];

		const eventMult = await getArcadeMultiplier();
		const finalOdds = won ? horse.odds * eventMult : 0;

		const result = await db.transaction(async (tx) => {
			const [userData] = await tx.select({
				baseCurrencyBalance: user.baseCurrencyBalance,
				arcadeLosses: user.arcadeLosses,
				arcadeWins: user.arcadeWins,
				totalArcadeGamesPlayed: user.totalArcadeGamesPlayed,
				arcadeWinStreak: user.arcadeWinStreak,
				arcadeBestWinStreak: user.arcadeBestWinStreak,
				totalArcadeWagered: user.totalArcadeWagered
			}).from(user).where(eq(user.id, userId)).for('update').limit(1);

			const currentBalance = Number(userData.baseCurrencyBalance);
			const roundedBalance = Math.round(currentBalance * 100000000) / 100000000;
			if (roundedBet > roundedBalance)
				throw new Error(`Insufficient funds. You need $${roundedBet.toFixed(2)} but only have $${roundedBalance.toFixed(2)}`);

			const payout = won ? roundedBet * finalOdds : 0;
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
				const streak = (userData.arcadeWinStreak || 0) + 1;
				updateData.arcadeWinStreak = streak;
				updateData.arcadeBestWinStreak = Math.max(streak, userData.arcadeBestWinStreak || 0);
			} else {
				updateData.arcadeLosses = `${Number(userData.arcadeLosses || 0) + Math.abs(netResult)}`;
				updateData.arcadeWinStreak = 0;
			}
			await tx.update(user).set(updateData).where(eq(user.id, userId));
			return { won: isWin, winnerIndex, winnerName: winner.name, positions, times, payout, newBalance, amountWagered: roundedBet, finalOdds };
		});

		await publishArcadeActivity(userId, result.won ? result.payout : result.amountWagered, result.won, 'horserace', 2500);
		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], { arcadeWon: result.won, arcadeWager: result.amountWagered });
		return json({ ...result, horses: HORSES });
	} catch (e) {
		if (e instanceof Error && e.message.startsWith('Insufficient funds'))
			return json({ error: e.message }, { status: 400 });
		console.error('Horserace error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
