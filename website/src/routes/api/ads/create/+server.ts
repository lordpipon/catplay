import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { advertisement, coin, user, userPortfolio } from '$lib/server/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { AD_DURATIONS } from '$lib/data/constants';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');

	const { coinId, durationHours } = await request.json();
	const dur = AD_DURATIONS.find((d) => d.hours === durationHours);
	if (!dur) throw error(400, 'Invalid duration');

	const userId = Number(session.user.id);

	const [coinRecord] = await db
		.select({ id: coin.id, symbol: coin.symbol, circulatingSupply: coin.circulatingSupply })
		.from(coin)
		.where(eq(coin.id, Number(coinId)))
		.limit(1);

	if (!coinRecord) throw error(404, 'Coin not found');

	const [holding] = await db
		.select({ quantity: userPortfolio.quantity })
		.from(userPortfolio)
		.where(and(eq(userPortfolio.userId, userId), eq(userPortfolio.coinId, coinRecord.id)))
		.limit(1);

	const pct =
		Number(coinRecord.circulatingSupply) > 0
			? Number(holding?.quantity ?? 0) / Number(coinRecord.circulatingSupply)
			: 0;

	if (pct < 0.05) {
		throw error(
			403,
			`You need at least 5% of ${coinRecord.symbol} to advertise it (you have ${(pct * 100).toFixed(2)}%)`
		);
	}

	const [existing] = await db
		.select({ id: advertisement.id, userId: advertisement.userId })
		.from(advertisement)
		.where(and(eq(advertisement.coinId, coinRecord.id), gt(advertisement.expiresAt, new Date())))
		.limit(1);

	if (existing) {
		throw error(
			400,
			existing.userId === userId
				? 'You already have an active ad for this coin. Use Extend instead.'
				: `${coinRecord.symbol} already has an active advertisement running.`
		);
	}

	const [userRecord] = await db
		.select({ gems: user.gems })
		.from(user)
		.where(eq(user.id, userId))
		.for('update')
		.limit(1);

	if (!userRecord) throw error(404, 'User not found');
	if (userRecord.gems < dur.cost) {
		throw error(
			400,
			`Not enough gems. Need ${dur.cost.toLocaleString()}, have ${userRecord.gems.toLocaleString()}`
		);
	}

	const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

	await db.transaction(async (tx) => {
		await tx
			.update(user)
			.set({ gems: sql`${user.gems} - ${dur.cost}` })
			.where(eq(user.id, userId));
		await tx.insert(advertisement).values({
			userId,
			coinId: coinRecord.id,
			durationHours,
			totalCost: dur.cost.toString(),
			expiresAt
		});
	});

	return json({ success: true, expiresAt });
};