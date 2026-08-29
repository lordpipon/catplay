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
					client.navigate(url);
					return client.focus();
				}
			}
			return clients.openWindow(url);
		})
	);
});
