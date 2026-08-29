import webpush from 'web-push';
import { db } from './db';
import { pushSubscription, notificationTypeEnum } from './db/schema';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { eq } from 'drizzle-orm';

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];

let configured = false;

function ensureConfigured() {
	if (configured) return;
	const publicKey = publicEnv.PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = env.VAPID_PRIVATE_KEY;
	const subject = env.VAPID_SUBJECT ?? 'mailto:admin@catplay.org';
	if (!publicKey || !privateKey) {
		console.warn('VAPID keys not configured; push notifications disabled.');
		return;
	}
	webpush.setVapidDetails(subject, publicKey, privateKey);
	configured = true;
}

export async function subscribePush(
	userId: number,
	subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
	await db
		.insert(pushSubscription)
		.values({
			userId,
			endpoint: subscription.endpoint,
			p256dh: subscription.keys.p256dh,
			auth: subscription.keys.auth
		})
		.onConflictDoNothing({ target: pushSubscription.endpoint });
}

export async function unsubscribePush(userId: number, endpoint: string): Promise<void> {
	await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, endpoint));
}

export async function hasPushSubscription(userId: number): Promise<boolean> {
	const rows = await db
		.select({ id: pushSubscription.id })
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, userId))
		.limit(1);
	return rows.length > 0;
}

export async function sendPushToUser(
	userId: number,
	payload: { title: string; message: string; url?: string; type?: NotificationType }
): Promise<void> {
	ensureConfigured();
	if (!configured) return;

	const subs = await db
		.select({
			endpoint: pushSubscription.endpoint,
			p256dh: pushSubscription.p256dh,
			auth: pushSubscription.auth
		})
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, userId));

	if (subs.length === 0) return;

	const body = JSON.stringify({
		title: payload.title,
		message: payload.message,
		url: payload.url ?? '/',
		type: payload.type ?? 'SYSTEM'
	});

	for (const sub of subs) {
		try {
			await webpush.sendNotification(
				{
					endpoint: sub.endpoint,
					keys: { p256dh: sub.p256dh, auth: sub.auth }
				},
				body
			);
		} catch (err: any) {
			// 404/410 = subscription no longer valid
			if (err?.statusCode === 404 || err?.statusCode === 410) {
				await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, sub.endpoint)).catch(() => {});
			} else {
				console.error('Failed to send push notification:', err);
			}
		}
	}
}
