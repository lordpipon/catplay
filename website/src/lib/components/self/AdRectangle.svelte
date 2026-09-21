<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatPrice } from '$lib/utils';
	import { ADS } from '$lib/stores/ads';
	import CoinIcon from './CoinIcon.svelte';

	let {
		hideAds = false,
		class: className = ''
	}: {
		hideAds?: boolean;
		class?: string;
	} = $props();

	let idx = $state(0);

	$effect(() => {
		const t = setInterval(() => {
			if ($ADS.length > 1) idx = (idx + 1) % $ADS.length;
		}, 8_000);
		return () => clearInterval(t);
	});

	const ad = $derived($ADS[idx] ?? null);
</script>

{#if !hideAds && ad}
	{@const change = Number(ad.coinChange24h ?? 0)}
	<div class="flex justify-center {className}">
		<button
			class="group flex h-[200px] w-[260px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-yellow-500/25 bg-gradient-to-b from-yellow-500/5 to-background p-5 text-center shadow-sm transition-all hover:border-yellow-500/50 hover:shadow-md"
			onclick={() => goto(`/coin/${ad.coinSymbol}`)}
		>
			<span class="text-muted-foreground self-end text-[9px] font-semibold tracking-widest uppercase"
				>sponsored</span
			>
			<CoinIcon icon={ad.coinIcon} symbol={ad.coinSymbol} size={12} />
			<div>
				<p class="font-bold">{ad.coinName}</p>
				<p class="text-muted-foreground text-xs">{ad.coinSymbol}</p>
				<p class="font-mono text-xs font-bold">${formatPrice(Number(ad.coinPrice))}</p>
			</div>
			<span
				class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold {change >= 0 ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}"
			>
				{change >= 0 ? '+' : ''}{change.toFixed(2)}% 24h
			</span>
			<p class="text-primary text-[11px] font-medium underline-offset-2 group-hover:underline">View Coin →</p>
		</button>
	</div>
{/if}