<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { getTimeBasedGreeting, formatPrice, formatMarketCap } from '$lib/utils';
	import { USER_DATA } from '$lib/stores/user-data';
	import SignInConfirmDialog from '$lib/components/self/SignInConfirmDialog.svelte';
	import CoinIcon from '$lib/components/self/CoinIcon.svelte';
	import DataTable from '$lib/components/self/DataTable.svelte';
	import HomeSkeleton from '$lib/components/self/skeletons/HomeSkeleton.svelte';
	import HomeSeasonSkeleton from '$lib/components/self/skeletons/HomeSeasonSkeleton.svelte';
	import SeasonCard from '$lib/components/self/SeasonCard.svelte';
	import AdRectangle from '$lib/components/self/AdRectangle.svelte';
	import SEO from '$lib/components/self/SEO.svelte';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	let shouldSignIn = $state(false);
	let coins = $state<any[]>([]);
	let loading = $state(true);
	let seasonData = $state<any>(null);
	let seasonLoading = $state(true);

	onMount(() => {
		const controller = new AbortController();
		const options = { signal: controller.signal };

		fetch('/api/coins/top', options)
			.then(async (response) => {
				if (!response.ok) throw new Error('Failed to load coins');
				const result = await response.json();
				if (!controller.signal.aborted) coins = result.coins;
			})
			.catch((error) => {
				if (controller.signal.aborted) return;
				console.error('Failed to fetch coins:', error);
				toast.error('Failed to load coins');
			})
			.finally(() => {
				if (!controller.signal.aborted) loading = false;
			});

		fetch('/api/season', options)
			.then(async (response) => {
				const result = response.ok ? await response.json() : null;
				if (!controller.signal.aborted) seasonData = result;
			})
			.catch((error) => {
				if (!controller.signal.aborted) console.error('Failed to fetch season:', error);
			})
			.finally(() => {
				if (!controller.signal.aborted) seasonLoading = false;
			});

		return () => controller.abort();
	});
	const marketColumns = [
		{
			key: 'name',
			label: $_('global.name'),
			class: 'font-medium',
			render: (value: any, row: any) => {
				return {
					component: 'coin',
					icon: row.icon,
					symbol: row.symbol,
					name: row.name,
					size: 6
				};
			}
		},
		{
			key: 'price',
			label: $_('global.price'),
			render: (value: any) => `$${formatPrice(value)}`
		},
		{
			key: 'change24h',
			label: $_('coin.24hchange'),
			render: (value: any) => ({
				component: 'badge',
				variant: value >= 0 ? 'success' : 'destructive',
				text: `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
			})
		},
		{
			key: 'marketCap',
			label: $_('coin.marketcap'),
			render: (value: any) => formatMarketCap(value)
		},
		{
			key: 'volume24h',
			label: $_('coin.volume24h'),
			render: (value: any) => formatMarketCap(value)
		}
	];
</script>

<SEO
	title="Catplay"
	description="A realistic crypto trading simulator that lets you experience the risks and mechanics of decentralized exchanges without real financial consequences. Create coins, trade with liquidity pools, and learn about 'rug pulls' in a safe environment."
	keywords="crypto simulation game, trading practice game, rug pull simulation, virtual cryptocurrency game"
/>

<SignInConfirmDialog bind:open={shouldSignIn} />

<div class="container mx-auto p-6">
	<header class="mb-8">
		<h1 class="mb-2 truncate text-3xl font-bold">
			{$USER_DATA
				? $_('greetings.' + getTimeBasedGreeting())?.replace('{{name}}', $USER_DATA.name)
				: $_('main.title')}
		</h1>
		<p class="text-muted-foreground">
			{#if $USER_DATA}
				{$_('main.description')}
			{:else}
				{$_('sign_in.message.0')}
				<button
					class="text-primary underline hover:cursor-pointer"
					onclick={() => (shouldSignIn = !shouldSignIn)}>{$_('sign_in.message.1')}</button
				>
				{$_('sign_in.message.2')}
			{/if}
		</p>
	</header>

	{#if loading}
		<HomeSkeleton />
	{:else if coins.length === 0}
		<div class="flex h-96 items-center justify-center">
			<div class="text-center">
				<div class="text-muted-foreground mb-4 text-xl">No coins available</div>
				<p class="text-muted-foreground text-sm">Be the first to create a coin!</p>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			{#if seasonLoading || seasonData?.season}
				<div class="order-last md:col-span-2 lg:order-none lg:col-span-1 lg:col-start-4 lg:row-span-2 lg:row-start-1">
					{#if seasonLoading}
						<HomeSeasonSkeleton />
					{:else}
						<SeasonCard data={seasonData} />
					{/if}
				</div>
			{/if}
			<div class="order-last md:col-span-2 lg:order-none lg:col-span-1 lg:col-start-4">
				<AdRectangle class="w-full" />
			</div>
			{#each coins.slice(0, 6) as coin (coin.symbol)}
				<a href={`/coin/${coin.symbol}`} class="block">
					<Card.Root class="hover:bg-card/50 h-full transition-all hover:shadow-md">
						<Card.Header>
							<Card.Title class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<CoinIcon icon={coin.icon} symbol={coin.symbol} name={coin.name} size={6} />
									<span class="max-w-60 truncate">{coin.name} (*{coin.symbol})</span>
								</div>
								<Badge variant={coin.change24h >= 0 ? 'success' : 'destructive'} class="ml-2">
									{coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
								</Badge>
							</Card.Title>
							<Card.Description>Market Cap: {formatMarketCap(coin.marketCap)}</Card.Description>
						</Card.Header>
						<Card.Content>
							<div class="flex items-baseline justify-between">
								<span class="text-3xl font-bold">${formatPrice(coin.price)}</span>
								<span class="text-muted-foreground text-sm">
									24h Vol: {formatMarketCap(coin.volume24h)}
								</span>
							</div>
						</Card.Content>
					</Card.Root>
				</a>
			{/each}
		</div>

		<div class="mt-12">
			<h2 class="mb-4 text-2xl font-bold">{$_('main.market_overview')}</h2>
			<Card.Root>
				<Card.Content>
					<DataTable
						columns={marketColumns}
						data={coins}
						onRowClick={(coin) => goto(`/coin/${coin.symbol}`)}
					/>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
