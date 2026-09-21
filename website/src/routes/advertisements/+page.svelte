<script lang="ts">
	import { GemIcon, MegaphoneIcon, PlusSignIcon, Clock01Icon } from '@hugeicons/core-free-icons';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { formatPrice, formatTimeUntil } from '$lib/utils';
	import CoinIcon from '$lib/components/self/CoinIcon.svelte';
	import CreateAdModal from '$lib/components/self/CreateAdModal.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { GEMS_BALANCE, fetchGemsBalance } from '$lib/stores/gems';
	import { USER_DATA } from '$lib/stores/user-data';
	import { AD_DURATIONS } from '$lib/data/constants';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let myAds = $state<any[]>([]);
	let loading = $state(true);
	let page = $state(1);
	let hasMore = $state(false);
	let createModalOpen = $state(false);
	let extendingAdId = $state<number | null>(null);
	let extendHours = $state<string>(String(AD_DURATIONS[0].hours));
	let extendLoading = $state(false);

	const activeAds = $derived(myAds.filter((a) => new Date(a.expiresAt).getTime() > Date.now()));
	const pastAds = $derived(myAds.filter((a) => new Date(a.expiresAt).getTime() <= Date.now()));

	async function loadAds(p = 1) {
		loading = true;
		try {
			const res = await fetch(`/api/ads/mine?page=${p}`);
			if (!res.ok) return;
			const data = await res.json();
			myAds = p === 1 ? data.ads : [...myAds, ...data.ads];
			hasMore = data.hasMore;
			page = p;
		} catch {
			toast.error('Failed to load ads');
		} finally {
			loading = false;
		}
	}

	async function extendAd() {
		if (!extendingAdId) return;
		extendLoading = true;
		try {
			const res = await fetch(`/api/ads/${extendingAdId}/extend`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ durationHours: Number(extendHours) })
			});
			const data = await res.json();
			if (!res.ok) {
				toast.error(data.message ?? 'Failed to extend');
				return;
			}
			toast.success('Ad extended!');
			extendingAdId = null;
			await loadAds(1);
			fetchGemsBalance();
		} catch {
			toast.error('Something went wrong');
		} finally {
			extendLoading = false;
		}
	}

	onMount(() => {
		if (!$USER_DATA) {
			goto('/');
			return;
		}
		loadAds();
		fetchGemsBalance();
	});
</script>

<CreateAdModal bind:open={createModalOpen} userGems={$GEMS_BALANCE ?? 0} oncreated={() => loadAds(1)} />

<div class="container mx-auto max-w-4xl p-6">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="flex items-center gap-3 text-3xl font-bold">
				<HugeiconsIcon icon={MegaphoneIcon} class="text-yellow-500 h-8 w-8" />
				Advertisements
			</h1>
			<p class="text-muted-foreground mt-1 text-sm">Manage your sponsored coin promotions</p>
		</div>
		<div class="flex items-center gap-3">
			<div class="text-muted-foreground flex items-center gap-1 text-sm">
				<HugeiconsIcon icon={GemIcon} class="text-purple-400 h-4 w-4" />
				<span class="font-mono font-semibold">{($GEMS_BALANCE ?? 0).toLocaleString()}</span> gems
			</div>
			<Button class="bg-yellow-500 text-black hover:bg-yellow-400" onclick={() => (createModalOpen = true)}>
				<HugeiconsIcon icon={PlusSignIcon} class="h-4 w-4" />
				New Ad
			</Button>
		</div>
	</div>

	{#if activeAds.length > 0}
		<h2 class="mb-3 text-lg font-semibold">Active</h2>
		<div class="mb-8 space-y-3">
			{#each activeAds as ad (ad.id)}
				{@const change = Number(ad.coinChange24h ?? 0)}
				<Card.Root class="border-yellow-500/30 bg-yellow-500/5">
					<Card.Content class="flex items-center gap-4 py-4">
						<CoinIcon icon={ad.coinIcon} symbol={ad.coinSymbol} size={10} />
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="font-bold">{ad.coinName}</p>
								<Badge variant="outline" class="text-[10px]">{ad.coinSymbol}</Badge>
								<Badge class="border-green-500/30 bg-green-500/10 text-green-500 text-[10px]">Live</Badge>
							</div>
							<div class="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
								<span class="flex items-center gap-1">
									<HugeiconsIcon icon={Clock01Icon} class="h-3 w-3" />
									{formatTimeUntil(ad.expiresAt)} left
								</span>
								<span class="font-mono">${formatPrice(Number(ad.coinPrice))}</span>
								<span class="{change >= 0 ? 'text-green-500' : 'text-red-500'}">
									{change >= 0 ? '+' : ''}{change.toFixed(2)}%
								</span>
								<span class="flex items-center gap-1">
									<HugeiconsIcon icon={GemIcon} class="text-purple-400 h-3 w-3" />
									{Number(ad.totalCost).toLocaleString()} paid
								</span>
							</div>
						</div>

						{#if extendingAdId === ad.id}
							<div class="flex items-center gap-2">
								<Select.Root type="single" bind:value={extendHours}>
									<Select.Trigger class="w-32 text-xs">
										{AD_DURATIONS.find((d) => d.hours === Number(extendHours))?.hours}h —{' '}
										{AD_DURATIONS.find((d) => d.hours === Number(extendHours))?.cost.toLocaleString()} 💎
									</Select.Trigger>
									<Select.Content>
										{#each AD_DURATIONS as d}
											<Select.Item value={String(d.hours)} class="text-xs">
												+{d.hours}h — {d.cost.toLocaleString()} gems
											</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<Button
									size="sm"
									onclick={extendAd}
									disabled={extendLoading}
									class="bg-yellow-500 text-black hover:bg-yellow-400"
								>
									{extendLoading ? '…' : 'Confirm'}
								</Button>
								<Button size="sm" variant="ghost" onclick={() => (extendingAdId = null)}>Cancel</Button>
							</div>
						{:else}
							<Button
								size="sm"
								variant="outline"
								onclick={() => {
									extendingAdId = ad.id;
									extendHours = String(AD_DURATIONS[0].hours);
								}}
							>
								Extend
							</Button>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}

	{#if pastAds.length > 0}
		<h2 class="text-muted-foreground mb-3 text-lg font-semibold">Past</h2>
		<div class="space-y-2">
			{#each pastAds as ad (ad.id)}
				<Card.Root class="opacity-60">
					<Card.Content class="flex items-center gap-4 py-3">
						<CoinIcon icon={ad.coinIcon} symbol={ad.coinSymbol} size={8} />
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<p class="text-sm font-semibold">{ad.coinName}</p>
								<Badge variant="outline" class="text-[10px]">{ad.coinSymbol}</Badge>
								<Badge variant="secondary" class="text-[10px]">Expired</Badge>
							</div>
							<div class="text-muted-foreground mt-0.5 flex flex-wrap gap-3 text-xs">
								<span>Ran for {ad.durationHours}h</span>
								<span class="flex items-center gap-1">
									<HugeiconsIcon icon={GemIcon} class="text-purple-400 h-3 w-3" />
									{Number(ad.totalCost).toLocaleString()} spent
								</span>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
		{#if hasMore}
			<div class="mt-4 flex justify-center">
				<Button variant="outline" onclick={() => loadAds(page + 1)} disabled={loading}>
					{loading ? 'Loading…' : 'Load more'}
				</Button>
			</div>
		{/if}
	{/if}

	{#if !loading && myAds.length === 0}
		<div class="flex flex-col items-center justify-center py-24 text-center">
			<HugeiconsIcon icon={MegaphoneIcon} class="text-muted-foreground mb-4 h-16 w-16" />
			<p class="text-muted-foreground text-lg">No advertisements yet</p>
			<p class="text-muted-foreground mb-6 text-sm">Hold at least 5% of a coin to start advertising it</p>
			<Button class="bg-yellow-500 text-black hover:bg-yellow-400" onclick={() => (createModalOpen = true)}>
				Create Your First Ad
			</Button>
		</div>
	{/if}
</div>