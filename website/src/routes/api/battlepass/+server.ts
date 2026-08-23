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
	let earnedLevel = 0;
	for (const tier of freeTiers) {
		if (isTierComplete(tier, delta)) {
			earnedLevel = tier.level;
		} else {
			break;
		}
	}

	if (progress.level !== earnedLevel) {
		if (earnedLevel > progress.level) {
			await createNotification(
				session.user.id.toString(),
				'SYSTEM',
				`Battlepass Level ${earnedLevel}!`,
				`You reached Level ${earnedLevel}. New rewards are ready to claim!`,
				'/battlepass'
			);
		}
		[progress] = await db.update(battlepassProgress)
			.set({ level: earnedLevel, xp: earnedLevel * 100 })
			.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, season.id)))
			.returning();
	}

	return json({ season, tiers, progress, isVip, counts: delta });
};

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ error: 'Not authenticated' }, { status: 401 });
	const userId = Number(session.user.id);

	const { action, tierId } = await request.json();

	if (action === 'claim') {
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

		const [progress] = await db.select().from(battlepassProgress)
			.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, tier.seasonId)))
			.limit(1);
		if (!progress) return json({ error: 'Visit the battlepass page first' }, { status: 400 });

		// Verify task completed
		if (tier.taskType !== 'manual') {
			const raw = await getRawCounts(userId, userData);
			const counts = getCountsForVerification(raw, progress);
			if (!isTierComplete(tier, counts))
				return json({ error: `Task not complete yet: ${tier.taskDescription}` }, { status: 400 });
		}

		if (progress.level < tier.level)
			return json({ error: `Complete previous levels first (you are level ${progress.level})` }, { status: 400 });

		const claimed: number[] = JSON.parse(progress.claimedTiers || '[]');
		if (claimed.includes(tierId)) return json({ error: 'Already claimed' }, { status: 400 });
		claimed.push(tierId);

		const updateData: any = { updatedAt: new Date() };
		if (tier.rewardType === 'gems') updateData.gems = (userData.gems ?? 0) + Number(tier.rewardAmount);
		if (tier.rewardType === 'cash') updateData.baseCurrencyBalance = (Number(userData.baseCurrencyBalance) + Number(tier.rewardAmount)).toFixed(8);

		// Premium: also grant cash bonus (gems × 50)
		if (tier.tier === 'premium' && tier.rewardType === 'gems') {
			const cashBonus = Number(tier.rewardAmount) * 25;
			updateData.baseCurrencyBalance = (Number(userData.baseCurrencyBalance) + cashBonus).toFixed(8);
		}

		await db.transaction(async (tx) => {
			await tx.update(user).set(updateData).where(eq(user.id, userId));
			await tx.update(battlepassProgress)
				.set({ claimedTiers: JSON.stringify(claimed) })
				.where(and(eq(battlepassProgress.userId, userId), eq(battlepassProgress.seasonId, tier.seasonId)));
		});

		await createNotification(
			session.user.id.toString(),
			'SYSTEM',
			'Battlepass Reward Claimed!',
			`Level ${tier.level} ${tier.tier === 'premium' ? 'Premium ' : ''}reward: ${tier.rewardLabel}`,
			'/battlepass'
		);

		return json({ success: true, reward: { type: tier.rewardType, amount: Number(tier.rewardAmount), label: tier.rewardLabel } });
	}

	return json({ error: 'Unknown action' }, { status: 400 });
};
