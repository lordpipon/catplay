import { auth } from '$lib/auth';
import { json } from '@sveltejs/kit';
import { sendSecurityAlertEmail } from '$lib/server/email';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const body = await request.json().catch(() => null);
	const currentPassword = body?.currentPassword;
	const newPassword = body?.newPassword;
	if (!currentPassword || !newPassword) {
		return json({ error: 'Both passwords are required' }, { status: 400 });
	}

	try {
		await auth.api.changePassword({
			body: { currentPassword, newPassword, revokeOtherSessions: true },
			headers: request.headers
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to change password';
		return json({ error: message }, { status: 400 });
	}

	await sendSecurityAlertEmail(session.user.email, 'PASSWORD_CHANGED', [
		{ label: 'Method', value: 'Account settings' },
		{ label: 'Other sessions', value: 'Signed out' }
	]);

	return json({ success: true });
};
