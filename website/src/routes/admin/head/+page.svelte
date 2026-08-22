<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Shield01Icon,
		UserCheck01Icon,
		Cancel01Icon,
		Coins01Icon,
		StarIcon,
		Notification01Icon,
		Delete01Icon,
		GemIcon
	} from '@hugeicons/core-free-icons';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { formatRelativeTime } from '$lib/utils';

	// Toggle Admin State
	let usernameToAction = $state('');
	let actionLoading = $state(false);

	// Balance State
	let balanceUsername = $state('');
	let balanceAmount = $state('');
	let balanceLoading = $state(false);
	// Gems State
	let gemsUsername = $state('');
	let gemsAmount = $state('');
	let gemsLoading = $state(false);

	// Prestige State
	let prestigeUsername = $state('');
	let prestigeLevel = $state('');
	let prestigeLoading = $state(false);

	// Delist State
	let delistCoinSymbol = $state('');
	let delistLoading = $state(false);

	// Remove Portfolio State
	let removePortfolioUsername = $state('');
	let removePortfolioSymbol = $state('');
	let removePortfolioLoading = $state(false);

	// Event State
	let eventMultiplier = $state(1);
	let eventLabel = $state('');
	let eventActive = $state(false);
	let eventEndsAt = $state('');
	let eventLoading = $state(false);

	// Changelog State
	interface ChangelogEntry { id: number; title: string; content: string; tag: string; createdAt: string; }
	let changelogEntries = $state<ChangelogEntry[]>([]);
	let newTitle = $state('');
	let newContent = $state('');
	let newTag = $state('update');
	let changelogLoading = $state(false);

	const TAGS = ['update', 'feature', 'fix', 'hotfix', 'event', 'maintenance'];
	const TAG_COLORS: Record<string, string> = {
		update: 'bg-blue-500/20 text-blue-400',
		fix: 'bg-green-500/20 text-green-400',
		feature: 'bg-purple-500/20 text-purple-400',
		event: 'bg-orange-500/20 text-orange-400',
		hotfix: 'bg-red-500/20 text-red-400',
		maintenance: 'bg-gray-500/20 text-gray-400'
	};

	onMount(async () => {
		// Load event settings
		const evRes = await fetch('/api/admin/head/event');
		if (evRes.ok) {
			const d = await evRes.json();
			eventMultiplier = d.multiplier;
			eventLabel = d.label === 'Normal' ? '' : d.label;
			eventActive = d.active;
			eventEndsAt = d.endsAt ? d.endsAt.slice(0, 16) : '';
		}
		// Load changelog
		await loadChangelog();
	});

	async function loadChangelog() {
		const res = await fetch('/api/admin/head/changelog');
		if (res.ok) changelogEntries = await res.json();
	}

	async function toggleAdmin(makeAdmin: boolean) {
		if (!usernameToAction.trim()) return;
		actionLoading = true;
		try {
			const response = await fetch('/api/admin/head/toggle-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: usernameToAction.trim(), makeAdmin })
			});
			if (response.ok) { toast.success((await response.json()).message); usernameToAction = ''; }
			else toast.error((await response.json()).message || 'Failed');
		} catch { toast.error('Server error'); } finally { actionLoading = false; }
	}

	async function updateBalance(action: 'set' | 'add' | 'subtract') {
		const amountNum = Number(balanceAmount);
		if (!balanceUsername.trim() || isNaN(amountNum)) { toast.error('Provide a valid username and amount.'); return; }
		balanceLoading = true;
		try {
			const response = await fetch('/api/admin/head/balance', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: balanceUsername.trim(), amount: amountNum, action })
			});
			if (response.ok) { toast.success((await response.json()).message); balanceUsername = ''; balanceAmount = ''; }
			else toast.error((await response.json()).message || 'Failed');
		} catch { toast.error('Server error'); } finally { balanceLoading = false; }
	}

	async function updateGems(action: 'set' | 'add' | 'subtract') {
		const amountNum = Number(gemsAmount);
		if (!gemsUsername.trim() || isNaN(amountNum) || !Number.isInteger(amountNum)) { toast.error('Provide a valid username and whole gem amount.'); return; }
		gemsLoading = true;
		try {
			const response = await fetch('/api/admin/head/gems', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: gemsUsername.trim(), amount: amountNum, action })
			});
			if (response.ok) { toast.success((await response.json()).message); gemsUsername = ''; gemsAmount = ''; }
			else toast.error((await response.json()).message || 'Failed');
		} catch { toast.error('Server error'); } finally { gemsLoading = false; }
	}

	async function updatePrestige() {
		const levelNum = parseInt(prestigeLevel);
		if (!prestigeUsername.trim() || isNaN(levelNum) || levelNum < 0) { toast.error('Provide valid username and level.'); return; }
		prestigeLoading = true;
		try {
			const response = await fetch('/api/admin/head/prestige', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: prestigeUsername.trim(), level: levelNum })
			});
			if (response.ok) { toast.success((await response.json()).message); prestigeUsername = ''; prestigeLevel = ''; }
			else toast.error((await response.json()).message || 'Failed');
		} catch { toast.error('Server error'); } finally { prestigeLoading = false; }
	}

	async function delistCoin() {
		if (!delistCoinSymbol.trim()) return;
		delistLoading = true;
		try {
			const response = await fetch('/api/admin/head/delist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ coinSymbol: delistCoinSymbol.trim() })
			});
			if (response.ok) { toast.success((await response.json()).message); delistCoinSymbol = ''; }
			else toast.error((await response.json()).message || 'Failed');
		} catch { toast.error('Server error'); } finally { delistLoading = false; }
	}

	async function removePortfolio() {
		if (!removePortfolioUsername.trim() || !removePortfolioSymbol.trim()) return;
		removePortfolioLoading = true;
		try {
			const response = await fetch('/api/admin/head/remove-portfolio', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: removePortfolioUsername.trim(), coinSymbol: removePortfolioSymbol.trim() })
			});
			if (response.ok) { toast.success((await response.json()).message); removePortfolioUsername = ''; removePortfolioSymbol = ''; }
			else toast.error((await response.json()).message || 'Failed');
		} catch { toast.error('Server error'); } finally { removePortfolioLoading = false; }
	}

	async function saveEvent() {
		eventLoading = true;
		try {
			const response = await fetch('/api/admin/head/event', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					multiplier: eventMultiplier,
					label: eventLabel || (eventMultiplier + 'x Event'),
					active: eventActive,
					endsAt: eventEndsAt ? new Date(eventEndsAt).toISOString() : ''
				})
			});
			if (response.ok) toast.success('Event settings saved!');
			else toast.error('Failed to save event settings');
		} catch { toast.error('Server error'); } finally { eventLoading = false; }
	}

	async function postChangelog() {
		if (!newTitle.trim() || !newContent.trim()) { toast.error('Title and content are required'); return; }
		changelogLoading = true;
		try {
			const response = await fetch('/api/admin/head/changelog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim(), tag: newTag })
			});
			if (response.ok) { toast.success('Post published!'); newTitle = ''; newContent = ''; newTag = 'update'; await loadChangelog(); }
			else toast.error('Failed to post');
		} catch { toast.error('Server error'); } finally { changelogLoading = false; }
	}

	async function deleteChangelog(id: number) {
		const response = await fetch('/api/admin/head/changelog', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		if (response.ok) { toast.success('Deleted'); await loadChangelog(); }
		else toast.error('Failed to delete');
	}
</script>

<div class="container mx-auto max-w-4xl space-y-6 py-6">
	<div class="flex items-center gap-2">
		<HugeiconsIcon icon={Shield01Icon} class="h-6 w-6 text-orange-500" />
		<h1 class="text-2xl font-bold">Head Admin Panel</h1>
	</div>

	<Tabs.Root value="users">
		<Tabs.List class="w-full">
			<Tabs.Trigger value="users">Users</Tabs.Trigger>
			<Tabs.Trigger value="economy">Economy</Tabs.Trigger>
			<Tabs.Trigger value="events">Events</Tabs.Trigger>
			<Tabs.Trigger value="changelog">Changelog</Tabs.Trigger>
		</Tabs.List>

		<!-- USERS TAB -->
		<Tabs.Content value="users" class="space-y-4 mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={UserCheck01Icon} class="h-5 w-5 text-orange-500" />
						Toggle Admin
					</Card.Title>
					<Card.Description>Grant or revoke admin privileges.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="max-w-md space-y-4">
						<Input bind:value={usernameToAction} placeholder="Username (without @)" />
						<div class="flex gap-3">
							<Button onclick={() => toggleAdmin(true)} disabled={!usernameToAction.trim() || actionLoading} class="flex-1 bg-orange-500 text-white hover:bg-orange-600">Make Admin</Button>
							<Button variant="destructive" onclick={() => toggleAdmin(false)} disabled={!usernameToAction.trim() || actionLoading} class="flex-1">Revoke Admin</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={Cancel01Icon} class="h-5 w-5 text-red-500" />
						Coin Management
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="max-w-md space-y-2">
						<p class="text-sm font-medium">Delist Coin</p>
						<div class="flex gap-2">
							<Input bind:value={delistCoinSymbol} placeholder="Coin symbol (e.g. BTC)" />
							<Button variant="destructive" onclick={delistCoin} disabled={!delistCoinSymbol.trim() || delistLoading}>Delist</Button>
						</div>
					</div>
					<div class="max-w-md space-y-2">
						<p class="text-sm font-medium">Remove Portfolio Entry</p>
						<Input bind:value={removePortfolioUsername} placeholder="Username" class="mb-2" />
						<div class="flex gap-2">
							<Input bind:value={removePortfolioSymbol} placeholder="Coin symbol" />
							<Button variant="destructive" onclick={removePortfolio} disabled={!removePortfolioUsername.trim() || !removePortfolioSymbol.trim() || removePortfolioLoading}>Remove</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={StarIcon} class="h-5 w-5 text-yellow-500" />
						Prestige
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="max-w-md space-y-3">
						<Input bind:value={prestigeUsername} placeholder="Username" />
						<div class="flex gap-2">
							<Input type="number" min="0" bind:value={prestigeLevel} placeholder="Prestige level" />
							<Button onclick={updatePrestige} disabled={!prestigeUsername.trim() || !prestigeLevel || prestigeLoading} class="bg-yellow-500 text-white hover:bg-yellow-600">Set</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- ECONOMY TAB -->
		<Tabs.Content value="economy" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={Coins01Icon} class="h-5 w-5 text-green-500" />
						Balance Management
					</Card.Title>
					<Card.Description>Set, add, or subtract from a user's balance.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="max-w-md space-y-4">
						<Input bind:value={balanceUsername} placeholder="Username (without @)" />
						<Input type="number" bind:value={balanceAmount} placeholder="Amount" step="0.01" />
						<div class="flex gap-2">
							<Button onclick={() => updateBalance('set')} disabled={!balanceUsername.trim() || !balanceAmount || balanceLoading} class="flex-1 bg-blue-500 text-white hover:bg-blue-600">Set Exact</Button>
							<Button onclick={() => updateBalance('add')} disabled={!balanceUsername.trim() || !balanceAmount || balanceLoading} class="flex-1 bg-green-500 text-white hover:bg-green-600">+ Add</Button>
							<Button variant="destructive" onclick={() => updateBalance('subtract')} disabled={!balanceUsername.trim() || !balanceAmount || balanceLoading} class="flex-1">- Subtract</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="mt-4">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={GemIcon} class="h-5 w-5 text-purple-400" />
						Gems Management
					</Card.Title>
					<Card.Description>Set, add, or subtract gems from a user.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="max-w-md space-y-4">
						<Input bind:value={gemsUsername} placeholder="Username (without @)" />
						<Input type="number" bind:value={gemsAmount} placeholder="Gems" step="1" min="0" />
						<div class="flex gap-2">
							<Button onclick={() => updateGems('set')} disabled={!gemsUsername.trim() || !gemsAmount || gemsLoading} class="flex-1 bg-blue-500 text-white hover:bg-blue-600">Set Exact</Button>
							<Button onclick={() => updateGems('add')} disabled={!gemsUsername.trim() || !gemsAmount || gemsLoading} class="flex-1 bg-green-500 text-white hover:bg-green-600">+ Add</Button>
							<Button variant="destructive" onclick={() => updateGems('subtract')} disabled={!gemsUsername.trim() || !gemsAmount || gemsLoading} class="flex-1">- Subtract</Button>
						</div>
					</div>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- EVENTS TAB -->
		<Tabs.Content value="events" class="mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={StarIcon} class="h-5 w-5 text-orange-400" />
						Global Arcade Multiplier
					</Card.Title>
					<Card.Description>Set a global payout multiplier for all arcade games. 2x means players win double. Active events show a banner on the arcade page.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-5">
					<div class="grid grid-cols-2 gap-4 max-w-md">
						<div>
							<label class="mb-2 block text-sm font-medium">Multiplier</label>
							<Input type="number" min="1" max="100" step="0.5" bind:value={eventMultiplier} placeholder="e.g. 2" />
						</div>
						<div>
							<label class="mb-2 block text-sm font-medium">Label</label>
							<Input bind:value={eventLabel} placeholder="e.g. Weekend 2x Event" />
						</div>
					</div>
					<div class="max-w-md">
						<label class="mb-2 block text-sm font-medium">Ends At (optional)</label>
						<Input type="datetime-local" bind:value={eventEndsAt} />
						<p class="text-muted-foreground mt-1 text-xs">Leave blank for no end date.</p>
					</div>
					<div class="flex items-center gap-3">
						<button
							onclick={() => eventActive = !eventActive}
							class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors {eventActive ? 'bg-orange-500' : 'bg-muted'}"
						>
							<span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {eventActive ? 'translate-x-6' : 'translate-x-1'}"></span>
						</button>
						<span class="text-sm">{eventActive ? 'Event ACTIVE' : 'Event inactive'}</span>
					</div>

					<!-- Preview -->
					{#if eventActive}
						<div class="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
							<p class="text-orange-400 font-semibold text-sm">Preview — Banner shown on arcade page:</p>
							<p class="text-orange-300 mt-1">{eventLabel || eventMultiplier + 'x Event'} — All winnings are multiplied by {eventMultiplier}x{eventEndsAt ? ` until ${new Date(eventEndsAt).toLocaleString()}` : ''}!</p>
						</div>
					{/if}

					<Button onclick={saveEvent} disabled={eventLoading} class="bg-orange-500 text-white hover:bg-orange-600">
						{eventLoading ? 'Saving...' : 'Save Event Settings'}
					</Button>
				</Card.Content>
			</Card.Root>
		</Tabs.Content>

		<!-- CHANGELOG TAB -->
		<Tabs.Content value="changelog" class="space-y-4 mt-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={Notification01Icon} class="h-5 w-5 text-blue-400" />
						Post Update
					</Card.Title>
				</Card.Header>
				<Card.Content class="space-y-4">
					<Input bind:value={newTitle} placeholder="Update title..." />
					<Textarea bind:value={newContent} placeholder="What changed? Markdown-like text is fine." rows={4} />
					<div class="flex items-center gap-3">
						<label class="text-sm font-medium">Tag:</label>
						<div class="flex gap-2 flex-wrap">
							{#each TAGS as tag}
								<button
									onclick={() => newTag = tag}
									class="rounded px-2 py-0.5 text-xs border transition-all {newTag === tag ? TAG_COLORS[tag] + ' border-current' : 'border-muted text-muted-foreground hover:border-foreground'}"
								>{tag}</button>
							{/each}
						</div>
					</div>
					<Button onclick={postChangelog} disabled={!newTitle.trim() || !newContent.trim() || changelogLoading} class="bg-blue-500 text-white hover:bg-blue-600">
						{changelogLoading ? 'Posting...' : 'Publish'}
					</Button>
				</Card.Content>
			</Card.Root>

			<!-- Existing entries -->
			<div class="space-y-3">
				{#each changelogEntries as entry}
					<Card.Root>
						<Card.Content class="p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<span class="font-medium">{entry.title}</span>
										<span class="rounded px-1.5 py-0.5 text-xs {TAG_COLORS[entry.tag] ?? ''}">{entry.tag}</span>
										<span class="text-muted-foreground text-xs">{formatRelativeTime(entry.createdAt)}</span>
									</div>
									<p class="text-muted-foreground text-sm whitespace-pre-wrap">{entry.content}</p>
								</div>
								<Button variant="ghost" size="sm" onclick={() => deleteChangelog(entry.id)} class="text-red-400 hover:text-red-300 shrink-0">
									<HugeiconsIcon icon={Delete01Icon} class="h-4 w-4" />
								</Button>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}
				{#if changelogEntries.length === 0}
					<p class="text-muted-foreground text-sm text-center py-4">No changelog entries yet.</p>
				{/if}
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>
