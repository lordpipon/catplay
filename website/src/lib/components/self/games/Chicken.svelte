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
	import { haptic } from '$lib/stores/haptics';

	interface StepResult {
		hitCar: boolean;
		currentLane?: number;
		currentMultiplier?: number;
		carLane?: number;
		allCarLanes?: boolean[];
		newBalance?: number;
		status: string;
		payout?: number;
	}

	const DIFFICULTIES = [
		{ id: 'easy', label: 'Easy', lanes: 24, max: '1.87x', colorClass: 'bg-green-600' },
		{ id: 'medium', label: 'Medium', lanes: 18, max: '6.07x', colorClass: 'bg-yellow-500' },
		{ id: 'hard', label: 'Hard', lanes: 14, max: '22.74x', colorClass: 'bg-orange-600' },
		{ id: 'extreme', label: 'Extreme', lanes: 10, max: '59.35x', colorClass: 'bg-red-600' }
	];

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
	let difficulty = $state('medium');
	let phase = $state<'idle' | 'playing' | 'dead' | 'won'>('idle');
	let sessionToken = $state<string | null>(null);
	let lanes = $state(18);
	let currentLane = $state(0);
	let currentMultiplier = $state(1);
	let revealedCars = $state<boolean[]>([]);
	let deadLane = $state(-1);
	let busy = $state(false);
	let lastWin = $state<{ mult: number; payout: number } | null>(null);

	let canBet = $derived(
		betAmount > 0 && betAmount <= balance && betAmount <= MAX_BET_AMOUNT && phase === 'idle'
	);
	let nextMultiplier = $derived(currentMultiplier * (difficulty === 'easy' ? 1.031 : difficulty === 'medium' ? 1.111 : difficulty === 'hard' ? 1.25 : 1.515));

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

	async function startGame() {
		if (!canBet || busy) return;
		busy = true;
		try {
			const res = await fetch('/api/arcade/chicken/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ betAmount, difficulty })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to start game');

			sessionToken = data.sessionToken;
			balance = data.newBalance;
			lanes = data.lanes;
			currentLane = 0;
			currentMultiplier = 1;
			revealedCars = [];
			deadLane = -1;
			lastWin = null;
			onBalanceUpdate?.(data.newBalance);
			haptic.trigger('selection');
			phase = 'playing';
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to start game');
		} finally {
			busy = false;
		}
	}

	async function step() {
		if (phase !== 'playing' || busy || !sessionToken) return;
		busy = true;
		try {
			const res = await fetch('/api/arcade/chicken/step', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionToken })
			});
			const data: StepResult & { error?: string } = await res.json();
			if (!res.ok) throw new Error((data as any).error || 'Step failed');

			if (data.hitCar) {
				deadLane = data.carLane ?? currentLane;
				revealedCars = data.allCarLanes ?? [];
				balance = data.newBalance ?? balance;
				onBalanceUpdate?.(balance);
				playSound('lose');
				haptic.trigger('error');
				toast.error('Splat! The chicken got hit.');
				endGame();
			} else {
				currentLane = data.currentLane ?? currentLane + 1;
				currentMultiplier = data.currentMultiplier ?? currentMultiplier;
				revealedCars = [...revealedCars];
				revealedCars[currentLane - 1] = false;
				haptic.trigger('success');
				playSound('click');

				if (data.status === 'won') {
					balance = data.newBalance ?? balance;
					onBalanceUpdate?.(balance);
					lastWin = { mult: currentMultiplier, payout: data.payout ?? 0 };
					showConfetti(confetti);
					playSound('win');
					toast.success(`Crossed the road! ${currentMultiplier.toFixed(2)}x`);
					endGame();
				}
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Step failed');
			endGame();
		} finally {
			busy = false;
		}
	}

	async function cashOut() {
		if (phase !== 'playing' || busy || !sessionToken || currentLane === 0) return;
		busy = true;
		try {
			const res = await fetch('/api/arcade/chicken/cashout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionToken })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Cashout failed');

			balance = data.newBalance;
			onBalanceUpdate?.(data.newBalance);
			lastWin = { mult: data.multiplier, payout: data.payout };
			revealedCars = data.allCarLanes ?? [];
			showConfetti(confetti);
			playSound('win');
			haptic.trigger('success');
			toast.success(`Cashed out ${data.multiplier.toFixed(2)}x — +${formatValue(data.payout - betAmount)}`);
			endGame();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Cashout failed');
		} finally {
			busy = false;
		}
	}

	function endGame() {
		sessionToken = null;
		phase = 'idle';
	}
</script>

<Card>
	<CardHeader>
		<CardTitle>Chicken Road</CardTitle>
		<CardDescription>
			Guide the chicken across. Every lane multiplies your bet — cash out before a car ends it.
		</CardDescription>
	</CardHeader>
	<CardContent>
		<div class="grid gap-6 lg:grid-cols-[280px_1fr]">
			<!-- Left: Road -->
			<div class="flex flex-col items-center gap-3">
				<div
					class="relative w-full overflow-hidden rounded-lg border-2 border-gray-700 bg-gray-800 p-2"
					style="height:340px;"
				>
					<div class="flex h-full flex-col-reverse justify-start gap-[3px]">
						{#each Array(lanes) as _, i}
							{@const isChickenHere = phase === 'playing' && i === currentLane}
							{@const isDead = i === deadLane}
							{@const showCar = isDead || (revealedCars.length > 0 && revealedCars[i])}
							{@const passed = phase !== 'playing' ? i < currentLane : i < currentLane}
							<div
								class="relative flex min-h-0 flex-1 items-center rounded-sm transition-colors duration-200
									{i % 2 === 0 ? 'bg-gray-700/60' : 'bg-gray-700/30'}"
								style="border-top:{i > 0 ? '2px dashed rgba(255,255,255,0.15)' : 'none'};"
							>
								{#if isChickenHere}
									<div class="absolute left-2 z-10" style="bottom:50%;transform:translateY(50%);">
										<svg width="26" height="26" viewBox="0 0 24 24" class="drop-shadow">
											<ellipse cx="12" cy="14" rx="8" ry="7" fill="#fafafa" />
											<circle cx="17" cy="9" r="5" fill="#fafafa" />
											<polygon points="21.5,8 25,9.5 21.5,11" fill="#f97316" />
											<circle cx="18.5" cy="8" r="1" fill="#111" />
											<path d="M11 4 q1 -3 3 -1 l1 -2 q2 1 1 3 z" fill="#dc2626" />
											<path d="M9 20 l-1.5 3 M13 20 l0.5 3" stroke="#f59e0b" stroke-width="1.6" />
										</svg>
									</div>
								{/if}
								{#if showCar && !(phase === 'playing' && !isDead)}
									<div class="absolute right-2" style="top:50%;transform:translateY(-50%);">
										<svg width="34" height="18" viewBox="0 0 34 18">
											<rect x="2" y="4" width="24" height="9" rx="3" fill={isDead ? '#ef4444' : '#3b82f6'} />
											<path d="M26 7 l6 3 v3 h-6 z" fill={isDead ? '#ef4444' : '#3b82f6'} />
											<rect x="27" y="7.5" width="4" height="2.5" rx="0.5" fill="#bae6fd" />
											<circle cx="8" cy="14" r="3" fill="#18181b" />
											<circle cx="8" cy="14" r="1.2" fill="#a1a1aa" />
											<circle cx="24" cy="14" r="3" fill="#18181b" />
											<circle cx="24" cy="14" r="1.2" fill="#a1a1aa" />
										</svg>
									</div>
								{/if}
								{#if passed && phase !== 'playing'}
									<span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-white/30">{i + 1}</span>
								{/if}
							</div>
						{/each}
					</div>
					{#if phase === 'playing'}
						<div class="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs font-bold text-yellow-400">
							{currentMultiplier.toFixed(2)}x → {nextMultiplier.toFixed(2)}x
						</div>
					{/if}
				</div>

				{#if lastWin}
					<div class="w-full rounded-lg bg-muted/50 p-2 text-center">
						<p class="font-semibold text-green-500">Cashed out {lastWin.mult.toFixed(2)}x</p>
						<p class="text-sm">+{formatValue(lastWin.payout - betAmount)}</p>
					</div>
				{:else if deadLane >= 0}
					<div class="w-full rounded-lg bg-muted/50 p-2 text-center">
						<p class="font-semibold text-red-500">LOSS</p>
						<p class="text-sm">-{formatValue(betAmount)}</p>
					</div>
				{/if}
			</div>

			<!-- Right: Controls -->
			<div class="space-y-4">
				<div>
					<div class="mb-2 text-sm font-medium">Difficulty</div>
					<div class="grid grid-cols-2 gap-2">
						{#each DIFFICULTIES as d}
							<Button
								variant={difficulty === d.id ? 'default' : 'outline'}
								class="h-10 text-xs"
								disabled={phase === 'playing'}
								onclick={() => {
									difficulty = d.id;
									lanes = d.lanes;
									haptic.trigger('selection');
								}}
							>
								<span class="flex items-center gap-1.5">
									<span class="h-3 w-3 inline-block rounded-full {d.colorClass}"></span>
									{d.label} <span class="text-muted-foreground">({d.lanes} · max {d.max})</span>
								</span>
							</Button>
						{/each}
					</div>
				</div>

				<div>
					<label class="mb-2 block text-sm font-medium" for="chicken-bet">Bet Amount</label>
					<Input
						id="chicken-bet"
						type="text"
						value={betAmountDisplay}
						oninput={handleBetAmountInput}
						onblur={handleBetAmountBlur}
						disabled={phase === 'playing'}
						placeholder="Enter bet amount"
					/>
					<div class="mt-2 grid grid-cols-4 gap-2">
						{#each [0.25, 0.5, 0.75, 1] as pct}
							<Button
								size="sm"
								variant="outline"
								disabled={phase === 'playing'}
								onclick={() => setBetAmount(Math.floor(Math.min(balance, MAX_BET_AMOUNT) * pct))}
							>
								{pct === 1 ? 'Max' : `${pct * 100}%`}
							</Button>
						{/each}
					</div>
				</div>

				{#if phase !== 'playing'}
					<Button class="h-12 w-full text-lg" onclick={startGame} disabled={!canBet || busy}>
						{busy ? 'Starting...' : 'Start Crossing'}
					</Button>
				{:else}
					<div class="grid grid-cols-2 gap-2">
						<Button class="h-12 text-base" onclick={step} disabled={busy}>
							Move Forward ({currentLane}/{lanes})
						</Button>
						<Button
							class="h-12 text-base"
							variant="secondary"
							onclick={cashOut}
							disabled={busy || currentLane === 0}
						>
							Cash Out {currentMultiplier.toFixed(2)}x
						</Button>
					</div>
				{/if}
			</div>
		</div>
	</CardContent>
</Card>
