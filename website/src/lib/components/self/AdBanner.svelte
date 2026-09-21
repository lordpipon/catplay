<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatPrice } from '$lib/utils';
	import CoinIcon from './CoinIcon.svelte';
	import type { ActiveAd } from '$lib/stores/ads';

	let {
		hideAds = false,
		ads = []
	}: {
		hideAds?: boolean;
		ads?: ActiveAd[];
	} = $props();
</script>

{#if !hideAds && ads.length > 0}
	<div class="flex w-full items-center justify-center border-b bg-muted/30 py-1.5">
		<div class="flex h-16 w-full max-w-[728px] items-center gap-2 overflow-hidden rounded border border-yellow-500/20 bg-background px-3">
			<span
				class="text-muted-foreground shrink-0 rotate-180 text-[9px] font-semibold tracking-widest uppercase"
				style="writing-mode: vertical-rl"
				>ad</span
			>
			<div class="flex flex-1 gap-2 overflow-x-auto scrollbar-none">
				{#each ads as ad (ad.id)}
					{@const change = Number(ad.coinChange24h ?? 0)}
					<button
						class="flex shrink-0 items-center gap-2 rounded border border-yellow-500/30 bg-yellow-500/5 px-3 py-1.5 transition-all hover:border-yellow-500/50 hover:bg-yellow-500/10"
						onclick={() => goto(`/coin/${ad.coinSymbol}`)}
					>
						<CoinIcon icon={ad.coinIcon} symbol={ad.coinSymbol} size={7} />
						<div class="text-left">
							<p class="text-xs font-bold leading-tight">{ad.coinName}</p>
							<p class="font-mono text-[10px] font-semibold">${formatPrice(Number(ad.coinPrice))}</p>
							<p class="text-[10px] font-medium {change >= 0 ? 'text-green-500' : 'text-red-500'}">
								{change >= 0 ? '+' : ''}{change.toFixed(2)}%
							</p>
						</div>
					</button>
				{/each}
			</div>
			<span class="text-muted-foreground shrink-0 text-[9px]">Sponsored</span>
		</div>
	</div>
{/if}