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

const SUITS = ['♠','♥','♦','♣'] as const;
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const;
type Card = { rank: string; suit: string; value: number };

function makeDecks(n = 1): Card[] {
	const deck: Card[] = [];
	for (let d = 0; d < n; d++) {
		for (const suit of SUITS) {
			for (let i = 0; i < RANKS.length; i++) {
				deck.push({ rank: RANKS[i], suit, value: Math.min(i + 2, 11) });
			}
		}
	}
	return deck;
}

function shuffle(deck: Card[]): Card[] {
	const d = [...deck];
	for (let i = d.length - 1; i > 0; i--) {
		const j = randomBytes(4).readUInt32BE(0) % (i + 1);
		[d[i], d[j]] = [d[j], d[i]];
	}
	return d;
}

function handValue(hand: Card[]): number {
	let total = hand.reduce((s, c) => s + c.value, 0);
	let aces = hand.filter(c => c.rank === 'A').length;
	while (total > 21 && aces > 0) { total -= 10; aces--; }
	return total;
}

// Video poker hand rankings
function rankHand(cards: Card[]): { name: string; multiplier: number } {
	const values = cards.map(c => c.value).sort((a,b) => a - b);
	const ranks = cards.map(c => c.rank);
	const suits = cards.map(c => c.suit);
	const rankCounts = ranks.reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {} as Record<string, number>);
	const counts = Object.values(rankCounts).sort((a,b) => b - a);
	const isFlush = suits.every(s => s === suits[0]);
	const isStraight = values[4] - values[0] === 4 && new Set(values).size === 5;
	const isRoyal = isStraight && isFlush && values[0] === 10;

	if (isRoyal) return { name: 'Royal Flush', multiplier: 250 };
	if (isStraight && isFlush) return { name: 'Straight Flush', multiplier: 50 };
	if (counts[0] === 4) return { name: 'Four of a Kind', multiplier: 25 };
	if (counts[0] === 3 && counts[1] === 2) return { name: 'Full House', multiplier: 9 };
	if (isFlush) return { name: 'Flush', multiplier: 6 };
	if (isStraight) return { name: 'Straight', multiplier: 4 };
	if (counts[0] === 3) return { name: 'Three of a Kind', multiplier: 3 };
	if (counts[0] === 2 && counts[1] === 2) return { name: 'Two Pair', multiplier: 2 };
	// Jacks or better
	if (counts[0] === 2) {
		const pairRank = Object.entries(rankCounts).find(([,v]) => v === 2)?.[0];
		if (['J','Q','K','A'].includes(pairRank ?? '')) return { name: 'Jacks or Better', multiplier: 1 };
	}
	return { name: 'No Win', multiplier: 0 };
}

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');
	const userId = Number(session.user.id);

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, userId)).limit(1);
	if (hasFlag(currentUser?.flags, 'NO_ARCADE'))
		return json({ error: "You aren't authorized to play Arcade games." }, { status: 403 });

	try {
		const { amount, hold } = await request.json();
		const roundedBet = validateBetAmount(amount);
		const holdIndices: number[] = hold ?? [];

		const deck = shuffle(makeDecks(1));
		let hand: Card[] = deck.slice(0, 5);

		// Replace non-held cards
		let drawIdx = 5;
		hand = hand.map((card, i) => holdIndices.includes(i) ? card : deck[drawIdx++]);

		const { name: handName, multiplier: baseMultiplier } = rankHand(hand);
		const eventMult = await getArcadeMultiplier();
		const finalMultiplier = baseMultiplier > 0 ? baseMultiplier * eventMult : 0;

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

			const payout = roundedBet * finalMultiplier;
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
			return { won: isWin, hand, handName, multiplier: finalMultiplier, payout, newBalance, amountWagered: roundedBet };
		});

		await publishArcadeActivity(userId, result.won ? result.payout : result.amountWagered, result.won, 'poker', 2500);
		await checkAndAwardAchievements(userId, ['arcade', 'wealth'], { arcadeWon: result.won, arcadeWager: result.amountWagered });
		return json(result);
	} catch (e) {
		if (e instanceof Error && e.message.startsWith('Insufficient funds'))
			return json({ error: e.message }, { status: 400 });
		console.error('Poker error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
