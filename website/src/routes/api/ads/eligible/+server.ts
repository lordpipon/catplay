import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { advertisement, coin, userPortfolio } from '$lib/server/db/schema';
import { eq, gt } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');

	const userId = Number(session.user.id);

	const holdings = await db
		.select({
			coinId: userPortfolio.coinId,
			quantity: userPortfolio.quantity,
			coinName: coin.name,
			coinSymbol: coin.symbol,
			coinIcon: coin.icon,
			coinPrice: coin.currentPrice,
			coinChange24h: coin.change24h,
			circulatingSupply: coin.circulatingSupply
		})
		.from(userPortfolio)
		.innerJoin(coin, eq(userPortfolio.coinId, coin.id))
		.where(eq(userPortfolio.userId, userId));

	const withPct = holdings.map((h) => ({
		...h,
		pct: Number(h.circulatingSupply) > 0 ? Number(h.quantity) / Number(h.circulatingSupply) : 0
	}));

	const eligible = withPct.filter((h) => h.pct >= 0.05);
	if (eligible.length === 0) return json([]);

	const activeAds = await db
		.select({ coinId: advertisement.coinId })
		.from(advertisement)
		.where(gt(advertisement.expiresAt, new Date()));

	const activeCoinIds = new Set(activeAds.map((a) => a.coinId));

	return json(
		eligible.map(({ quantity, circulatingSupply, ...h }) => ({
			...h,
			hasActiveAd: activeCoinIds.has(h.coinId)
		}))
	);
};