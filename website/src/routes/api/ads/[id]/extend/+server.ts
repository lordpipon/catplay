import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { advertisement, user } from '$lib/server/db/schema';
import { and, eq, gt, sql } from 'drizzle-orm';
import { AD_DURATIONS } from '$lib/data/constants';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');

	const { durationHours } = await request.json();
	const dur = AD_DURATIONS.find((d) => d.hours === durationHours);
	if (!dur) throw error(400, 'Invalid duration');

	const userId = Number(session.user.id);

	const [ad] = await db
		.select({
			id: advertisement.id,
			expiresAt: advertisement.expiresAt,
			userId: advertisement.userId
		})
		.from(advertisement)
		.where(and(eq(advertisement.id, Number(params.id)), gt(advertisement.expiresAt, new Date())))
		.limit(1);

	if (!ad) throw error(404, 'Active advertisement not found');
	if (ad.userId !== userId) throw error(403, 'Not your advertisement');

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

	const newExpiry = new Date(new Date(ad.expiresAt).getTime() + durationHours * 60 * 60 * 1000);

	await db.transaction(async (tx) => {
		await tx
			.update(user)
			.set({ gems: sql`${user.gems} - ${dur.cost}` })
			.where(eq(user.id, userId));
		await tx
			.update(advertisement)
			.set({ expiresAt: newExpiry })
			.where(eq(advertisement.id, ad.id));
	});

	return json({ success: true, newExpiry });
};