import { auth } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	user, battlepassSeason, battlepassTier, battlepassProgress, transaction,
	userPortfolio, coin, lotteryTicket, predictionBet
} from '$lib/server/db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { hasFlag } from '$lib/data/flags';
import type { RequestHandler } from './$types';
import { createNotification } from '$lib/server/notification';

// Task types tracked as "since joining the battlepass" (delta vs baseline)
const DELTA_TYPES = new Set(['trades', 'arcade_games']);

async function getRawCounts(userId: number, userData: any) {
	const [tradeRes] = await db
		.select({
			trades: count(),
			uniqueCoins: sql<string>`COUNT(DISTINCT ${transaction.coinId})`,
			volume: sql<string>`COALESCE(SUM(CASE WHEN ${transaction.type} IN ('BUY','SELL') THEN CAST(${transaction.totalBaseCurrencyAmount} AS NUMERIC) ELSE 0 END), 0)`
		})
		.from(transaction)
		.where(eq(transaction.userId, userId));

	const [holdingsRes] = await db
		.select({ cnt: count() })
		.from(userPortfolio)
		.where(and(eq(userPortfolio.userId, userId), sql`CAST(${userPortfolio.quantity} AS NUMERIC) > 0`));

	const [holdingsValue] = await db
		.select({ value: sql<string>`COALESCE(SUM(CAST(${userPortfolio.quantity} AS NUMERIC) * CAST(${coin.currentPrice} AS NUMERIC)), 0)` })
		.from(userPortfolio)
		.leftJoin(coin, eq(userPortfolio.coinId, coin.id))
		.where(eq(userPortfolio.userId, userId));

	const [lotteryRes] = await db
		.select({ tickets: sql<string>`COALESCE(SUM(${lotteryTicket.quantity}), 0)` })
		.from(lotteryTicket)
		.where(eq(lotteryTicket.userId, userId));

	const [predRes] = await db
		.select({ cnt: count() })
		.from(predictionBet)
		.where(eq(predictionBet.userId, userId));

	return {
		trades: Number(tradeRes?.trades ?? 0),
		arcade_games: Number(userData?.totalArcadeGamesPlayed ?? 0),
		login_streak: Number(userData?.loginStreak ?? 0),
		unique_coins: Number(tradeRes?.uniqueCoins ?? 0),
		volume_traded: Math.floor(Number(tradeRes?.volume ?? 0)),
		holdings: Number(holdingsRes?.cnt ?? 0),
		portfolio_value: Math.floor(Number(userData?.baseCurrencyBalance ?? 0)) + Math.floor(Number(holdingsValue?.value ?? 0)),
		lottery_tickets: Number(lotteryRes?.tickets ?? 0),
		predictions: Number(predRes?.cnt ?? 0)
	};
}

// Delta = current - baseline (what was earned SINCE joining the battlepass)
function getDeltaCounts(raw: Record<string, number>, progress: any) {
	return {
		trades: Math.max(0, raw.trades - (progress.baselineTrades ?? 0)),
		arcade_games: Math.max(0, raw.arcade_games - (progress.baselineArcade ?? 0))
	};
}

// Merged counts map sent to the client: delta for repeatable activities, lifetime for milestones
function getMergedCounts(raw: Record<string, number>, progress: any) {
	const delta = getDeltaCounts(raw, progress);
	return { ...raw, ...delta };
}

function isTierComplete(tier: { taskType: string; taskTarget: number }, counts: Record<string, number>): boolean {
	if (tier.taskType === 'manual') return false;
	return (counts[tier.taskType] ?? 0) >= tier.taskTarget;
}

function getCountsForVerification(raw: Record<string, number>, progress: any) {
	return getMergedCounts(raw, progress);
}

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });

	const [season] = await db.select().from(battlepassSeason)
		.where(eq(battlepassSeason.isActive, true)).limit(1);
	if (!season) return json({ season: null, tiers: [], progress: null, isVip: false, counts: {} });

	const tiers = await db.select().from(battlepassTier)
		.where(eq(battlepassTier.seasonId, season.id))
		.orderBy(battlepassTier.level, battlepassTier.tier);

	if (!session?.user) return json({ season, tiers, progress: null, isVip: false, counts: {} });

	const userId = Number(session.user.id);
	const [userData] = await db.select({
		flags: user.flags,
		totalArcadeGamesPlayed: user.totalArcadeGamesPlayed,
		loginStreak: user.loginStreak,
		gems: user.gems,
		baseCurrencyBalance: user.baseCurrencyBalance
	}).from(user).where(eq(user.id, userId)).limit(1);

	const isVip = hasFlag(userData?.flags, 'IS_VIP');
	const raw = await getRawCounts(userId, userData);

	// Get or create progress — record baseline on first join
	let [progress] = await db.select().from(battlepassProgress)
		.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, season.id)))
		.limit(1);

	if (!progress) {
		// Snapshot current activity as baseline so they start from 0
		[progress] = await db.insert(battlepassProgress).values({
			userId,
			seasonId: season.id,
			level: 0,
			xp: 0,
			claimedTiers: '[]',
			baselineTrades: raw.trades,
			baselineArcade: raw.arcade_games,
			baselineStreak: 0
		}).returning();
	}

	const delta = getMergedCounts(raw, progress);

	// Level = number of consecutive free tiers completed
	const freeTiers = tiers.filter(t => t.tier === 'free').sort((a, b) => a.level - b.level);
	let computedLevel = 0;
	for (const tier of freeTiers) {
		if (isTierComplete(tier, delta)) {
			computedLevel = tier.level;
		} else {
			break;
		}
	}

	// Levels never regress: absolute tasks (net worth, holdings, streak) fluctuate
	// over time and already-claimed rewards must stay valid — only write increases
	if (computedLevel > progress.level) {
		// Persist progress first. A notification failure must never roll back
		// the level the user just earned.
		[progress] = await db.update(battlepassProgress)
			.set({ level: computedLevel, xp: computedLevel * 100 })
			.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, season.id)))
			.returning();
		try {
			await createNotification(
				session.user.id.toString(),
				'BATTLEPASS',
				`Battlepass Level ${computedLevel}!`,
				`You reached Level ${computedLevel}. New rewards are ready to claim!`,
				'/battlepass'
			);
		} catch (e) {
			console.error('Battlepass level notification failed:', e);
		}
	}

	return json({ season, tiers, progress, isVip, counts: delta });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ error: 'Not authenticated' }, { status: 401 });
	const userId = Number(session.user.id);

	const body = await request.json().catch(() => ({}));
	const action = body.action;
	const tierId = Number(body.tierId);

	if (action === 'claim') {
		if (!Number.isInteger(tierId)) return json({ error: 'Invalid claim request' }, { status: 400 });

		const [tier] = await db.select().from(battlepassTier).where(eq(battlepassTier.id, tierId)).limit(1);
		if (!tier) return json({ error: 'Tier not found' }, { status: 404 });

		const [userData] = await db.select({
			flags: user.flags, gems: user.gems, baseCurrencyBalance: user.baseCurrencyBalance,
			totalArcadeGamesPlayed: user.totalArcadeGamesPlayed, loginStreak: user.loginStreak
		}).from(user).where(eq(user.id, userId)).limit(1);

		const isVip = hasFlag(userData.flags, 'IS_VIP');
		if (tier.tier === 'premium' && !isVip)
			return json({ error: 'VIP required for premium rewards' }, { status: 403 });

		const [season] = await db.select().from(battlepassSeason)
			.where(eq(battlepassSeason.id, tier.seasonId)).limit(1);
		if (!season?.isActive) return json({ error: 'Season not active' }, { status: 400 });

		let [progress] = await db.select().from(battlepassProgress)
			.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, tier.seasonId)))
			.limit(1);

		// A claim should still work if the user opened the page in an old tab or
		// their progress row was removed. Create it with the same baselines GET uses.
		if (!progress) {
			const raw = await getRawCounts(userId, userData);
			[progress] = await db.insert(battlepassProgress).values({
				userId,
				seasonId: tier.seasonId,
				level: 0,
				xp: 0,
				claimedTiers: '[]',
				baselineTrades: raw.trades,
				baselineArcade: raw.arcade_games,
				baselineStreak: 0
			}).onConflictDoNothing().returning();
			if (!progress) {
				[progress] = await db.select().from(battlepassProgress)
					.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, tier.seasonId)))
					.limit(1);
			}
		}

		// Verify task completed
		if (tier.taskType !== 'manual') {
			const raw = await getRawCounts(userId, userData);
			const counts = getCountsForVerification(raw, progress);
			if (!isTierComplete(tier, counts))
				return json({ error: `Task not complete yet: ${tier.taskDescription}` }, { status: 400 });
		}

		// Manual/final tiers unlock once every prior level is done.
		const requiredLevel = tier.taskType === 'manual' ? Math.max(0, tier.level - 1) : tier.level;
		if (progress.level < requiredLevel)
			return json({ error: `Complete previous levels first (you are level ${progress.level})` }, { status: 400 });

		let claimed: number[] = [];
		try {
			const parsed = JSON.parse(progress.claimedTiers || '[]');
			if (Array.isArray(parsed)) claimed = parsed.map(Number).filter(Number.isInteger);
		} catch {
			claimed = [];
		}
		if (claimed.includes(tierId)) return json({ error: 'Already claimed' }, { status: 400 });
		claimed.push(tierId);

		const rewardAmount = Number(tier.rewardAmount) || 0;
		const userUpdate: any = { updatedAt: new Date() };
		if (tier.rewardType === 'gems') userUpdate.gems = sql`${user.gems} + ${rewardAmount}`;
		if (tier.rewardType === 'cash')
			userUpdate.baseCurrencyBalance = sql`CAST(${user.baseCurrencyBalance} AS NUMERIC) + ${rewardAmount}`;

		// Premium gem rewards also grant a cash bonus (gems × 25)
		if (tier.tier === 'premium' && tier.rewardType === 'gems')
			userUpdate.baseCurrencyBalance = sql`CAST(${user.baseCurrencyBalance} AS NUMERIC) + ${rewardAmount * 25}`;

		await db.transaction(async (tx) => {
			await tx.update(user).set(userUpdate).where(eq(user.id, userId));
			await tx.update(battlepassProgress)
				.set({
					claimedTiers: JSON.stringify(claimed),
					level: Math.max(progress.level, tier.level),
					xp: Math.max(progress.level, tier.level) * 100
				})
				.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, tier.seasonId)));
		});

		try {
			await createNotification(
				session.user.id.toString(),
				'BATTLEPASS',
				'Battlepass Reward Claimed!',
				`Level ${tier.level} ${tier.tier === 'premium' ? 'Premium ' : ''}reward: ${tier.rewardLabel}`,
				'/battlepass'
			);
		} catch (e) {
			console.error('Battlepass reward notification failed:', e);
		}

		return json({ success: true, reward: { type: tier.rewardType, amount: Number(tier.rewardAmount), label: tier.rewardLabel } });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};
