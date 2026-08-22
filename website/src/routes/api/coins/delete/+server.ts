import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { coin, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { hasFlag } from '$lib/data/flags';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	try {
		const { symbol } = await request.json();
		if (!symbol || typeof symbol !== 'string') {
			return json({ error: 'Invalid coin symbol' }, { status: 400 });
		}

		const result = await db.transaction(async (tx) => {
			const [coinRow] = await tx
				.select({
					id: coin.id,
					name: coin.name,
					symbol: coin.symbol,
					creatorId: coin.creatorId,
					poolBaseCurrencyAmount: coin.poolBaseCurrencyAmount
				})
				.from(coin)
				.where(eq(coin.symbol, symbol.toUpperCase()))
				.for('update')
				.limit(1);

			if (!coinRow) throw new Error('Coin not found');
			if (coinRow.creatorId !== userId) {
				throw new Error('Only the creator of this coin can delete it');
			}

			const [userRow] = await tx
				.select({ baseCurrencyBalance: user.baseCurrencyBalance })
				.from(user)
				.where(eq(user.id, userId))
				.for('update')
				.limit(1);

			const poolRefund = Number(coinRow.poolBaseCurrencyAmount || 0);
			const newBalance =
				Math.round((Number(userRow.baseCurrencyBalance) + poolRefund) * 100000000) / 100000000;

			await tx.delete(coin).where(eq(coin.id, coinRow.id));

			await tx
				.update(user)
				.set({ baseCurrencyBalance: newBalance.toFixed(8), updatedAt: new Date() })
				.where(eq(user.id, userId));

			return {
				name: coinRow.name,
				symbol: coinRow.symbol,
				poolRefund,
				newBalance
			};
		});

		return json({
			success: true,
			message: `${result.name} (*${result.symbol}) deleted. $${result.poolRefund.toFixed(2)} of pool liquidity was returned to you.`,
			newBalance: result.newBalance
		});
	} catch (e) {
		if (e instanceof Error && (e.message === 'Coin not found' || e.message.startsWith('Only the creator'))) {
			return json({ error: e.message }, { status: e.message === 'Coin not found' ? 404 : 403 });
		}
		console.error('Coin delete error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
