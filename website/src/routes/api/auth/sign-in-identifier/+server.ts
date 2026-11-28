import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';

export async function POST({ request }) {
	const body = (await request.json().catch(() => ({}))) as {
		identifier?: string;
		password?: string;
		callbackURL?: string;
	};
	const identifier = String(body.identifier ?? '').trim();
	const password = String(body.password ?? '');
	if (!identifier || !password) {
		throw error(400, 'Username/email and password are required');
	}

	let email = identifier;
	if (!identifier.includes('@')) {
		const username = identifier.toLowerCase();
		const [found] = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.username, username))
			.limit(1);
		if (!found?.email) {
			throw error(401, 'Invalid username or password');
		}
		email = found.email;
	}

	return (await (auth.api.signInEmail as any)({
		body: {
			email,
			password,
			...(body.callbackURL ? { callbackURL: body.callbackURL } : {})
		},
		headers: request.headers,
		asResponse: true
	})) as Response;
}
