import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';

const SW_PATH = '/sw.js';

function isSupported(): boolean {
	return browser && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function isPushSupported(): boolean {
	return isSupported();
}

export function getVapidPublicKey(): string {
	return env.PUBLIC_VAPID_PUBLIC_KEY ?? '';
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (!isSupported()) return null;
	try {
		return await navigator.serviceWorker.register(SW_PATH);
	} catch (err) {
		console.error('Failed to register service worker:', err);
		return null;
	}
}

export async function requestPermissionIfNeeded(): Promise<boolean> {
	if (!isSupported()) return false;
	if (!('Notification' in window)) return false;
	if (Notification.permission === 'granted') return true;
	if (Notification.permission === 'denied') return false;
	const result = await Notification.requestPermission();
	return result === 'granted';
}

/** Ensure SW registered + subscribed. Returns true if an active subscription now exists. */
export async function ensurePushSubscription(): Promise<boolean> {
	if (!isSupported()) return false;

	const registration = await getRegistration();
	if (!registration) return false;

	const publicKey = getVapidPublicKey();
	if (!publicKey) return false;

	const keyBuffer = urlBase64ToUint8Array(publicKey);

	let subscription = await registration.pushManager.getSubscription();
	if (subscription) {
		// If the existing subscription was created with a different application
		// server key (e.g. VAPID keys rotated), Chrome will refuse to reuse it.
		try {
			const existingKey = subscription.options?.applicationServerKey;
			const existingBytes =
				existingKey instanceof ArrayBuffer
					? new Uint8Array(existingKey)
					: ArrayBuffer.isView(existingKey)
						? new Uint8Array(existingKey.buffer, existingKey.byteOffset, existingKey.byteLength)
						: null;
			const matchesKey =
				existingBytes !== null &&
				existingBytes.length === keyBuffer.length &&
				existingBytes.every((b, i) => b === keyBuffer[i]);
			if (!matchesKey) {
				await subscription.unsubscribe();
				subscription = null;
			}
		} catch (err) {
			console.error('Failed to inspect existing push subscription:', err);
		}
	}

	if (!subscription) {
		const permission = await requestPermissionIfNeeded();
		if (!permission) return false;

		try {
			subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: keyBuffer
			});
		} catch (err) {
			console.error('Failed to subscribe to push:', err);
			return false;
		}
	}

	try {
		const res = await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(subscription.toJSON())
		});
		if (!res.ok) {
			console.error('Failed to save push subscription:', res.status, await res.text());
			return false;
		}
	} catch (err) {
		console.error('Failed to save push subscription:', err);
		return false;
	}
	return true;
}

export async function disablePushNotifications(): Promise<void> {
	if (!isSupported()) return;

	const registration = await getRegistration();
	if (!registration) return;

	const subscription = await registration.pushManager.getSubscription();
	if (subscription) {
		try {
			await fetch('/api/push/unsubscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(subscription.toJSON())
			});
		} catch (err) {
			console.error('Failed to remove push subscription:', err);
		}
		await subscription.unsubscribe();
	}
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}
