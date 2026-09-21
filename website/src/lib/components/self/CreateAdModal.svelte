<script lang="ts">
	import { GemIcon, MegaphoneIcon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { formatPrice } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { AD_DURATIONS } from '$lib/data/constants';
	import CoinIcon from './CoinIcon.svelte';

	let {
		userGems,
		preselectedCoinId = null,
		open = $bindable(false),
		oncreated = () => {}
	}: {
		userGems: number;
		preselectedCoinId?: number | null;
		open?: boolean;
		oncreated?: () => void;
	} = $props();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let eligible = $state<any[]>([]);
	let loadingEligible = $state(false);
	let selectedCoinId = $state<number | null>(preselectedCoinId);
	let selectedHours = $state<number>(AD_DURATIONS[0].hours);
	let loading = $state(false);

	const dur = $derived(AD_DURATIONS.find((d) => d.hours === selectedHours)!);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const selectedCoin = $derived(eligible.find((c) => c.coinId === selectedCoinId) ?? null);
	const canSubmit = $derived(
		!!selectedCoinId && userGems >= dur.cost && selectedCoin && !selectedCoin.hasActiveAd
	);

	async function loadEligible() {
		loadingEligible = true;
		try {
			const res = await fetch('/api/ads/eligible');
			if (res.ok) {
				eligible = await res.json();
				if (preselectedCoinId && eligible.some((c) => c.coinId === preselectedCoinId)) {
					selectedCoinId = preselectedCoinId;
				} else if (eligible.length > 0 && !selectedCoinId) {
					selectedCoinId = eligible[0].coinId;
				}
			}
		} catch {
			// ignore
		} finally {
			loadingEligible = false;
		}
	}

	$effect(() => {
		if (open) loadEligible();
	});

	async function submit() {
		if (!selectedCoinId) return;
		loading = true;
		try {
			const res = await fetch('/api/ads/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ coinId: selectedCoinId, durationHours: selectedHours })
			});
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.message ?? 'Failed to create ad');
				return;
			}
			toast.success(`Ad for ${selectedCoin?.coinSymbol} is now live!`);
			open = false;
			oncreated();
			invalidateAll();
		} catch {
			toast.error('Something went wrong');
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={MegaphoneIcon} class="h-5 w-5 text-yellow-500" />
				Create Advertisement
			</Dialog.Title>
			<Dialog.Description>
				Choose a coin you hold ≥5% of to advertise. One active ad per coin at a time.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-2">
			<p class="text-sm font-medium">Select Coin</p>
			{#if loadingEligible}
				<p class="text-muted-foreground py-4 text-center text-sm">Loading…</p>
			{:else if eligible.length === 0}
				<p class="text-muted-foreground py-4 text-center text-sm">You don't hold ≥5% of any coin yet.</p>
			{:else}
				<div class="max-h-48 space-y-1.5 overflow-y-auto pr-1">
					{#each eligible as c (c.coinId)}
						<button
							class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all
								{selectedCoinId === c.coinId ? 'border-yellow-500 bg-yellow-500/10' : 'hover:border-muted-foreground/40 border-transparent bg-muted/40'}
								{c.hasActiveAd ? 'opacity-50' : 'cursor-pointer'}"
							onclick={() => {
								if (!c.hasActiveAd) selectedCoinId = c.coinId;
							}}
							disabled={c.hasActiveAd}
							title={c.hasActiveAd ? 'This coin already has an active ad' : ''}
						>
							<CoinIcon icon={c.coinIcon} symbol={c.coinSymbol} size={8} />
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold">
									{c.coinName} <span class="text-muted-foreground font-normal">({c.coinSymbol})</span>
								</p>
								<p class="text-muted-foreground text-xs">
									${formatPrice(Number(c.coinPrice))} · {(c.pct * 100).toFixed(1)}% held
									{#if c.hasActiveAd}<span class="text-yellow-500"> · Ad running</span>{/if}
								</p>
							</div>
							{#if selectedCoinId === c.coinId}
								<span class="h-2 w-2 shrink-0 rounded-full bg-yellow-500"></span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="space-y-2">
			<p class="text-sm font-medium">Duration</p>
			<div class="grid grid-cols-3 gap-1.5">
				{#each AD_DURATIONS as d}
					{@const affordable = userGems >= d.cost}
					<button
						class="flex flex-col items-center rounded-lg border px-2 py-2 text-center transition-all
							{selectedHours === d.hours ? 'border-yellow-500 bg-yellow-500/10' : 'hover:border-muted-foreground/40 border-transparent bg-muted/40'}
							{!affordable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}"
						onclick={() => {
							if (affordable) selectedHours = d.hours;
						}}
						disabled={!affordable}
					>
						<p class="text-xs font-bold">{d.hours < 24 ? `${d.hours}h` : `${d.hours / 24}d`}</p>
						<p class="text-muted-foreground flex items-center gap-0.5 text-[10px]">
							<HugeiconsIcon icon={GemIcon} class="h-2.5 w-2.5 text-purple-400" />
							{d.cost.toLocaleString()}
						</p>
					</button>
				{/each}
			</div>
		</div>

		<div class="text-muted-foreground flex items-center justify-between border-t pt-3 text-sm">
			<span>Your gems</span>
			<span class="flex items-center gap-1 font-mono">
				<HugeiconsIcon icon={GemIcon} class="h-3.5 w-3.5 text-purple-400" />
				{userGems.toLocaleString()}
			</span>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button
				class="bg-yellow-500 text-black hover:bg-yellow-400"
				onclick={submit}
				disabled={loading || !canSubmit}
			>
				{loading ? 'Publishing…' : `Spend ${dur.cost.toLocaleString()} 💎 & Go Live`}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>