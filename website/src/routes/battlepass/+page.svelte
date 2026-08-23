<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import SEO from '$lib/components/self/SEO.svelte';
	import { toast } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { CrownIcon, Tick01Icon, LockIcon, GiftIcon, Award01Icon } from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { goto } from '$app/navigation';
	import { formatValue } from '$lib/utils';

	interface Season { id: number; name: string; description: string; startsAt: string; endsAt: string; isActive: boolean; }
	interface Tier { id: number; seasonId: number; level: number; tier: string; taskDescription: string; taskType: string; taskTarget: number; rewardType: string; rewardAmount: string; rewardLabel: string; }
	interface Progress { level: number; xp: number; claimedTiers: string; }

	let season = $state<Season | null>(null);
	let tiers = $state<Tier[]>([]);
	let progress = $state<Progress | null>(null);
	let isVip = $state(false);
	let counts = $state<Record<string, number>>({});
	let loading = $state(true);
	let claiming = $state<number | null>(null);

	let claimedIds = $derived<number[]>(progress ? JSON.parse(progress.claimedTiers || '[]') : []);
	let levels = $derived([...new Set(tiers.map(t => t.level))].sort((a, b) => a - b));
	let currentLevel = $derived(progress?.level ?? 0);

	function tierForLevel(tierType: 'free' | 'premium', level: number): Tier | undefined {
		return tiers.find(t => t.tier === tierType && t.level === level);
	}

	function isTierComplete(tier: Tier): boolean {
		if (tier.taskType === 'manual') return false;
		return (counts[tier.taskType] ?? 0) >= tier.taskTarget;
	}

	function canClaim(tier: Tier): boolean {
		if (!progress || !season) return false;
		if (claimedIds.includes(tier.id)) return false;
		if (tier.tier === 'premium' && !isVip) return false;
		if (!isTierComplete(tier) && tier.taskType !== 'manual') return false;
		return progress.level >= tier.level;
	}

	function taskProgress(tier: Tier): { current: number; target: number; pct: number } {
		const current = Math.min(counts[tier.taskType] ?? 0, tier.taskTarget);
		return { current, target: tier.taskTarget, pct: Math.min(100, Math.round((current / tier.taskTarget) * 100)) };
	}

	function formatCount(n: number): string {
		if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
		if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
		if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
		return n.toLocaleString();
	}

	async function load() {
		const res = await fetch('/api/battlepass');
		if (res.ok) {
			const d = await res.json();
			season = d.season;
			tiers = d.tiers;
			progress = d.progress;
			isVip = d.isVip;
			counts = d.counts ?? {};
		}
		loading = false;
	}

	onMount(async () => {
		if (!$USER_DATA) { goto('/'); return; }
		await load();
	});

	let claimingAll = $state(false);

	let claimableTiers = $derived(tiers.filter(tier => canClaim(tier)));

	async function claimAll() {
		if (claimingAll || claimableTiers.length === 0) return;
		claimingAll = true;
		let claimed = 0;
		let failed = 0;
		for (const tier of claimableTiers) {
			try {
				const res = await fetch('/api/battlepass', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ action: 'claim', tierId: tier.id })
				});
				if (res.ok) claimed++; else failed++;
			} catch { failed++; }
		}
		await load();
		claimingAll = false;
		if (claimed > 0) toast.success(`Claimed ${claimed} reward${claimed !== 1 ? 's' : ''}!`);
		if (failed > 0) toast.error(`${failed} reward${failed !== 1 ? 's' : ''} failed to claim`);
	}

	async function claim(tier: Tier) {
		claiming = tier.id;
		try {
			const res = await fetch('/api/battlepass', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'claim', tierId: tier.id })
			});
			const d = await res.json();
			if (!res.ok) { toast.error(d.error || 'Failed to claim'); return; }
			toast.success(`Claimed: ${tier.rewardLabel || d.reward?.label}`);
			await load();
		} finally { claiming = null; }
	}
</script>

<SEO title="Battlepass" description="Complete tasks and earn rewards in the Catplay Battlepass." />

<div class="mx-auto max-w-4xl space-y-6 p-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<HugeiconsIcon icon={Award01Icon} class="h-7 w-7 text-yellow-500" />
			<div>
				<h1 class="text-2xl font-bold">Battlepass</h1>
				<p class="text-muted-foreground text-sm">Complete tasks sequentially to level up</p>
			</div>
		</div>
		{#if !isVip}
			<Button onclick={() => goto('/vip')} class="bg-yellow-500 text-black hover:bg-yellow-400 gap-1">
				<HugeiconsIcon icon={CrownIcon} class="h-4 w-4" />Upgrade to VIP
			</Button>
		{:else}
			<span class="flex items-center gap-1 text-yellow-500 font-semibold text-sm">
				<HugeiconsIcon icon={CrownIcon} class="h-4 w-4" /> VIP Active
			</span>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-3">{#each Array(5) as _}<Card.Root><Card.Content class="p-4"><div class="h-20 animate-pulse bg-muted rounded"></div></Card.Content></Card.Root>{/each}</div>
	{:else if !season}
		<Card.Root><Card.Content class="p-12 text-center">
			<HugeiconsIcon icon={Award01Icon} class="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
			<p class="font-semibold text-lg">No Active Season</p>
			<p class="text-muted-foreground text-sm mt-1">Check back soon!</p>
		</Card.Content></Card.Root>
	{:else}
		<!-- Season info -->
		<Card.Root class="border-primary/30 bg-primary/5">
			<Card.Content class="p-4 flex items-center justify-between">
				<div>
					<p class="font-bold text-lg">Catplay Battlepass</p>
					<p class="text-muted-foreground text-sm">Complete challenges to level up and earn rewards</p>
				</div>
				<div class="text-right">
					<p class="text-2xl font-bold">Level {currentLevel}</p>
					<p class="text-muted-foreground text-xs">100 levels total</p>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Claim All button -->
		{#if claimableTiers.length > 0}
			<Button
				class="w-full bg-green-600 hover:bg-green-500 text-white font-bold h-11"
				onclick={claimAll}
				disabled={claimingAll}
			>
				{claimingAll ? 'Claiming...' : `Claim All (${claimableTiers.length} reward${claimableTiers.length !== 1 ? 's' : ''})`}
			</Button>
		{/if}

		<!-- Your stats -->
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
			{#each [['trades','Trades (season)'], ['arcade_games','Arcade (season)'], ['volume_traded','Total Volume'], ['portfolio_value','Net Worth']] as [key, label]}
				<Card.Root>
					<Card.Content class="p-3">
						<p class="text-lg font-bold">{formatCount(counts[key] ?? 0)}</p>
						<p class="text-muted-foreground text-xs">{label}</p>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<!-- Legend -->
		<div class="flex gap-4 text-xs">
			<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50 inline-block"></span>Free</span>
			<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50 inline-block"></span>Premium (VIP)</span>
			<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-500/30 border border-green-500/50 inline-block"></span>Claimed</span>
		</div>

		<!-- Tiers -->
		<div class="space-y-2">
			{#each levels as level}
				{@const free = tierForLevel('free', level)}
				{@const premium = tierForLevel('premium', level)}
				{@const unlocked = currentLevel >= level}
				{@const isNext = currentLevel === level - 1}

				<div class="grid grid-cols-[56px_1fr_1fr] gap-2 items-stretch">
					<!-- Level badge -->
					<div class="flex items-center justify-center">
						<div class="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
							{unlocked ? 'bg-primary text-primary-foreground' : isNext ? 'bg-primary/30 text-primary border border-primary/50' : 'bg-muted text-muted-foreground'}">
							{level}
						</div>
					</div>

					<!-- Free tier -->
					{#if free}
						{@const claimed = claimedIds.includes(free.id)}
						{@const claimable = canClaim(free)}
						{@const prog = taskProgress(free)}
						<Card.Root class="border {claimed ? 'border-green-500/40 bg-green-500/5' : claimable ? 'border-blue-500/50 bg-blue-500/5' : isNext ? 'border-primary/30' : 'border-muted opacity-60'}">
							<Card.Content class="p-3 space-y-2">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1">
										<p class="text-xs text-muted-foreground">{free.taskDescription}</p>
										<p class="text-sm font-semibold">{free.rewardLabel || `$${formatValue(Number(free.rewardAmount))}`}</p>
									</div>
									{#if claimed}
										<span class="text-green-500 text-xs flex items-center gap-0.5 shrink-0"><HugeiconsIcon icon={Tick01Icon} class="h-3 w-3" />Done</span>
									{:else if claimable}
										<Button size="sm" class="h-7 px-2 text-xs shrink-0" onclick={() => claim(free)} disabled={claiming === free.id}>
											{claiming === free.id ? '...' : 'Claim'}
										</Button>
									{:else}
										<span class="text-xs text-muted-foreground shrink-0">{prog.current}/{prog.target}</span>
									{/if}
								</div>
								<!-- Progress bar -->
								{#if !claimed && free.taskType !== 'manual'}
									<div class="h-1.5 bg-muted rounded-full overflow-hidden">
										<div class="h-full bg-primary rounded-full transition-all" style="width:{prog.pct}%"></div>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					{:else}<div></div>{/if}

					<!-- Premium tier -->
					{#if premium}
						{@const claimed = claimedIds.includes(premium.id)}
						{@const claimable = canClaim(premium)}
						{@const prog = taskProgress(premium)}
						<Card.Root class="border {claimed ? 'border-green-500/40 bg-green-500/5' : !isVip ? 'border-yellow-500/20 opacity-50' : claimable ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-muted opacity-60'}">
							<Card.Content class="p-3 space-y-2">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1">
										<div class="flex items-center gap-1 mb-0.5">
											<HugeiconsIcon icon={CrownIcon} class="h-3 w-3 text-yellow-500 shrink-0" />
											<p class="text-xs text-yellow-500/80">{premium.taskDescription}</p>
										</div>
										<p class="text-sm font-semibold">{premium.rewardLabel}</p>
									</div>
									{#if !isVip}
										<span class="text-yellow-500/70 text-xs flex items-center gap-0.5 shrink-0"><HugeiconsIcon icon={LockIcon} class="h-3 w-3" />VIP</span>
									{:else if claimed}
										<span class="text-green-500 text-xs flex items-center gap-0.5 shrink-0"><HugeiconsIcon icon={Tick01Icon} class="h-3 w-3" />Done</span>
									{:else if claimable}
										<Button size="sm" class="h-7 px-2 text-xs bg-yellow-500 text-black hover:bg-yellow-400 shrink-0" onclick={() => claim(premium)} disabled={claiming === premium.id}>
											{claiming === premium.id ? '...' : 'Claim'}
										</Button>
									{:else}
										<span class="text-xs text-muted-foreground shrink-0">{prog.current}/{prog.target}</span>
									{/if}
								</div>
								{#if !claimed && isVip && premium.taskType !== 'manual'}
									<div class="h-1.5 bg-muted rounded-full overflow-hidden">
										<div class="h-full bg-yellow-500 rounded-full transition-all" style="width:{prog.pct}%"></div>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					{:else}<div></div>{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
