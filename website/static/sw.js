self.addEventListener('push', (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: 'Catplay', message: 'New notification' };
	}

	const title = data.title || 'Catplay';
	const options = {
		body: data.message || '',
		icon: '/catplay.png',
		badge: '/favicon-48x48.png',
		data: { url: data.url || '/' },
		tag: data.tag || 'catplay-notification'
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if ('focus' in client) {
					return client.navigate(url).then(() => client.focus()).catch(() => client.focus());
				}
			}
			return clients.openWindow(url);
		})
	);
});

function urlBase64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}

// The push service can rotate a subscription at any time; without this handler
// notifications would silently stop until the user re-enables the toggle.
self.addEventListener('pushsubscriptionchange', (event) => {
	event.waitUntil(
		(async () => {
			const keyRes = await fetch('/api/push/vapid-key');
			const { publicKey } = await keyRes.json();
			if (!publicKey) return;
			const subscription = await self.registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey)
			});
			await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(subscription.toJSON())
			});
		})()
	);
});
