import { error, json } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { profileReaction, user } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

async function getFeedbackSummary(targetUserId: number, sessionUserId: number) {
	const [reactionStats] = await db
		.select({
			likesCount: sql<number>`COALESCE(SUM(CASE WHEN ${profileReaction.reaction} = 'LIKE' THEN 1 ELSE 0 END), 0)`,
			dislikesCount: sql<number>`COALESCE(SUM(CASE WHEN ${profileReaction.reaction} = 'DISLIKE' THEN 1 ELSE 0 END), 0)`
		})
		.from(profileReaction)
		.where(eq(profileReaction.targetUserId, targetUserId));

	const [existingReaction] = await db
		.select({ reaction: profileReaction.reaction })
		.from(profileReaction)
		.where(
			and(
				eq(profileReaction.targetUserId, targetUserId),
				eq(profileReaction.reactorUserId, sessionUserId)
			)
		)
		.limit(1);

	return {
		likesCount: Number(reactionStats?.likesCount ?? 0),
		dislikesCount: Number(reactionStats?.dislikesCount ?? 0),
		userReaction: existingReaction?.reaction ?? null
	};
}

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		return json({ message: 'Not authenticated' }, { status: 401 });
	}

	const targetUserParam = params.userId;
	if (!targetUserParam) {
		throw error(400, 'User ID or username is required');
	}

	const body = await request.json().catch(() => ({}));
	const reaction = body?.reaction;
	if (reaction !== null && reaction !== 'LIKE' && reaction !== 'DISLIKE') {
		return json({ message: 'Invalid reaction' }, { status: 400 });
	}

	const sessionUserId = Number(session.user.id);
	if (Number.isNaN(sessionUserId)) {
		return json({ message: 'Invalid session user' }, { status: 400 });
	}

	try {
		const isNumeric = /^\d+$/.test(targetUserParam);
		const targetUser = await db.query.user.findFirst({
			where: isNumeric
				? eq(user.id, parseInt(targetUserParam))
				: eq(user.username, targetUserParam),
			columns: {
				id: true
			}
		});

		if (!targetUser) {
			return json({ message: 'User not found' }, { status: 404 });
		}

		if (targetUser.id === sessionUserId) {
			return json({ message: 'You cannot react to your own profile' }, { status: 400 });
		}

		await db.transaction(async (tx) => {
			const [existingReaction] = await tx
				.select({ reaction: profileReaction.reaction })
				.from(profileReaction)
				.where(
					and(
						eq(profileReaction.targetUserId, targetUser.id),
						eq(profileReaction.reactorUserId, sessionUserId)
					)
				)
				.limit(1);

			if (reaction === null) {
				if (!existingReaction) return;

				await tx
					.delete(profileReaction)
					.where(
						and(
							eq(profileReaction.targetUserId, targetUser.id),
							eq(profileReaction.reactorUserId, sessionUserId)
						)
					);
				return;
			}

			if (!existingReaction) {
				await tx.insert(profileReaction).values({
					reactorUserId: sessionUserId,
					targetUserId: targetUser.id,
					reaction
				});
				return;
			}

			if (existingReaction.reaction === reaction) {
				await tx
					.delete(profileReaction)
					.where(
						and(
							eq(profileReaction.targetUserId, targetUser.id),
							eq(profileReaction.reactorUserId, sessionUserId)
						)
					);
				return;
			}

			await tx
				.update(profileReaction)
				.set({ reaction })
				.where(
					and(
						eq(profileReaction.targetUserId, targetUser.id),
						eq(profileReaction.reactorUserId, sessionUserId)
					)
				);
		});

		const feedback = await getFeedbackSummary(targetUser.id, sessionUserId);

		return json({ success: true, feedback });
	} catch (err) {
		console.error('Failed to update profile reaction:', err);
		return json({ message: 'Internal server error' }, { status: 500 });
	}
};