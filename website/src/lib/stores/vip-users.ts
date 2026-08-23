import { writable } from 'svelte/store';

export const VIP_USERS = writable<Set<string>>(new Set());

let interval: ReturnType<typeof setInterval> | null = null;

export async function refreshVipUsers(): Promise<void> {
	try {
		const res = await fetch('/api/vip/badges');
		if (res.ok) {
			const data = await res.json();
			VIP_USERS.set(new Set(data.vips));
		}
	} catch {
		// ignore
	}
}

export function startVipUserPolling(): void {
	if (interval) return;
	refreshVipUsers();
	interval = setInterval(refreshVipUsers, 60_000);
}
