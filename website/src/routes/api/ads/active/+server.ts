import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { advertisement, coin, user } from '$lib/server/db/schema';
import { gt, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function mergeSort(arr: any[]): any[] {
	if (arr.length <= 1) return arr;
	const mid = Math.floor(arr.length / 2);
	const left = mergeSort(arr.slice(0, mid));
	const right = mergeSort(arr.slice(mid));
	const out: any[] = [];
	let i = 0,
		j = 0;
	while (i < left.length && j < right.length) {
		if (Math.random() < 0.5) out.push(left[i++]);
		else out.push(right[j++]);
	}
	return out.concat(left.slice(i)).concat(right.slice(j));
}

export const GET: RequestHandler = async ({ url }) => {
	const limitParam = Number(url.searchParams.get('limit') ?? 15);
	const limit = Math.min(15, Math.max(1, isNaN(limitParam) ? 15 : limitParam));

	const rows = await db
		.select({
			id: advertisement.id,
			expiresAt: advertisement.expiresAt,
			coinName: coin.name,
			coinSymbol: coin.symbol,
			coinIcon: coin.icon,
			coinPrice: coin.currentPrice,
			coinChange24h: coin.change24h
		})
		.from(advertisement)
		.innerJoin(coin, eq(advertisement.coinId, coin.id))
		.innerJoin(user, eq(advertisement.userId, user.id))
		.where(gt(advertisement.expiresAt, new Date()));

	return json(mergeSort(rows).slice(0, limit));
};