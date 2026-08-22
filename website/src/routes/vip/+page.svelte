<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import SEO from '$lib/components/self/SEO.svelte';
	import { toast } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CrownIcon, GemIcon, CheckmarkCircle01Icon, Ticket01Icon, Coins01Icon, DiscordIcon } from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { goto } from '$app/navigation';

	interface VipStatus { isVip: boolean; gems: number; cost: number; expiresAt: string | null; }
	let status = $state<VipStatus | null>(null);
	let loading = $state(true);
	let buying = $state(false);

	const PERKS = [
		{ icon: Ticket01Icon, title: 'Premium Battlepass', desc: 'Unlock all premium tier rewards each season' },
		{ icon: CrownIcon, title: 'VIP Crown Badge', desc: 'Crown badge shown on your profile and sidebar' },
		{ icon: Coins01Icon, title: 'Arcade Bonus', desc: '5% extra on all arcade winnings (coming soon)' },
		{ icon: DiscordIcon, title: 'Discord VIP Role', desc: 'Exclusive VIP role in the Catplay Discord server' },
	];

	function formatExpiry(isoDate: string): string {
		const d = new Date(isoDate);
		return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	}

	function daysLeft(isoDate: string): number {
		return Math.max(0, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 86400000));
	}

	onMount(async () => {
		if (!$USER_DATA) { goto('/'); return; }
		try {
			const res = await fetch('/api/vip');
			if (res.ok) status = await res.json();
		} finally { loading = false; }
	});

	async function purchaseVip() {
		if (!status || buying) return;
		buying = true;
		try {
			const res = await fetch('/api/vip', { method: 'POST' });
			const data = await res.json();
			if (!res.ok) { toast.error(data.error || 'Failed to purchase VIP'); return; }
			status = { ...status, isVip: true, gems: data.newGems, expiresAt: data.expiresAt };
			toast.success(status.expiresAt ? `VIP active until ${formatExpiry(status.expiresAt)}!` : 'VIP activated!');
		} finally { buying = false; }
	}
</script>

<SEO title="VIP Status | Catplay" description="Unlock premium features with VIP status." />

<div class="mx-auto max-w-xl space-y-6 p-4">
	<div class="flex items-center gap-3">
		<HugeiconsIcon icon={CrownIcon} class="h-7 w-7 text-yellow-500" />
		<div>
			<h1 class="text-2xl font-bold">VIP Status</h1>
			<p class="text-muted-foreground text-sm">1 month of premium perks for 1,000 gems</p>
		</div>
	</div>

	{#if loading}
		<Card.Root><Card.Content class="p-8"><div class="animate-pulse h-8 bg-muted rounded w-1/2 mx-auto"></div></Card.Content></Card.Root>
	{:else}
		<!-- Status card -->
		{#if status?.isVip && status.expiresAt}
			<Card.Root class="border-yellow-500/50 bg-yellow-500/5">
				<Card.Content class="p-5">
					<div class="flex items-center gap-4">
					<HugeiconsIcon icon={CrownIcon} class="h-9 w-9 text-yellow-500" />
						<div class="flex-1">
							<p class="font-bold text-yellow-500 text-lg">VIP Active</p>
							<p class="text-muted-foreground text-sm">Expires {formatExpiry(status.expiresAt)} · {daysLeft(status.expiresAt)} days left</p>
						</div>
					</div>
					<div class="mt-4 pt-4 border-t border-yellow-500/20">
						<p class="text-sm text-muted-foreground mb-3">Extend your VIP for another 30 days:</p>
						<Button
							class="w-full bg-yellow-500 text-black hover:bg-yellow-400 font-bold"
							onclick={purchaseVip}
							disabled={buying || (status?.gems ?? 0) < (status?.cost ?? 1000)}
						>
							<HugeiconsIcon icon={GemIcon} class="h-4 w-4 mr-1" />
							{buying ? 'Processing...' : (status?.gems ?? 0) < 1000 ? `Need ${(1000 - (status?.gems ?? 0)).toLocaleString()} more gems` : `Extend — 1,000 Gems (have ${status.gems.toLocaleString()})`}
						</Button>
					</div>
				</Card.Content>
			</Card.Root>
		{:else}
			<Card.Root class="border-yellow-500/30">
				<Card.Content class="p-5 space-y-4">
					<div class="flex items-center justify-between">
						<div>
							<h2 class="text-lg font-bold">Become VIP</h2>
							<p class="text-muted-foreground text-sm">30-day subscription, renewable anytime</p>
						</div>
						<div class="text-right">
							<div class="flex items-center gap-1 text-2xl font-bold text-purple-400">
								<HugeiconsIcon icon={GemIcon} class="h-6 w-6" />
								1,000
							</div>
							<p class="text-muted-foreground text-xs">per month</p>
						</div>
					</div>
					<div class="flex justify-between text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
						<span>Your gems</span>
						<span class="font-medium text-purple-400">{status?.gems.toLocaleString() ?? 0}</span>
					</div>
					<Button
						class="w-full bg-yellow-500 text-black hover:bg-yellow-400 h-12 text-base font-bold"
						onclick={purchaseVip}
						disabled={buying || (status?.gems ?? 0) < 1000}
					>
						{buying ? 'Processing...' : (status?.gems ?? 0) < 1000 ? `Need ${(1000 - (status?.gems ?? 0)).toLocaleString()} more gems` : 'Activate VIP — 1,000 Gems / month'}
					</Button>
					{#if (status?.gems ?? 0) < 1000}
						<p class="text-center text-xs text-muted-foreground">
							Get gems in the <a href="/shop" class="text-purple-400 hover:underline">Shop</a> or through events & promo codes.
						</p>
					{/if}
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Perks -->
		<div>
			<h3 class="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">VIP Perks</h3>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{#each PERKS as perk}
					<Card.Root class={status?.isVip ? 'border-yellow-500/20' : ''}>
						<Card.Content class="p-3 flex items-start gap-3">
							<HugeiconsIcon icon={perk.icon} class="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
							<div class="flex-1">
								<p class="font-medium text-sm">{perk.title}</p>
								<p class="text-muted-foreground text-xs mt-0.5">{perk.desc}</p>
							</div>
							{#if status?.isVip}
								<HugeiconsIcon icon={CheckmarkCircle01Icon} class="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
							{/if}
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</div>
	{/if}
</div>
