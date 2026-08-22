import { auth } from '$lib/auth';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
	user,
	transaction,
	coin,
	userPortfolio,
	predictionBet,
	predictionQuestion,
	comment,
	commentLike,
	promoCodeRedemption,
	promoCode,
	session as sessionTable
} from '$lib/server/db/schema';
import { eq, and, lte } from 'drizzle-orm';

function filename(userId: number) {
	return `catplay-data-${userId}-${new Date().toISOString().split('T')[0]}.json`;
}

export async function HEAD({ request }) {
	const authSession = await auth.api.getSession({ headers: request.headers });
	if (!authSession?.user) throw error(401, 'Not authenticated');
	const userId = Number(authSession.user.id);
	const userExists = await db.select({ id: user.id }).from(user).where(eq(user.id, userId)).limit(1);
	if (!userExists.length) throw error(404, 'User not found');
	return new Response(null, {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename(userId)}"`,
			'Content-Length': String(1024 * 50),
			'Cache-Control': 'no-cache, no-store, must-revalidate'
		}
	});
}

export async function GET({ request }) {
	const authSession = await auth.api.getSession({ headers: request.headers });
	if (!authSession?.user) throw error(401, 'Not authenticated');
	const userId = Number(authSession.user.id);

	try {
		const userData = await db.select().from(user).where(eq(user.id, userId)).limit(1);
		if (!userData.length) throw error(404, 'User not found');

		const transactions = await db
			.select({
				id: transaction.id, coinId: transaction.coinId, coinName: coin.name,
				coinSymbol: coin.symbol, type: transaction.type, quantity: transaction.quantity,
				pricePerCoin: transaction.pricePerCoin,
				totalBaseCurrencyAmount: transaction.totalBaseCurrencyAmount,
				timestamp: transaction.timestamp
			})
			.from(transaction).leftJoin(coin, eq(transaction.coinId, coin.id))
			.where(eq(transaction.userId, userId));

		const portfolio = await db
			.select({
				coinId: userPortfolio.coinId, coinName: coin.name, coinSymbol: coin.symbol,
				quantity: userPortfolio.quantity, updatedAt: userPortfolio.updatedAt
			})
			.from(userPortfolio).leftJoin(coin, eq(userPortfolio.coinId, coin.id))
			.where(eq(userPortfolio.userId, userId));

		const predictionBets = await db
			.select({
				id: predictionBet.id, questionId: predictionBet.questionId,
				question: predictionQuestion.question, side: predictionBet.side,
				amount: predictionBet.amount, actualWinnings: predictionBet.actualWinnings,
				createdAt: predictionBet.createdAt, settledAt: predictionBet.settledAt
			})
			.from(predictionBet)
			.leftJoin(predictionQuestion, eq(predictionBet.questionId, predictionQuestion.id))
			.where(eq(predictionBet.userId, userId));

		const comments = await db
			.select({
				id: comment.id, coinId: comment.coinId, coinName: coin.name,
				coinSymbol: coin.symbol, content: comment.content, likesCount: comment.likesCount,
				createdAt: comment.createdAt, updatedAt: comment.updatedAt, isDeleted: comment.isDeleted
			})
			.from(comment).leftJoin(coin, eq(comment.coinId, coin.id))
			.where(eq(comment.userId, userId));

		const commentLikes = await db
			.select({ commentId: commentLike.commentId, createdAt: commentLike.createdAt })
			.from(commentLike).where(eq(commentLike.userId, userId));

		const promoRedemptions = await db
			.select({
				id: promoCodeRedemption.id, promoCodeId: promoCodeRedemption.promoCodeId,
				promoCode: promoCode.code, rewardAmount: promoCodeRedemption.rewardAmount,
				redeemedAt: promoCodeRedemption.redeemedAt
			})
			.from(promoCodeRedemption)
			.leftJoin(promoCode, eq(promoCodeRedemption.promoCodeId, promoCode.id))
			.where(eq(promoCodeRedemption.userId, userId));

		const sessions = await db
			.select({
				id: sessionTable.id, expiresAt: sessionTable.expiresAt, createdAt: sessionTable.createdAt,
				ipAddress: sessionTable.ipAddress, userAgent: sessionTable.userAgent
			})
			.from(sessionTable)
			.where(and(eq(sessionTable.userId, userId), lte(sessionTable.expiresAt, new Date())));

		const createdCoins = await db
			.select({
				id: coin.id, name: coin.name, symbol: coin.symbol, icon: coin.icon,
				initialSupply: coin.initialSupply, circulatingSupply: coin.circulatingSupply,
				marketCap: coin.marketCap, price: coin.currentPrice, change24h: coin.change24h,
				poolCoinAmount: coin.poolCoinAmount, poolBaseCurrencyAmount: coin.poolBaseCurrencyAmount,
				createdAt: coin.createdAt, updatedAt: coin.updatedAt, isListed: coin.isListed
			})
			.from(coin).where(eq(coin.creatorId, userId));

		const createdQuestions = await db.select().from(predictionQuestion)
			.where(eq(predictionQuestion.creatorId, userId));

		const exportData = {
			exportInfo: { userId, exportedAt: new Date().toISOString(), dataType: 'complete_user_data' },
			user: userData[0], transactions, portfolio, predictionBets, comments,
			commentLikes, promoCodeRedemptions: promoRedemptions, sessions, createdCoins, createdQuestions
		};

		const jsonData = JSON.stringify(exportData, null, 2);
		const dataSize = new TextEncoder().encode(jsonData).length;

		return new Response(jsonData, {
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename(userId)}"`,
				'Content-Length': dataSize.toString(),
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});
	} catch (err) {
		console.error('Data export error:', err);
		throw error(500, 'Failed to export user data');
	}
}
