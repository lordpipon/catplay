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

	const SEGMENTS = [
		{ label: '2x',   multiplier: 2,   weight: 30, color: '#3b82f6' },
		{ label: 'LOSE', multiplier: 0,   weight: 25, color: '#ef4444' },
		{ label: '1.5x', multiplier: 1.5, weight: 20, color: '#8b5cf6' },
		{ label: '3x',   multiplier: 3,   weight: 10, color: '#f59e0b' },
		{ label: 'LOSE', multiplier: 0,   weight: 8,  color: '#ef4444' },
		{ label: '5x',   multiplier: 5,   weight: 4,  color: '#10b981' },
		{ label: 'LOSE', multiplier: 0,   weight: 2,  color: '#ef4444' },
		{ label: '25x',  multiplier: 25,  weight: 1,  color: '#f97316' },
	];

	const TOTAL_WEIGHT = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);

	// Precompute segment angles
	interface SegmentAngle {
		label: string;
		multiplier: number;
		color: string;
		weight: number;
		startAngle: number;
		sweepAngle: number;
		midAngle: number;
	}

	let cumulativeAngle = 0;
	const segmentAngles: SegmentAngle[] = SEGMENTS.map((seg) => {
		const sweep = (seg.weight / TOTAL_WEIGHT) * 360;
		const s: SegmentAngle = {
			...seg,
			startAngle: cumulativeAngle,
			sweepAngle: sweep,
			midAngle: cumulativeAngle + sweep / 2
		};
		cumulativeAngle += sweep;
		return s;
	});

	interface SpinResult {
		won: boolean;
		segmentIndex: number;
		segment: { label: string; multiplier: number; color: string };
		newBalance: number;
		payout: number;
		amountWagered: number;
	}

	const MAX_BET_AMOUNT = 1000000000000;

	let {
		balance = $bindable(),
		onBalanceUpdate
	}: {
		balance: number;
		onBalanceUpdate?: (newBalance: number) => void;
	} = $props();

	let betAmount = $state(10);
	let betAmountDisplay = $state('10');
	let isSpinning = $state(false);
	let lastResult = $state<SpinResult | null>(null);
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

	function polarToCart(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
		const rad = (angleDeg - 90) * Math.PI / 180;
		return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
	}

	function describeArc(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
		const start = polarToCart(cx, cy, r, startDeg);
		const end = polarToCart(cx, cy, r, startDeg + sweepDeg);
		const largeArc = sweepDeg > 180 ? 1 : 0;
		return `M${cx},${cy} L${start.x},${start.y} A${r},${r} 0 ${largeArc} 1 ${end.x},${end.y} Z`;
	}

	async function spin() {
		if (!canBet) return;
		isSpinning = true;
		lastResult = null;
		playSound('click');

		try {
			const response = await fetch('/api/arcade/spinwheel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: betAmount })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to place bet');
			}

			const resultData: SpinResult = await response.json();

			// Rotate so winning segment lands at top pointer
			const seg = segmentAngles[resultData.segmentIndex];
			const targetAngle = seg.startAngle + seg.sweepAngle / 2;
			const spins = 5 * 360;
			const correction = (360 - targetAngle) % 360;
			wheelRotation += spins + correction;

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
			}, 4500);
		} catch (error) {
			console.error('SpinWheel error:', error);
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
		<CardTitle>Spin Wheel</CardTitle>
		<CardDescription>Spin and win up to 25x your bet! Jackpot is rare but huge.</CardDescription>
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
				<div class="relative flex items-center justify-center" style="width:240px;height:240px;">
					<!-- Pointer -->
					<div class="absolute top-0 left-1/2 z-20" style="transform:translateX(-50%) translateY(-4px);">
						<div class="w-0 h-0" style="border-left:8px solid transparent;border-right:8px solid transparent;border-top:18px solid #fbbf24;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));"></div>
					</div>

					<!-- Spinning wheel -->
					<div style="width:230px;height:230px;transition:transform 4.5s cubic-bezier(0.17,0.67,0.12,0.99);transform:rotate({wheelRotation}deg);">
						<svg viewBox="0 0 200 200" width="230" height="230">
							{#each segmentAngles as seg}
								{@const mid = polarToCart(100, 100, 68, seg.midAngle)}
								<path
									d={describeArc(100, 100, 98, seg.startAngle, seg.sweepAngle)}
									fill={seg.color}
									stroke="#1c1917"
									stroke-width="1"
								/>
								<text
									x={mid.x}
									y={mid.y}
									fill="white"
									font-size={seg.label.length > 3 ? '9' : '11'}
									font-weight="bold"
									text-anchor="middle"
									dominant-baseline="middle"
									transform="rotate({seg.midAngle},{mid.x},{mid.y})"
								>{seg.label}</text>
							{/each}
							<circle cx="100" cy="100" r="14" fill="#1c1917" stroke="#f5f5f5" stroke-width="1.5"/>
							<circle cx="100" cy="100" r="5" fill="#fbbf24"/>
						</svg>
					</div>

					<!-- Outer ring -->
					<div class="absolute inset-0 rounded-full border-4 border-yellow-600 pointer-events-none"></div>
				</div>

				<!-- Odds table -->
				<div class="w-full">
					<p class="text-muted-foreground text-xs text-center mb-2">Odds</p>
					<div class="grid grid-cols-4 gap-1 text-xs text-center">
						{#each [{ label: '2x', color: '#3b82f6', chance: 30 }, { label: 'LOSE', color: '#ef4444', chance: 35 }, { label: '1.5x', color: '#8b5cf6', chance: 20 }, { label: '3x', color: '#f59e0b', chance: 10 }, { label: '5x', color: '#10b981', chance: 4 }, { label: '25x', color: '#f97316', chance: 1 }] as item}
							<div class="rounded p-1" style="background:{item.color}20;border:1px solid {item.color}40;">
								<div class="font-bold" style="color:{item.color}">{item.label}</div>
								<div class="text-muted-foreground">{item.chance}%</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Result -->
				<div class="w-full text-center min-h-[56px] flex items-center justify-center">
					{#if lastResult && !isSpinning}
						<div class="w-full rounded-lg p-3 border" style="background:{lastResult.segment.color}20;border-color:{lastResult.segment.color}40;">
							<p class="font-bold text-lg" style="color:{lastResult.segment.color}">{lastResult.segment.label}</p>
							{#if lastResult.won}
								<p class="text-green-500 text-sm">+{formatValue(lastResult.payout - lastResult.amountWagered)}</p>
							{:else}
								<p class="text-red-500 text-sm">-{formatValue(lastResult.amountWagered)}</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<!-- Right: Controls -->
			<div class="space-y-4 flex flex-col justify-center">
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

				<!-- Payout info -->
				<div class="bg-muted/30 rounded-lg p-3 space-y-1">
					<p class="text-sm font-medium mb-2">Payouts</p>
					{#each [{ label: '2x', color: '#3b82f6', chance: 30 }, { label: '1.5x', color: '#8b5cf6', chance: 20 }, { label: '3x', color: '#f59e0b', chance: 10 }, { label: '5x', color: '#10b981', chance: 4 }, { label: '25x', color: '#f97316', chance: 1 }, { label: 'LOSE', color: '#ef4444', chance: 35 }] as item}
						<div class="flex justify-between text-xs">
							<span class="flex items-center gap-1.5">
								<span class="w-2 h-2 rounded-full inline-block" style="background:{item.color}"></span>
								{item.label}
							</span>
							<span class="text-muted-foreground">{item.chance}% chance</span>
						</div>
					{/each}
				</div>

				<Button class="h-14 w-full text-xl" onclick={spin} disabled={!canBet}>
					{isSpinning ? 'Spinning...' : 'Spin!'}
				</Button>
			</div>
		</div>
	</CardContent>
</Card>
