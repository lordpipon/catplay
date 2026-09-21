import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { writeAdminLog } from '$lib/server/admin-log';
import { hasFlag, UserFlags } from '$lib/data/flags';
import type { RequestHandler } from './$types';

const BADGES = {
	supporter: { flag: UserFlags.FOUNDER_BADGE, label: 'Supporter' },
	developer: { flag: UserFlags.DEVELOPER_BADGE, label: 'Developer' },
	owner: { flag: UserFlags.OWNER_BADGE, label: 'Owner' },
	halloween: { label: 'Halloween' }
} as const;

type BadgeKey = keyof typeof BADGES;

const isHalloween = (key: BadgeKey): key is 'halloween' => key === 'halloween';

export const POST: RequestHandler = async ({ request }) => {
	const authSession = await auth.api.getSession({ headers: request.headers });
	if (!authSession?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(authSession.user.id)))
		.limit(1);

	if (!hasFlag(currentUser.flags, 'IS_HEAD_ADMIN')) {
		throw error(403, 'Head admin access required');
	}

	const { username, badge } = await request.json();
	if (!username?.trim()) throw error(400, 'Username is required');
	if (!badge || !(badge in BADGES)) throw error(400, 'Invalid badge type');

	const key = badge as BadgeKey;
	const { label } = BADGES[key];

	const [target] = await db
		.select({
			id: user.id,
			username: user.username,
			flags: user.flags,
			halloweenBadge2026: user.halloweenBadge2026
		})
		.from(user)
		.where(eq(user.username, username.trim()))
		.limit(1);

	if (!target) throw error(404, 'User not found');

	let hasBadge: boolean;
	let newData: Partial<typeof user.$inferInsert>;

	if (isHalloween(key)) {
		hasBadge = !!target.halloweenBadge2026;
		newData = { halloweenBadge2026: !hasBadge, updatedAt: new Date() };
	} else {
		const { flag } = BADGES[key as 'supporter' | 'developer' | 'owner'];
		hasBadge = hasFlag(
			target.flags,
			key === 'supporter' ? 'FOUNDER_BADGE' : key === 'developer' ? 'DEVELOPER_BADGE' : 'OWNER_BADGE'
		);
		const newFlags = hasBadge ? target.flags & ~flag : target.flags | flag;
		newData = { flags: newFlags, updatedAt: new Date() };
	}

	await db.update(user).set(newData).where(eq(user.id, target.id));

	const action = hasBadge ? 'revoked' : 'granted';
	await writeAdminLog(
		Number(authSession.user.id),
		'TOGGLE_BADGE',
		target.id,
		`${label} badge ${action} for @${target.username}`
	);

	return json({ success: true, badge: key, granted: !hasBadge, username: target.username });
};
