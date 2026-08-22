<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import confetti from 'canvas-confetti';
	import { toast } from 'svelte-sonner';
	import { formatValue, playSound, showConfetti } from '$lib/utils';
	import { volumeSettings } from '$lib/stores/volume-settings';
	import { onMount } from 'svelte';
	import { fetchPortfolioSummary } from '$lib/stores/portfolio-data';
	import { haptic } from '$lib/stores/haptics';

	const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
	const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

	function getColor(n: number): string {
		if (n === 0) return 'green';
		return RED_NUMBERS.includes(n) ? 'red' : 'black';
	}

	interface RouletteResult {
		won: boolean;
		spinResult: number;
		color: string;
		multiplier: number;
		newBalance: number;
		payout: number;
		amountWagered: number;
	}

	const MAX_BET_AMOUNT = 1000000000000;

	const BET_OPTIONS = [
		{ id: 'red',   label: 'Red',    payout: '1.8x',  colorClass: 'bg-red-600' },
		{ id: 'black', label: 'Black',  payout: '1.8x',  colorClass: 'bg-gray-900 border border-gray-600' },
		{ id: 'green', label: 'Green',  payout: '8x',    colorClass: 'bg-green-600' },
		{ id: 'odd',   label: 'Odd',    payout: '1.8x',  colorClass: 'bg-blue-700' },
		{ id: 'even',  label: 'Even',   payout: '1.8x',  colorClass: 'bg-blue-700' },
		{ id: '1-18',  label: '1-18',   payout: '1.8x',  colorClass: 'bg-purple-700' },
		{ id: '19-36', label: '19-36',  payout: '1.8x',  colorClass: 'bg-purple-700' },
		{ id: '1st12', label: '1st 12', payout: '2.5x',  colorClass: 'bg-amber-600' },
		{ id: '2nd12', label: '2nd 12', payout: '2.5x',  colorClass: 'bg-amber-600' },
		{ id: '3rd12', label: '3rd 12', payout: '2.5x',  colorClass: 'bg-amber-600' },
	];

	let {
		balance = $bindable(),
		onBalanceUpdate
	}: {
		balance: number;
		onBalanceUpdate?: (newBalance: number) => void;
	} = $props();

	let betAmount = $state(10);
	let betAmountDisplay = $state('10');
	let selectedBet = $state('red');
	let numberBetInput = $state('');
	let isSpinning = $state(false);
	let lastResult = $state<RouletteResult | null>(null);
	let wheelRotation = $state(0);

	let canBet = $derived(betAmount > 0 && betAmount <= balance && betAmount <= MAX_BET_AMOUNT && !isSpinning);

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

	function handleNumberInput(event: Event) {
		const target = event.target as HTMLInputElement;
		const v = parseInt(target.value);
		if (!isNaN(v) && v >= 0 && v <= 36) {
			selectedBet = String(v);
			numberBetInput = target.value;
			haptic.trigger('selection');
		}
	}

	async function spin() {
		if (!canBet) return;
		isSpinning = true;
		lastResult = null;

		try {
			const response = await fetch('/api/arcade/roulette', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bet: selectedBet, amount: betAmount })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to place bet');
			}

			const resultData: RouletteResult = await response.json();

			// Animate wheel so the winning number centers under the top pointer
			const seg = 360 / WHEEL_ORDER.length;
			const segIdx = WHEEL_ORDER.indexOf(resultData.spinResult);
			const targetMod = (((360 - (segIdx * seg + seg / 2)) % 360) + 360) % 360;
			const currentMod = (((wheelRotation % 360) + 360) % 360);
			let delta = targetMod - currentMod;
			if (delta <= 0) delta += 360;
			const jitter = (Math.random() - 0.5) * seg * 0.6;
			wheelRotation += 5 * 360 + delta + jitter;

			playSound('click');

			setTimeout(() => {
				balance = resultData.newBalance;
				lastResult = resultData;
				onBalanceUpdate?.(resultData.newBalance);
				isSpinning = false;

				if (resultData.won) {
					haptic.trigger('success');
					showConfetti(confetti);
				} else {
					haptic.trigger('error');
					playSound('lose');
				}
			}, 4000);
		} catch (error) {
			console.error('Roulette error:', error);
			haptic.trigger('error');
			toast.error('Spin failed', {
				description: error instanceof Error ? error.message : 'Unknown error occurred'
			});
			isSpinning = false;
		}
	}

	onMount(async () => {
		volumeSettings.load();
		try {
			const data = await fetchPortfolioSummary();
			if (data) {
				balance = data.baseCurrencyBalance;
				onBalanceUpdate?.(data.baseCurrencyBalance);
			}
		} catch (error) {
			console.error('Failed to fetch balance:', error);
		}
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>Roulette</CardTitle>
		<CardDescription>Bet on red, black, green, or a number. Green pays 14x, straight number pays 36x!</CardDescription>
	</CardHeader>
	<CardContent>
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<!-- Left: Wheel + Result -->
			<div class="flex flex-col items-center space-y-4">
				<div class="text-center">
					<p class="text-muted-foreground text-sm">Balance</p>
					<p class="text-2xl font-bold">{formatValue(balance)}</p>
				</div>

				<!-- Wheel -->
				<div class="relative flex items-center justify-center" style="width:220px;height:220px;">
					<div class="absolute inset-0 rounded-full border-4 border-yellow-600 bg-yellow-900 shadow-2xl"></div>
					<div
						class="absolute rounded-full overflow-hidden"
						style="width:200px;height:200px;transition:transform 4s cubic-bezier(0.17,0.67,0.12,0.99);transform:rotate({wheelRotation}deg);"
					>
						<svg viewBox="0 0 200 200" width="200" height="200">
							{#each WHEEL_ORDER as num, i}
								{@const angle = (360 / WHEEL_ORDER.length) * i}
								{@const startAngle = (angle - 90) * (Math.PI / 180)}
								{@const endAngle = (angle - 90 + 360 / WHEEL_ORDER.length) * (Math.PI / 180)}
								{@const x1 = 100 + 100 * Math.cos(startAngle)}
								{@const y1 = 100 + 100 * Math.sin(startAngle)}
								{@const x2 = 100 + 100 * Math.cos(endAngle)}
								{@const y2 = 100 + 100 * Math.sin(endAngle)}
								{@const midAngle = (startAngle + endAngle) / 2}
								{@const tx = 100 + 75 * Math.cos(midAngle)}
								{@const ty = 100 + 75 * Math.sin(midAngle)}
								{@const fillColor = num === 0 ? '#16a34a' : RED_NUMBERS.includes(num) ? '#dc2626' : '#111827'}
								<path d="M100,100 L{x1},{y1} A100,100 0 0,1 {x2},{y2} Z" fill={fillColor} stroke="#f5f5f5" stroke-width="0.5" />
								<text x={tx} y={ty} fill="white" font-size="7" text-anchor="middle" dominant-baseline="middle" transform="rotate({angle + 360/WHEEL_ORDER.length/2},{tx},{ty})">{num}</text>
							{/each}
							<circle cx="100" cy="100" r="20" fill="#1c1917" stroke="#f5f5f5" stroke-width="1"/>
						</svg>
					</div>
					<!-- Pointer -->
					<div class="absolute top-0 left-1/2 z-10" style="transform:translateX(-50%) translateY(-4px);">
						<div class="w-0 h-0" style="border-left:6px solid transparent;border-right:6px solid transparent;border-top:14px solid #fbbf24;"></div>
					</div>
				</div>

				<!-- Result -->
				<div class="w-full text-center min-h-[60px] flex items-center justify-center">
					{#if lastResult && !isSpinning}
						<div class="bg-muted/50 w-full rounded-lg p-3">
							<div class="flex items-center justify-center gap-2 mb-1">
								<div class="w-6 h-6 rounded-full border border-white/20" style="background:{lastResult.color === 'red' ? '#dc2626' : lastResult.color === 'green' ? '#16a34a' : '#111827'}"></div>
								<span class="font-bold text-lg">{lastResult.spinResult}</span>
							</div>
							{#if lastResult.won}
								<p class="text-green-500 font-semibold">WIN — {lastResult.multiplier}x</p>
								<p class="text-sm">+{formatValue(lastResult.payout - lastResult.amountWagered)}</p>
							{:else}
								<p class="text-red-500 font-semibold">LOSS</p>
								<p class="text-sm">-{formatValue(lastResult.amountWagered)}</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Right: Controls -->
			<div class="space-y-4">
				<!-- Bet type -->
				<div>
					<div class="mb-2 text-sm font-medium">Bet Type</div>
					<div class="grid grid-cols-2 gap-2">
						{#each BET_OPTIONS as opt}
							<Button
								variant={selectedBet === opt.id ? 'default' : 'outline'}
								class="h-10 text-xs"
								onclick={() => { if (!isSpinning) { selectedBet = opt.id; numberBetInput = ''; haptic.trigger('selection'); } }}
								disabled={isSpinning}
							>
								<span class="flex items-center gap-1.5">
									<span class="w-3 h-3 rounded-full inline-block {opt.colorClass}"></span>
									{opt.label} <span class="text-muted-foreground">({opt.payout})</span>
								</span>
							</Button>
						{/each}
					</div>
				</div>

				<!-- Number bet -->
				<div>
					<label class="mb-2 block text-sm font-medium">Or bet on a number (0–36, pays 25x)</label>
					<Input
						type="number"
						min="0"
						max="36"
						placeholder="0–36"
						value={numberBetInput}
						disabled={isSpinning}
						oninput={handleNumberInput}
					/>
					{#if /^\d+$/.test(selectedBet)}
						<p class="text-muted-foreground mt-1 text-xs">Selected number: {selectedBet}</p>
					{/if}
				</div>

				<!-- Bet amount -->
				<div>
					<label class="mb-2 block text-sm font-medium">Bet Amount</label>
					<Input
						type="text"
						value={betAmountDisplay}
						oninput={handleBetAmountInput}
						onblur={handleBetAmountBlur}
						disabled={isSpinning}
						placeholder="Enter bet amount"
					/>
					<p class="text-muted-foreground mt-1 text-xs">Max bet: {MAX_BET_AMOUNT.toLocaleString()}</p>
				</div>

				<div class="grid grid-cols-4 gap-2">
					{#each [0.25, 0.5, 0.75, 1] as pct}
						<Button size="sm" variant="outline" disabled={isSpinning} onclick={() => setBetAmount(Math.floor(Math.min(balance, MAX_BET_AMOUNT) * pct))}>
							{pct === 1 ? 'Max' : `${pct * 100}%`}
						</Button>
					{/each}
				</div>

				<Button class="h-12 w-full text-lg" onclick={spin} disabled={!canBet}>
					{isSpinning ? 'Spinning...' : 'Spin'}
				</Button>
			</div>
		</div>
	</CardContent>
</Card>
