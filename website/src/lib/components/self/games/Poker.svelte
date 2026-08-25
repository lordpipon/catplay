<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';
	import { formatValue, playSound, showConfetti } from '$lib/utils';
	import { volumeSettings } from '$lib/stores/volume-settings';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { haptic } from '$lib/stores/haptics';

	interface Card {
		rank: string;
		suit: string;
		value: number;
	}

	interface PokerResult {
		won: boolean;
		hand: Card[];
		handName: string;
		multiplier: number;
		payout: number;
		newBalance: number;
		amountWagered: number;
	}

	let {
		balance = $bindable(),
		onBalanceUpdate
	}: {
		balance: number;
		onBalanceUpdate?: (newBalance: number) => void;
	} = $props();

	const HAND_PAYOUTS: Record<string, number> = {
		'Royal Flush': 250,
		'Straight Flush': 50,
		'Four of a Kind': 25,
		'Full House': 9,
		'Flush': 6,
		'Straight': 4,
		'Three of a Kind': 3,
		'Two Pair': 2,
		'Jacks or Better': 1,
		'No Win': 0
	};

	let betAmount = $state(10);
	let betAmountDisplay = $state('10');
	let isPlaying = $state(false);
	let phase = $state<'bet' | 'hold' | 'result'>('bet');
	let hand = $state<Card[]>([]);
	let heldIndices = $state<Set<number>>(new Set());
	let result = $state<PokerResult | null>(null);
	let lastHandName = $state('');

	const suitColor = (suit: string) => (suit === '♥' || suit === '♦' ? 'text-red-500' : 'text-foreground');

	function toggleHold(i: number) {
		if (phase !== 'hold') return;
		heldIndices = new Set(
			heldIndices.has(i) ? [...heldIndices].filter((x) => x !== i) : [...heldIndices, i]
		);
	}

	async function play() {
		if (isPlaying) return;
		if (betAmount <= 0 || betAmount > balance) {
			toast.error('Invalid bet amount');
			return;
		}
		isPlaying = true;
		result = null;
		heldIndices = new Set();
		phase = 'hold';

		try {
			const res = await fetch('/api/arcade/poker', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: betAmount, hold: [] })
			});
			const data: PokerResult = await res.json();
			if (!res.ok) {
				toast.error((data as any).error || 'Failed to play');
				isPlaying = false;
				phase = 'bet';
				return;
			}
			hand = data.hand;
			// Phase is now 'hold' — player picks cards to keep, then draws
		} catch {
			toast.error('Failed to play');
			isPlaying = false;
			phase = 'bet';
		}
	}

	async function draw() {
		if (isPlaying) return;
		isPlaying = true;

		try {
			const res = await fetch('/api/arcade/poker', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: betAmount, hold: [...heldIndices] })
			});
			const data: PokerResult = await res.json();
			if (!res.ok) {
				toast.error((data as any).error || 'Failed to draw');
				isPlaying = false;
				phase = 'bet';
				return;
			}
			result = data;
			hand = data.hand;
			lastHandName = data.handName;
			phase = 'result';
			balance = data.newBalance;
			onBalanceUpdate?.(data.newBalance);
			fetchPortfolioSummary();

			if (data.won) {
				playSound('win', $volumeSettings);
				haptic.trigger('success');
				showConfetti();
				toast.success(`You won ${formatValue(data.payout)}! (${data.handName})`);
			} else {
				playSound('lose', $volumeSettings);
				haptic.trigger('error');
			}
		} catch {
			toast.error('Failed to draw');
		} finally {
			isPlaying = false;
		}
	}

	function newGame() {
		phase = 'bet';
		hand = [];
		result = null;
		heldIndices = new Set();
	}

	function setBet(amount: number) {
		betAmount = amount;
		betAmountDisplay = String(amount);
	}
</script>

<Card class="w-full max-w-lg">
	<CardHeader>
		<CardTitle>Video Poker</CardTitle>
		<CardDescription>
			{#if phase === 'bet'}Place a bet and deal 5 cards{:else if phase === 'hold'}Click cards to hold, then draw{:else}{lastHandName}{/if}
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Hand Display -->
		<div class="flex justify-center gap-2">
			{#each Array(5) as _, i}
				{@const card = hand[i]}
				{@const held = heldIndices.has(i)}
				<button
					class="border-primary/30 bg-secondary flex h-24 w-16 flex-col items-center justify-center rounded-lg border-2 text-lg font-bold transition-all sm:h-28 sm:w-20 sm:text-xl"
					class:border-green-500={held}
					class:opacity-50={result && result.won === false}
					class:scale-105={held && phase === 'hold'}
					disabled={phase !== 'hold'}
					onclick={() => toggleHold(i)}
				>
					{#if card}
						<span class={suitColor(card.suit)}>{card.suit}</span>
						<span class={suitColor(card.suit)}>{card.rank}</span>
					{:else}
						<span class="text-muted-foreground text-xs">?</span>
					{/if}
					{#if held && phase === 'hold'}
						<span class="text-green-500 text-[10px] font-bold">HELD</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Payout Table -->
		{#if phase === 'bet'}
			<div class="bg-muted/50 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg px-3 py-2 text-xs">
				{#each Object.entries(HAND_PAYOUTS) as [name, mult]}
					{#if mult > 0}
						<div class="flex justify-between">
							<span>{name}</span>
							<span class="font-mono">{mult}x</span>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Result -->
		{#if result}
			<div class="text-center">
				<div class="text-lg font-bold" class:text-green-500={result.won} class:text-red-500={!result.won}>
					{result.won ? `Won ${formatValue(result.payout)}` : `Lost ${formatValue(result.amountWagered)}`}
				</div>
				<div class="text-muted-foreground text-sm">{result.handName} ({result.multiplier}x)</div>
			</div>
		{/if}

		<!-- Bet Controls -->
		{#if phase === 'bet'}
			<div class="flex gap-2">
				<Input
					type="number"
					bind:value={betAmountDisplay}
					oninput={() => { betAmount = Number(betAmountDisplay) || 0; }}
					min="1"
					max={balance}
					placeholder="Bet amount"
					class="flex-1"
				/>
				<Button onclick={play} disabled={isPlaying || betAmount <= 0 || betAmount > balance}>
					Deal
				</Button>
			</div>
			<div class="flex gap-1">
				{#each [10, 100, 1000, 10000] as amount}
					<Button variant="outline" size="sm" onclick={() => setBet(amount)} disabled={amount > balance}>
						{formatValue(amount)}
					</Button>
				{/each}
			</div>
		{:else if phase === 'hold'}
			<div class="flex justify-center">
				<Button onclick={draw} disabled={isPlaying}>
					{isPlaying ? 'Drawing...' : 'Draw'}
				</Button>
			</div>
		{:else}
			<div class="flex justify-center">
				<Button onclick={newGame}>New Game</Button>
			</div>
		{/if}
	</CardContent>
</Card>
