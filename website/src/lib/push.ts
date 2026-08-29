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

	let subscription = await registration.pushManager.getSubscription();
	if (!subscription) {
		const permission = await requestPermissionIfNeeded();
		if (!permission) return false;

		const publicKey = getVapidPublicKey();
		if (!publicKey) return false;

		try {
			const keyBuffer = urlBase64ToUint8Array(publicKey);
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
		await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(subscription.toJSON())
		});
	} catch (err) {
		console.error('Failed to save push subscription:', err);
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
