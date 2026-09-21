import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, coin, transaction, comment, globalSetting } from '$lib/server/db/schema';
import { sql, count, eq, gt, like } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN'))
		throw error(403, 'Admin access required');

	const now = new Date();
	const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	const [
		[users],
		[coins],
		[listedCoins],
		[transactions],
		[comments],
		[newUsers],
		[gemsRow],
		[vipRows],
		[marketRow],
		[volumeRow],
		[txVolumeRow]
	] = await Promise.all([
		db.select({ count: count() }).from(user),
		db.select({ count: count() }).from(coin),
		db.select({ count: count() }).from(coin).where(eq(coin.isListed, true)),
		db.select({ count: count() }).from(transaction),
		db.select({ count: count() }).from(comment).where(eq(comment.isDeleted, false)),
		db.select({ count: count() }).from(user).where(gt(user.createdAt, dayAgo)),
		db.select({ sum: sql<string>`coalesce(sum(gems), 0)` }).from(user),
		db.select({ count: count() }).from(globalSetting).where(like(globalSetting.key, 'vip_expires_%')),
		db.select({ sum: sql<string>`coalesce(sum(market_cap), 0)` }).from(coin).where(eq(coin.isListed, true)),
		db.select({ sum: sql<string>`coalesce(sum(volume_24h), 0)` }).from(coin).where(eq(coin.isListed, true)),
		db.select({ sum: sql<string>`coalesce(sum(total_base_currency_amount), 0)` }).from(transaction)
	]);

	const toNumber = (v: string | number | null | undefined) =>
		typeof v === 'number' ? v : Number(v ?? 0);

	return json({
		totalUsers: users.count,
		totalCoins: coins.count,
		listedCoins: listedCoins.count,
		totalTransactions: transactions.count,
		totalComments: comments.count,
		newUsers24h: newUsers.count,
		totalGems: toNumber(gemsRow.sum),
		activeVipCount: vipRows.count,
		totalMarketCap: toNumber(marketRow.sum),
		totalVolume24h: toNumber(volumeRow.sum),
		totalTradingVolume: toNumber(txVolumeRow.sum)
	});
};