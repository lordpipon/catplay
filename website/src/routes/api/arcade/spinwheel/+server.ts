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

// Nerfed weights: more lose segments, lower jackpot
// Total weight = 100
const WHEEL_SEGMENTS = [
	{ label: '2x',   multiplier: 2,    weight: 28, color: '#3b82f6' },
	{ label: 'LOSE', multiplier: 0,    weight: 27, color: '#ef4444' },
	{ label: '1.5x', multiplier: 1.5,  weight: 18, color: '#8b5cf6' },
	{ label: '3x',   multiplier: 3,    weight: 10, color: '#f59e0b' },
	{ label: 'LOSE', multiplier: 0,    weight: 10, color: '#ef4444' },
	{ label: '5x',   multiplier: 5,    weight: 4,  color: '#10b981' },
	{ label: 'LOSE', multiplier: 0,    weight: 2,  color: '#ef4444' },
	{ label: '15x',  multiplier: 15,   weight: 1,  color: '#f97316' }, // nerfed: was 25x
] as const;

const TOTAL_WEIGHT = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);

// Unbiased random integer in [0, max)
function randomInt(max: number): number {
	const limit = Math.floor(0x100000000 / max) * max;
	let r: number;
	do { r = randomBytes(4).readUInt32BE(0); } while (r >= limit);
	return r % max;
}

function spinWheel(): number {
	const rand = randomInt(TOTAL_WEIGHT);
	let cumulative = 0;
	for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
		cumulative += WHEEL_SEGMENTS[i].weight;
		if (rand < cumulative) return i;
	}
	return WHEEL_SEGMENTS.length - 1;
}

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, userId)).limit(1);
	if (hasFlag(currentUser?.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });

	try {
		const { amount } = await request.json();
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

			const segmentIndex = spinWheel();
			const segment = WHEEL_SEGMENTS[segmentIndex];
			const eventMult = await getArcadeMultiplier();
			// Event multiplier only applies to winning segments
			const finalMult = segment.multiplier > 0 ? segment.multiplier * eventMult : 0;
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
				segmentIndex,
				segment: { label: segment.label, multiplier: finalMult, color: segment.color },
				newBalance,
				payout,
				amountWagered: roundedBet
			};
		});

		await publishArcadeActivity(userId, result.won ? result.payout : result.amountWagered, result.won, 'spinwheel', 2500);
		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], { arcadeWon: result.won, arcadeWager: result.amountWagered });

		return json(result);
	} catch (e) {
		console.error('Spinwheel error:', e);
		if (e instanceof Error && e.message.startsWith('Insufficient funds'))
			return json({ error: e.message }, { status: 400 });
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
