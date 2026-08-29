import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { subscribePush } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid request body');
	}

	if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
		throw error(400, 'Invalid subscription');
	}

	await subscribePush(Number(session.user.id), {
		endpoint: body.endpoint,
		keys: { p256dh: body.keys.p256dh, auth: body.keys.auth }
	});

	return json({ ok: true });
};
