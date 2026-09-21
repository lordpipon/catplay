import { and, count, desc, eq } from 'drizzle-orm';
import type { FollowPageData, FollowRelation, UserFollowData } from '$lib/types/user-profile';
import { db } from './db';
import { user, userFollow } from './db/schema';

export async function getFollowSummary(
	targetUserId: number,
	sessionUserId?: number
): Promise<UserFollowData> {
	const [followersCountRow, followingCountRow, existingFollow] = await Promise.all([
		db.select({ count: count() }).from(userFollow).where(eq(userFollow.followingId, targetUserId)),
		db.select({ count: count() }).from(userFollow).where(eq(userFollow.followerId, targetUserId)),
		sessionUserId
			? db
					.select({ followerId: userFollow.followerId })
					.from(userFollow)
					.where(
						and(eq(userFollow.followingId, targetUserId), eq(userFollow.followerId, sessionUserId))
					)
					.limit(1)
			: Promise.resolve([])
	]);

	return {
		followersCount: Number(followersCountRow[0]?.count ?? 0),
		followingCount: Number(followingCountRow[0]?.count ?? 0),
		followers: [],
		following: [],
		isFollowing: existingFollow.length > 0
	};
}

export async function getFollowPage(
	targetUserId: number,
	relation: FollowRelation,
	page: number,
	perPage: number
): Promise<FollowPageData> {
	const safePage = Math.max(1, page);
	const safePerPage = Math.max(1, perPage);
	const pageOffset = (safePage - 1) * safePerPage;

	const totalCountQuery =
		relation === 'followers'
			? db
					.select({ count: count() })
					.from(userFollow)
					.where(eq(userFollow.followingId, targetUserId))
			: db
					.select({ count: count() })
					.from(userFollow)
					.where(eq(userFollow.followerId, targetUserId));

	const itemsQuery =
		relation === 'followers'
			? db
					.select({
						id: user.id,
						name: user.name,
						username: user.username,
						image: user.image,
						createdAt: userFollow.createdAt
					})
					.from(userFollow)
					.innerJoin(user, eq(userFollow.followerId, user.id))
					.where(eq(userFollow.followingId, targetUserId))
					.orderBy(desc(userFollow.createdAt))
					.limit(safePerPage)
					.offset(pageOffset)
			: db
					.select({
						id: user.id,
						name: user.name,
						username: user.username,
						image: user.image,
						createdAt: userFollow.createdAt
					})
					.from(userFollow)
					.innerJoin(user, eq(userFollow.followingId, user.id))
					.where(eq(userFollow.followerId, targetUserId))
					.orderBy(desc(userFollow.createdAt))
					.limit(safePerPage)
					.offset(pageOffset);

	const [totalCountRow, items] = await Promise.all([totalCountQuery, itemsQuery]);
	const totalCount = Number(totalCountRow[0]?.count ?? 0);

	return {
		relation,
		items,
		page: safePage,
		perPage: safePerPage,
		totalCount,
		totalPages: Math.max(1, Math.ceil(totalCount / safePerPage))
	};
}