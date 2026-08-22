import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { promoCode, promoCodeRedemption, user } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { RequestHandler } from '../$types';
import { hasFlag } from '$lib/data/flags';
import { getPublicUrl } from '$lib/utils';
import type { PromoCodeUse } from '$lib/types/promo-code';

export const GET: RequestHandler = async ({ request, url }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		throw error(403, 'Admin access required');
	}
	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, Number(session.user.id)))
		.limit(1);
	if (!hasFlag(currentUser.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN'))
		throw error(403, 'Admin access required');

	const code = url.searchParams.get('code')?.toUpperCase();
	if (!code) throw error(400, 'Add a promo code');

	const [promo] = await db
		.select({
			id: promoCode.id
		})
		.from(promoCode)
		.where(eq(promoCode.code, code))
		.limit(1);
	if (!promo) throw error(404, 'Invalid promo code');
	const uses = await db
		.select({
			id: user.id,
			flags: user.flags,
			name: user.name,
			username: user.username,
			avatar: user.image
		})
		.from(user)
		.innerJoin(promoCodeRedemption, eq(user.id, promoCodeRedemption.userId))
		.innerJoin(promoCode, eq(promoCodeRedemption.promoCodeId, promoCode.id))
		.where(eq(promoCode.code, code));
	return json({
		uses: uses.map((v) => ({ ...v, flags: v.flags.toString() }))
	} as { uses: PromoCodeUse[] });
};
