<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatPrice } from '$lib/utils';
	import { ADS } from '$lib/stores/ads';
	import CoinIcon from './CoinIcon.svelte';

	let { hideAds = false }: { hideAds?: boolean } = $props();

	let showRight = $state(false);
	let showLeft = $state(false);
	let idxRight = $state(0);
	let idxLeft = $state(1);

	function measure() {
		const vw = window.innerWidth;
		const sidebarW = 256;
		const panelW = 140;
		const contentMax = 1280;

		const insetW = vw - sidebarW;
		const contentW = Math.min(insetW, contentMax);
		const leftGap = (insetW - contentW) / 2;
		const rightGap = vw - sidebarW - contentW - leftGap;

		showRight = rightGap >= panelW + 16;
		showLeft = leftGap >= panelW + 24;
	}

	onMount(() => {
		measure();
		window.addEventListener('resize', measure);

		const t = setInterval(() => {
			if ($ADS.length > 1) {
				idxRight = (idxRight + 1) % $ADS.length;
				idxLeft = (idxLeft + 1) % $ADS.length;
			}
		}, 8_000);

		return () => {
			clearInterval(t);
			window.removeEventListener('resize', measure);
		};
	});

	const adRight = $derived($ADS[idxRight % Math.max(1, $ADS.length)] ?? null);
	const adLeft = $derived($ADS[idxLeft % Math.max(1, $ADS.length)] ?? null);
</script>

{#if !hideAds && $ADS.length > 0}
	{#if showRight && adRight}
		{@const change = Number(adRight.coinChange24h ?? 0)}
		<div class="pointer-events-none fixed right-0 top-12 z-30 p-2" style="width: 140px;">
			<button
				class="pointer-events-auto flex w-full flex-col items-center gap-1 rounded-lg border border-yellow-500/30 bg-background/95 px-2 py-2.5 text-center shadow-md backdrop-blur-sm transition-all hover:border-yellow-500/60 hover:bg-yellow-500/5"
				onclick={() => goto(`/coin/${adRight.coinSymbol}`)}
			>
				<span class="text-[8px] font-semibold tracking-widest text-yellow-500/60 uppercase">ad</span>
				<CoinIcon icon={adRight.coinIcon} symbol={adRight.coinSymbol} size={8} />
				<p class="w-full truncate text-[10px] font-bold">{adRight.coinName}</p>
				<p class="text-muted-foreground text-[9px]">{adRight.coinSymbol}</p>
				<p class="font-mono text-[9px] font-bold">${formatPrice(Number(adRight.coinPrice))}</p>
				<p class="text-[9px] font-medium {change >= 0 ? 'text-green-500' : 'text-red-500'}">
					{change >= 0 ? '+' : ''}{change.toFixed(2)}%
				</p>
			</button>
		</div>
	{/if}

	{#if showLeft && adLeft}
		{@const change = Number(adLeft.coinChange24h ?? 0)}
		<div class="pointer-events-none fixed top-12 z-30 p-2" style="left: 256px; width: 140px;">
			<button
				class="pointer-events-auto flex w-full flex-col items-center gap-1 rounded-lg border border-yellow-500/30 bg-background/95 px-2 py-2.5 text-center shadow-md backdrop-blur-sm transition-all hover:border-yellow-500/60 hover:bg-yellow-500/5"
				onclick={() => goto(`/coin/${adLeft.coinSymbol}`)}
			>
				<span class="text-[8px] font-semibold tracking-widest text-yellow-500/60 uppercase">ad</span>
				<CoinIcon icon={adLeft.coinIcon} symbol={adLeft.coinSymbol} size={8} />
				<p class="w-full truncate text-[10px] font-bold">{adLeft.coinName}</p>
				<p class="text-muted-foreground text-[9px]">{adLeft.coinSymbol}</p>
				<p class="font-mono text-[9px] font-bold">${formatPrice(Number(adLeft.coinPrice))}</p>
				<p class="text-[9px] font-medium {change >= 0 ? 'text-green-500' : 'text-red-500'}">
					{change >= 0 ? '+' : ''}{change.toFixed(2)}%
				</p>
			</button>
		</div>
	{/if}
{/if}