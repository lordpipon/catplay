<script lang="ts">
	import { USER_DATA } from '$lib/stores/user-data';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Shield01Icon,
		LegalHammerIcon,
		Ticket01Icon,
		ArrowRight01Icon,
		UserGroupIcon,
		Analytics01Icon,
		PodiumIcon
	} from '@hugeicons/core-free-icons';
	import { goto } from '$app/navigation';
	import { hasFlag } from '$lib/data/flags';
	import { formatPrice } from '$lib/utils';
	import { onMount } from 'svelte';

	interface SystemStats {
		totalUsers: number;
		totalCoins: number;
		listedCoins: number;
		totalTransactions: number;
		totalComments: number;
		newUsers24h: number;
		totalGems: number;
		activeVipCount: number;
		totalMarketCap: number;
		totalVolume24h: number;
		totalTradingVolume: number;
	}

	let stats = $state<SystemStats | null>(null);
	let statsError = $state(false);

	onMount(async () => {
		try {
			const res = await fetch('/api/admin/stats');
			if (!res.ok) throw new Error();
			stats = await res.json();
		} catch {
			statsError = true;
		}
	});

	type StatTile = { label: string; value: string; color: string };

	function statTiles(): StatTile[] {
		if (!stats) return [];
		return [
			{ label: 'Total Users', value: stats.totalUsers.toLocaleString(), color: 'text-blue-500' },
			{ label: 'New Users (24h)', value: '+' + stats.newUsers24h.toLocaleString(), color: 'text-green-500' },
			{ label: 'Coins (Listed)', value: `${stats.listedCoins.toLocaleString()} / ${stats.totalCoins.toLocaleString()}`, color: 'text-yellow-500' },
			{ label: 'Active VIPs', value: stats.activeVipCount.toLocaleString(), color: 'text-purple-500' },
			{ label: 'Transactions', value: stats.totalTransactions.toLocaleString(), color: 'text-red-500' },
			{ label: 'Comments', value: stats.totalComments.toLocaleString(), color: 'text-pink-500' },
			{ label: 'Total Gems', value: stats.totalGems.toLocaleString(), color: 'text-emerald-500' },
			{ label: 'Market Cap', value: formatPrice(stats.totalMarketCap), color: 'text-cyan-500' },
			{ label: 'Volume (24h)', value: formatPrice(stats.totalVolume24h), color: 'text-orange-500' },
			{ label: 'Trading Volume', value: formatPrice(stats.totalTradingVolume), color: 'text-indigo-500' }
		];
	}

	const adminSections = [
		{
			title: 'User Management',
			description: 'Manage Users.',
			icon: LegalHammerIcon,
			url: '/admin/users',
			color: 'text-blue-500'
		},
		{
			title: 'Promo Codes',
			description: 'Manage Promo Codes.',
			icon: Ticket01Icon,
			url: '/admin/promo',
			color: 'text-green-500'
		},
		{
			title: 'Seasons',
			description: 'Schedule seasons and choose their cover images.',
			icon: PodiumIcon,
			url: '/admin/seasons',
			color: 'text-yellow-500'
		},
		{
			title: 'Admin Logs',
			description: 'Live feed of all moderator and admin actions.',
			icon: Shield01Icon,
			url: '/admin/logs',
			color: 'text-orange-500'
		},
		{
			title: 'Transactions Logs',
			description: 'Complete record of trading activity and transactions of the entire platform.',
			icon: Analytics01Icon,
			url: '/admin/transactions',
			color: 'text-red-500'
		}
	];
</script>

<svelte:head>
	<title>Admin Panel of Catplay</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if !$USER_DATA || !hasFlag($USER_DATA?.flags, 'IS_ADMIN', 'IS_HEAD_ADMIN')}
	<div class="flex h-[80vh] items-center justify-center">
		<div class="text-center">
			<h1 class="text-2xl font-bold">Access Denied</h1>
			<p class="text-muted-foreground">
				You don't have permission to access this page. If you are set as an admin, I have no idea
				why you are here.
			</p>
		</div>
	</div>
{:else}
	<div class="container mx-auto space-y-6 p-6">
		<div class="flex items-center gap-3">
			<div class="bg-primary/10 rounded-lg p-2">
				<HugeiconsIcon icon={Shield01Icon} class="text-primary h-6 w-6" />
			</div>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Admin Panel</h1>
				<p class="text-muted-foreground text-sm">
					It has links to the other admin stuff, and not much more!.
				</p>
			</div>
		</div>

		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each adminSections as section}
				<Card.Root class="hover:border-primary/50 transition-colors">
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class={`bg-muted rounded-md p-2 ${section.color}`}>
								<HugeiconsIcon icon={section.icon} class="h-5 w-5" />
							</div>
						</div>
						<Card.Title class="mt-4">{section.title}</Card.Title>
						<Card.Description>{section.description}</Card.Description>
					</Card.Header>
					<Card.Content>
						<Button
							variant="outline"
							class="w-full justify-between"
							onclick={() => goto(section.url)}
						>
							Open {section.title}
							<HugeiconsIcon icon={ArrowRight01Icon} class="h-4 w-4" />
						</Button>
					</Card.Content>
				</Card.Root>
			{/each}

			<Card.Root>
				<Card.Header>
					<div class="flex items-center justify-between">
						<div class="bg-muted rounded-md p-2">
							<HugeiconsIcon icon={Analytics01Icon} class="h-5 w-5" />
						</div>
					</div>
					<Card.Title class="mt-4">System Stats</Card.Title>
					<Card.Description>Live platform metrics</Card.Description>
				</Card.Header>
				<Card.Content>
					{#if statsError}
						<p class="text-destructive text-sm">Failed to load stats.</p>
					{:else if !stats}
						<p class="text-muted-foreground text-sm">Loading...</p>
					{:else}
						<div class="grid grid-cols-2 gap-2">
							{#each statTiles() as item}
								<div class="rounded-md border bg-muted/40 p-2">
									<p class="text-muted-foreground text-xs">{item.label}</p>
									<p class={`text-sm font-semibold ${item.color}`}>{item.value}</p>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
{/if}
