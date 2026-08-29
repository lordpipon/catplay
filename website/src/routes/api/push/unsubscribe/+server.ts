import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { unsubscribePush } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	let body: { endpoint?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	if (!body.endpoint) throw error(400, 'endpoint is required');

	await unsubscribePush(Number(session.user.id), body.endpoint);

	return json({ ok: true });
};
