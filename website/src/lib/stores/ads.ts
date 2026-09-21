import { writable } from 'svelte/store';

export interface ActiveAd {
	id: number;
	expiresAt: string;
	coinName: string;
	coinSymbol: string;
	coinIcon: string | null;
	coinPrice: string;
	coinChange24h: string;
}

export const ADS = writable<ActiveAd[]>([]);

let timer: ReturnType<typeof setInterval> | null = null;
let fetching = false;

export async function fetchAds() {
	if (fetching) return;
	fetching = true;
	try {
		const res = await fetch('/api/ads/active?limit=15');
		if (res.ok) ADS.set(await res.json());
	} catch {
		// ignore
	} finally {
		fetching = false;
	}
}

export function initAds() {
	fetchAds();
	if (!timer) timer = setInterval(fetchAds, 30_000);
}

export function destroyAds() {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
}