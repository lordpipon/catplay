import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { hasPushSubscription } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const registered = await hasPushSubscription(Number(session.user.id));

	return json({ registered });
};
