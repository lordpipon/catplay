import { env as privateEnv } from '$env/dynamic/private';
import { CONTACT_EMAIL, SITE_NAME, SITE_ORIGIN } from '../site';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function fromAddress(): string {
	const configured = privateEnv.EMAIL_FROM?.trim();
	if (!configured) return 'Catplay <no-reply@catplay.org>';
	return configured.includes('<') ? configured : `Catplay <${configured}>`;
}

function escapeHtml(value: string | number | null | undefined): string {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

type EmailRow = { label: string; value: string };

/**
 * Inline-styled HTML mail that mirrors Catplay's UI: Inter text, light canvas,
 * rounded bordered card, muted labels, and a solid primary action button.
 * Email clients do not support Tailwind, so everything is intentionally inline.
 */
export function catplayEmail(options: {
	eyebrow?: string;
	title: string;
	intro: string;
	rows?: EmailRow[];
	code?: string;
	action?: { label: string; url: string };
	note?: string;
	footer?: string;
}): string {
	const rows = (options.rows ?? [])
		.map(
			(row) => `
				<tr>
					<td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font:14px/1.5 Inter,Arial,sans-serif;color:#71717a;">${escapeHtml(row.label)}</td>
					<td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font:600 14px/1.5 Inter,Arial,sans-serif;color:#18181b;word-break:break-word;">${escapeHtml(row.value)}</td>
				</tr>`
		)
		.join('');

	const codeBlock = options.code
		? `
			<div style="margin:28px 0;text-align:center;">
				<div style="display:inline-block;padding:16px 24px;border:1px solid #e4e4e7;border-radius:12px;background:#fafafa;font:700 34px/1.2 Inter,Arial,sans-serif;letter-spacing:10px;color:#18181b;">${escapeHtml(options.code)}</div>
				<p style="margin:10px 0 0;font:13px/1.5 Inter,Arial,sans-serif;color:#71717a;">This code expires soon. Do not share it with anyone.</p>
			</div>`
		: '';

	const actionBlock = options.action
		? `
			<div style="margin:28px 0;text-align:center;">
				<a href="${escapeHtml(options.action.url)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#18181b;color:#fafafa;text-decoration:none;font:700 14px/1 Inter,Arial,sans-serif;">${escapeHtml(options.action.label)}</a>
			</div>`
		: '';

	const noteBlock = options.note
		? `<p style="margin:20px 0 0;font:13px/1.6 Inter,Arial,sans-serif;color:#71717a;">${escapeHtml(options.note)}</p>`
		: '';

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width,initial-scale=1" />
		<title>${escapeHtml(options.title)}</title>
	</head>
	<body style="margin:0;padding:32px 12px;background:#fafafa;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;border-collapse:collapse;">
			<tr>
				<td style="padding:0 0 20px;text-align:center;">
					<img src="${escapeHtml(SITE_ORIGIN)}/catplay.png" alt="Catplay" width="40" height="40" style="display:inline-block;vertical-align:middle;border-radius:10px;" />
					<span style="margin-left:8px;vertical-align:middle;font:700 20px/1 Inter,Arial,sans-serif;color:#18181b;">${escapeHtml(SITE_NAME)}</span>
				</td>
			</tr>
			<tr>
				<td style="padding:32px;border:1px solid #e4e4e7;border-radius:14px;background:#ffffff;">
					${options.eyebrow ? `<p style="margin:0 0 8px;font:700 11px/1 Inter,Arial,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#71717a;">${escapeHtml(options.eyebrow)}</p>` : ''}
					<h1 style="margin:0;font:700 24px/1.3 Inter,Arial,sans-serif;color:#18181b;">${escapeHtml(options.title)}</h1>
					<p style="margin:14px 0 0;font:15px/1.65 Inter,Arial,sans-serif;color:#52525b;">${escapeHtml(options.intro)}</p>
					${codeBlock}
					${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">${rows}</table>` : ''}
					${actionBlock}
					${noteBlock}
				</td>
			</tr>
			<tr>
				<td style="padding:22px 8px 0;text-align:center;font:12px/1.6 Inter,Arial,sans-serif;color:#a1a1aa;">
					You are receiving this because of activity on your ${escapeHtml(SITE_NAME)} account.<br />
					Need help? <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:#52525b;text-decoration:underline;">${escapeHtml(CONTACT_EMAIL)}</a>
				</td>
			</tr>
		</table>
	</body>
</html>`;
}

export async function sendEmail(options: {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	replyTo?: string | string[];
}): Promise<boolean> {
	const apiKey = privateEnv.RESEND_API_KEY?.trim();
	if (!apiKey) {
		console.warn('[email] RESEND_API_KEY is not set; email was not sent:', options.subject);
		return false;
	}

	try {
		const response = await fetch(RESEND_ENDPOINT, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: fromAddress(),
				to: Array.isArray(options.to) ? options.to : [options.to],
				subject: options.subject,
				html: options.html,
				text: options.text,
				reply_to: options.replyTo
			})
		});

		if (!response.ok) {
			const detail = await response.text().catch(() => '');
			console.error('[email] Resend rejected message:', response.status, detail);
			return false;
		}
		return true;
	} catch (error) {
		console.error('[email] Failed to send message:', error);
		return false;
	}
}

export type EmailOtpType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

export async function sendVerificationCodeEmail(
	email: string,
	code: string,
	type: EmailOtpType,
	expiresInMinutes = 5
): Promise<boolean> {
	const titles: Record<EmailOtpType, string> = {
		'sign-in': 'Your Catplay sign-in code',
		'email-verification': 'Verify your Catplay email',
		'forget-password': 'Reset your Catplay password',
		'change-email': 'Confirm your new email address'
	};

	return sendEmail({
		to: email,
		subject: titles[type],
		html: catplayEmail({
			eyebrow: 'Account security',
			title: titles[type],
			intro:
				type === 'email-verification'
					? 'Enter this code in Catplay to finish creating your account.'
					: 'Use this one-time code to continue. It expires in a few minutes.',
			code,
			note: `This code expires in ${expiresInMinutes} minutes. If you did not request it, you can ignore this email.`
		}),
		text: `${titles[type]}\n\nYour code is ${code}. It expires in ${expiresInMinutes} minutes.`
	});
}

export async function sendMagicLinkEmail(email: string, url: string): Promise<boolean> {
	return sendEmail({
		to: email,
		subject: 'Your Catplay sign-in link',
		html: catplayEmail({
			eyebrow: 'One-tap sign in',
			title: 'Sign in to Catplay',
			intro: 'Click the button below to sign in without a password. The link can only be used once.',
			action: { label: 'Sign in to Catplay', url },
			note: 'If you did not request this link, you can safely ignore this email.'
		}),
		text: `Sign in to Catplay: ${url}\n\nIf you did not request this, ignore this email.`
	});
}

export async function sendPasswordResetEmail(email: string, url: string): Promise<boolean> {
	return sendEmail({
		to: email,
		subject: 'Reset your Catplay password',
		html: catplayEmail({
			eyebrow: 'Account security',
			title: 'Reset your password',
			intro: 'We received a request to reset your Catplay password. The button below expires soon.',
			action: { label: 'Choose a new password', url },
			note: 'If you did not request a password reset, you can ignore this email.'
		}),
		text: `Reset your Catplay password: ${url}\n\nIf you did not request this, ignore this email.`
	});
}

export async function sendEmailChangeConfirmationEmail(
	email: string,
	url: string
): Promise<boolean> {
	return sendEmail({
		to: email,
		subject: 'Confirm your new Catplay email',
		html: catplayEmail({
			eyebrow: 'Account security',
			title: 'Confirm your email change',
			intro: 'Confirm this address to finish changing the email on your Catplay account.',
			action: { label: 'Confirm new email', url },
			note: 'If you did not request an email change, you can safely ignore this email.'
		}),
		text: `Confirm your new Catplay email: ${url}\n\nIf you did not request this, ignore this email.`
	});
}

export type SecurityEvent =
	| 'SIGNED_IN'
	| 'PASSWORD_CHANGED'
	| 'EMAIL_CHANGED'
	| 'PASSKEY_ADDED'
	| 'PASSKEY_REMOVED'
	| 'TWO_FACTOR_ENABLED'
	| 'TWO_FACTOR_DISABLED';

const SECURITY_DETAILS: Record<SecurityEvent, { title: string; intro: string; note: string }> = {
	SIGNED_IN: {
		title: 'New sign-in to Catplay',
		intro: 'Your Catplay account was just signed in. If this was you, no further action is needed.',
		note: "If this wasn't you, change your password immediately."
	},
	PASSWORD_CHANGED: {
		title: 'Your password was changed',
		intro: 'Your Catplay password was just changed. If this was you, no further action is needed.',
		note: 'If you did not make this change, contact us immediately so we can secure your account.'
	},
	EMAIL_CHANGED: {
		title: 'Your email address was changed',
		intro: 'Your Catplay account email address was just changed. If this was you, no further action is needed.',
		note: 'If you did not make this change, contact us immediately so we can secure your account.'
	},
	PASSKEY_ADDED: {
		title: 'A passkey was added',
		intro: 'A new passkey was added to your Catplay account. If this was you, no further action is needed.',
		note: 'If you did not make this change, contact us immediately so we can secure your account.'
	},
	PASSKEY_REMOVED: {
		title: 'A passkey was removed',
		intro: 'A passkey was removed from your Catplay account. If this was you, no further action is needed.',
		note: 'If you did not make this change, contact us immediately so we can secure your account.'
	},
	TWO_FACTOR_ENABLED: {
		title: 'Two-factor authentication enabled',
		intro: 'Authenticator app protection was enabled on your Catplay account.',
		note: 'If you did not make this change, contact us immediately so we can secure your account.'
	},
	TWO_FACTOR_DISABLED: {
		title: 'Two-factor authentication disabled',
		intro: 'Authenticator app protection was removed from your Catplay account.',
		note: 'If you did not make this change, contact us immediately so we can secure your account.'
	}
};

export async function sendSecurityAlertEmail(
	email: string,
	event: SecurityEvent,
	details: EmailRow[] = []
): Promise<boolean> {
	const copy = SECURITY_DETAILS[event];
	return sendEmail({
		to: email,
		subject: `${copy.title} - Catplay`,
		html: catplayEmail({
			eyebrow: 'Security alert',
			title: copy.title,
			intro: copy.intro,
			rows: [
				{ label: 'Event', value: copy.title },
				...details,
				{ label: 'Time', value: new Date().toUTCString() }
			],
			note: copy.note
		}),
		text: `${copy.title}\n\n${copy.intro}\n\n${copy.note} Contact ${CONTACT_EMAIL} if you need help.`
	});
}
