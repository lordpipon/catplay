<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatPrice } from '$lib/utils';
	import { ADS, type ActiveAd } from '$lib/stores/ads';
	import CoinIcon from './CoinIcon.svelte';

	let { ad }: { ad?: ActiveAd | null } = $props();

	const src = $derived(ad ?? $ADS[0] ?? null);
	const change = $derived(Number(src?.coinChange24h ?? 0));
</script>

{#if src}
	<button
		class="group relative flex h-24 w-36 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-2 py-2 text-center transition-all hover:border-yellow-500/60 hover:bg-yellow-500/10"
		onclick={() => goto(`/coin/${src.coinSymbol}`)}
		title="Sponsored: {src.coinName}"
	>
		<span class="absolute top-1 right-1.5 text-[8px] font-semibold tracking-widest text-yellow-500/70 uppercase"
			>ad</span
		>
		<CoinIcon icon={src.coinIcon} symbol={src.coinSymbol} size={7} />
		<div class="w-full">
			<p class="truncate text-[11px] font-semibold leading-tight">{src.coinName}</p>
			<p class="text-muted-foreground truncate text-[9px]">{src.coinSymbol}</p>
		</div>
		<p class="font-mono text-[10px] font-bold">${formatPrice(Number(src.coinPrice))}</p>
		<span class="text-[9px] font-medium {change >= 0 ? 'text-green-500' : 'text-red-500'}">
			{change >= 0 ? '+' : ''}{change.toFixed(2)}%
		</span>
	</button>
{/if}