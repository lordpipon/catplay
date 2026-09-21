import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { user, userFollow } from '$lib/server/db/schema';
import { getFollowPage, getFollowSummary } from '$lib/server/follows';
import type { FollowRelation } from '$lib/types/user-profile';
import type { RequestHandler } from './$types';

async function resolveTargetUser(userParam: string) {
	const isNumeric = /^\d+$/.test(userParam);
	return db.query.user.findFirst({
		where: isNumeric ? eq(user.id, parseInt(userParam)) : eq(user.username, userParam),
		columns: {
			id: true
		}
	});
}

function parsePagination(
	url: URL
): { relation: FollowRelation; page: number; perPage: number } {
	const relation = url.searchParams.get('relation') as FollowRelation | null;
	if (relation !== 'followers' && relation !== 'following') {
		throw error(400, 'Invalid follow relation');
	}

	const page = Number(url.searchParams.get('page') ?? '1');
	const perPage = Number(url.searchParams.get('perPage') ?? '8');

	if (!Number.isFinite(page) || page < 1) {
		throw error(400, 'Invalid page');
	}

	if (!Number.isFinite(perPage) || perPage < 1 || perPage > 50) {
		throw error(400, 'Invalid page size');
	}

	return { relation, page: Math.floor(page), perPage: Math.floor(perPage) };
}

export const GET: RequestHandler = async ({ request, params }) => {
	const targetUserParam = params.userId;
	if (!targetUserParam) throw error(400, 'User ID or username is required');

	const targetUser = await resolveTargetUser(targetUserParam);
	if (!targetUser) throw error(404, 'User not found');

	const { relation, page, perPage } = parsePagination(new URL(request.url));
	const pageData = await getFollowPage(targetUser.id, relation, page, perPage);

	return json(pageData);
};

export const POST: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const sessionUserId = Number(session.user.id);
	const targetUserParam = params.userId;
	if (!targetUserParam) throw error(400, 'User ID or username is required');

	const targetUser = await resolveTargetUser(targetUserParam);
	if (!targetUser) throw error(404, 'User not found');
	if (targetUser.id === sessionUserId) throw error(400, 'Cannot follow yourself');

	await db
		.insert(userFollow)
		.values({ followerId: sessionUserId, followingId: targetUser.id })
		.onConflictDoNothing();

	const follow = await getFollowSummary(targetUser.id, sessionUserId);
	return json({ success: true, follow });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const sessionUserId = Number(session.user.id);
	const targetUserParam = params.userId;
	if (!targetUserParam) throw error(400, 'User ID or username is required');

	const targetUser = await resolveTargetUser(targetUserParam);
	if (!targetUser) throw error(404, 'User not found');
	if (targetUser.id === sessionUserId) throw error(400, 'Cannot unfollow yourself');

	await db
		.delete(userFollow)
		.where(
			and(eq(userFollow.followerId, sessionUserId), eq(userFollow.followingId, targetUser.id))
		);

	const follow = await getFollowSummary(targetUser.id, sessionUserId);
	return json({ success: true, follow });
};