<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { toast } from 'svelte-sonner';
	import { formatValue, playSound, showConfetti } from '$lib/utils';
	import { volumeSettings } from '$lib/stores/volume-settings';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { haptic } from '$lib/stores/haptics';
	import { DUCKS } from '$lib/arcade/duck-race-data';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { RubberDuckIcon, Award05Icon } from '@hugeicons/core-free-icons';

	interface DuckRaceResult {
		won: boolean;
		chosenDuck: number;
		winnerDuck: number;
		finishPositions: number[];
		multiplier: number;
		newBalance: number;
		payout: number;
		amountWagered: number;
	}

	let {
		balance = $bindable(),
		onBalanceUpdate
	}: {
		balance: number;
		onBalanceUpdate?: (newBalance: number) => void;
	} = $props();

	const MAX_BET_AMOUNT = 1000000000000;

	let betAmount = $state(10);
	let betAmountDisplay = $state('10');
	let isRacing = $state(false);
	let selectedDuck = $state<number | null>(null);
	let racePhase = $state<'pick' | 'racing' | 'result'>('pick');
	let duckPositions = $state<number[]>(DUCKS.map(() => 0));
	let result = $state<DuckRaceResult | null>(null);

	let canBet = $derived(
		selectedDuck !== null && betAmount > 0 && betAmount <= balance && betAmount <= MAX_BET_AMOUNT && racePhase === 'pick'
	);

	function setBetAmount(amount: number) {
		const clamped = Math.min(amount, Math.min(balance, MAX_BET_AMOUNT));
		betAmount = clamped;
		betAmountDisplay = clamped.toLocaleString();
	}

	function handleBetAmountInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value.replace(/,/g, '');
		betAmount = Math.min(parseFloat(value) || 0, Math.min(balance, MAX_BET_AMOUNT));
		betAmountDisplay = target.value;
	}

	function handleBetAmountBlur() {
		betAmountDisplay = betAmount.toLocaleString();
	}

	function selectDuck(id: number) {
		if (racePhase !== 'pick') return;
		selectedDuck = id;
		haptic.trigger('selection');
	}

	async function startRace() {
		if (!canBet || isRacing || selectedDuck === null) return;
		isRacing = true;
		racePhase = 'racing';
		duckPositions = DUCKS.map(() => 0);
		result = null;

		try {
			const res = await fetch('/api/arcade/duck-race', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bet: selectedDuck, amount: betAmount })
			});
			const data: DuckRaceResult & { error?: string } = await res.json();
			if (!res.ok) {
				toast.error(data.error || 'Failed to start race');
				isRacing = false;
				racePhase = 'pick';
				return;
			}

			result = data;
			balance = data.newBalance;
			onBalanceUpdate?.(data.newBalance);
			fetchPortfolioSummary();

			await animateRace(data.finishPositions);

			if (data.won) {
				playSound('win', $volumeSettings);
				haptic.trigger('success');
				showConfetti();
				toast.success(`Your duck ${DUCKS[data.chosenDuck].name} won! +${formatValue(data.payout)}`);
			} else {
				playSound('lose', $volumeSettings);
				haptic.trigger('error');
				const winnerName = DUCKS[data.winnerDuck].name;
				toast.error(`${winnerName} wins! You lost ${formatValue(betAmount)}`);
			}

			racePhase = 'result';
		} catch {
			toast.error('Failed to start race');
			racePhase = 'pick';
		} finally {
			isRacing = false;
		}
	}

	function animateRace(finishPositions: number[]): Promise<void> {
		return new Promise((resolve) => {
			const steps = 40;
			const interval = 50;
			let step = 0;

			const timer = setInterval(() => {
				step++;
				const progress = step / steps;
				const eased = 1 - Math.pow(1 - progress, 3);

				duckPositions = DUCKS.map((_, i) => {
					const target = finishPositions[i];
					if (step >= steps) return target;
					const jitter = Math.sin(step * 0.3 + i * 1.7) * 0.15;
					return Math.min(target, eased * target + jitter * progress);
				});

				if (step >= steps) {
					clearInterval(timer);
					duckPositions = [...finishPositions];
					setTimeout(resolve, 400);
				}
			}, interval);
		});
	}

	function newRace() {
		racePhase = 'pick';
		result = null;
		duckPositions = DUCKS.map(() => 0);
		selectedDuck = null;
	}

	function duckProgress(pos: number): number {
		return Math.max(0, Math.min(100, (pos / 5) * 100));
	}
</script>

<Card>
	<CardHeader>
		<CardTitle class="flex items-center gap-2">
			<HugeiconsIcon icon={RubberDuckIcon} class="h-5 w-5" />
			Duck Race
		</CardTitle>
		<CardDescription>
			Pick a duck and watch them race! Each duck has different odds — underdogs pay more.
		</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Track -->
		<div class="bg-primary/5 relative overflow-hidden rounded-xl border border-blue-500/20 p-3">
			<!-- Water ripples -->
			<div class="absolute inset-0 opacity-20">
				{#each Array(6) as _, i}
					<div
						class="bg-blue-400/30 absolute h-0.5 rounded-full"
						style="top: {12 + i * 16}%; width: {30 + Math.sin(i) * 20}%; left: {10 + i * 12}%; animation: wave {2 + i * 0.3}s ease-in-out infinite alternate;"
					></div>
				{/each}
			</div>

			<!-- Finish line -->
			<div class="absolute right-3 top-0 bottom-0 w-0.5 bg-white/30"></div>
			<div class="absolute right-0.5 top-0 bottom-0 flex flex-col justify-around">
				<HugeiconsIcon icon={Award05Icon} class="h-3 w-3 text-yellow-400/40" />
			</div>

			<!-- Lanes -->
			{#each DUCKS as duck, i}
				{@const pos = duckPositions[i]}
				{@const isSelected = selectedDuck === duck.id}
				{@const isWinner = result?.winnerDuck === duck.id}
				{@const isLoser = result && result.winnerDuck !== duck.id}
				{@const progress = duckProgress(pos)}
				<div
					class="relative mb-1 flex h-8 items-center rounded transition-colors {isSelected && racePhase === 'pick' ? 'bg-white/10' : ''} {isWinner ? 'bg-green-500/10' : ''}"
				>
					<!-- Lane label -->
					<div class="z-10 flex w-16 shrink-0 items-center gap-1 pl-1">
						<div
							class="h-3 w-3 rounded-full"
							style="background-color: {duck.color}"
						></div>
						<span class="text-[10px] font-medium {isWinner ? 'text-green-400' : isLoser ? 'text-white/40' : ''}">{duck.name}</span>
					</div>

					<!-- Water trail -->
					{#if pos > 0}
						<div
							class="absolute h-4 rounded-full opacity-20"
							style="left: 4rem; width: {progress * 0.85}%; background: {duck.color};"
						></div>
					{/if}

					<!-- Duck -->
					<div
						class="absolute z-20 transition-all"
						style="left: calc(4rem + {progress}% * 0.85);"
					>
						<div class="flex items-center {isRacing && isSelected ? 'animate-bounce' : ''}">
							{#if isWinner && result}
								<HugeiconsIcon icon={Award05Icon} class="h-5 w-5 text-yellow-400" />
							{:else}
								<HugeiconsIcon icon={RubberDuckIcon} class="h-4 w-4" style="color: {duck.color}" />
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Result -->
		{#if result}
			<div class="text-center">
				<div class="text-lg font-bold" class:text-green-500={result.won} class:text-red-500={!result.won}>
					{result.won ? `Won ${formatValue(result.payout)}!` : `Lost ${formatValue(result.amountWagered)}`}
				</div>
				<div class="text-muted-foreground text-sm">
					{DUCKS[result.winnerDuck].name} wins at {DUCKS[result.winnerDuck].multiplier}x
				</div>
			</div>
		{/if}

		<!-- Duck Picker -->
		{#if racePhase !== 'result'}
			<div>
				<div class="mb-2 text-sm font-medium">Pick your duck</div>
				<div class="grid grid-cols-3 gap-2 sm:grid-cols-6">
					{#each DUCKS as duck}
						<button
							class="flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all {selectedDuck === duck.id
								? 'border-primary bg-primary/10'
								: 'border-muted hover:border-muted-foreground/50'}"
							disabled={racePhase !== 'pick'}
							onclick={() => selectDuck(duck.id)}
						>
							<HugeiconsIcon icon={RubberDuckIcon} class="h-6 w-6" style="color: {duck.color}" />
							<span class="text-xs font-medium">{duck.name}</span>
							<span class="text-muted-foreground text-[10px]">{duck.multiplier}x</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Bet Controls -->
		{#if racePhase === 'pick'}
			<div>
				<label class="mb-2 block text-sm font-medium" for="duck-bet">Bet Amount</label>
				<Input
					id="duck-bet"
					type="text"
					value={betAmountDisplay}
					oninput={handleBetAmountInput}
					onblur={handleBetAmountBlur}
					disabled={racePhase !== 'pick'}
					placeholder="Enter bet amount"
				/>
				<div class="mt-2 grid grid-cols-4 gap-2">
					{#each [10, 100, 1000, 10000] as amount}
						<Button
							size="sm"
							variant="outline"
							disabled={racePhase !== 'pick'}
							onclick={() => setBetAmount(amount)}
						>
							{formatValue(amount)}
						</Button>
					{/each}
				</div>
			</div>

			<Button class="h-12 w-full text-lg" onclick={startRace} disabled={!canBet || isRacing}>
				{isRacing ? 'Racing...' : selectedDuck !== null ? `Bet on ${DUCKS[selectedDuck].name}!` : 'Pick a duck first'}
			</Button>
		{:else if racePhase === 'result'}
			<Button class="h-12 w-full text-lg" onclick={newRace}>Race Again</Button>
		{/if}
	</CardContent>
</Card>
