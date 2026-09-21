import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { advertisement, coin } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');

	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
	const userId = Number(session.user.id);

	const ads = await db
		.select({
			id: advertisement.id,
			durationHours: advertisement.durationHours,
			totalCost: advertisement.totalCost,
			startsAt: advertisement.startsAt,
			expiresAt: advertisement.expiresAt,
			coinId: coin.id,
			coinName: coin.name,
			coinSymbol: coin.symbol,
			coinIcon: coin.icon,
			coinPrice: coin.currentPrice,
			coinChange24h: coin.change24h
		})
		.from(advertisement)
		.innerJoin(coin, eq(advertisement.coinId, coin.id))
		.where(eq(advertisement.userId, userId))
		.orderBy(desc(advertisement.createdAt))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	return json({ ads, page, hasMore: ads.length === PAGE_SIZE });
};