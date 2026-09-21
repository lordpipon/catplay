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
		Notification01Icon,
		Delete01Icon,
		GemIcon,
		CrownIcon,
		BinaryCodeIcon,
		DiscordIcon,
		StarIcon
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

	// VIP State
	let vipUsername = $state('');
	let vipLoading = $state(false);

	// Developer Badge State
	let devUsername = $state('');
	let devLoading = $state(false);

	// Prestige State
	let prestigeUsername = $state('');
	let prestigeLevel = $state('');
	let prestigeLoading = $state(false);

	// Delist State
	let delistCoinSymbol = $state('');
	let delistLoading = $state(false);

	// Delete Coin State
	let deleteCoinSymbol = $state('');
	let deleteCoinLoading = $state(false);

	// Remove Portfolio State
	let removePortfolioUsername = $state('');
	let removePortfolioSymbol = $state('');
	let removePortfolioLoading = $state(false);

	// Changelog State
	interface ChangelogEntry { id: number; title: string; content: string; tag: string; createdAt: string; }
	let changelogEntries = $state<ChangelogEntry[]>([]);
	let newTitle = $state('');
	let newContent = $state('');
	let newTag = $state('update');
	let changelogLoading = $state(false);
	let webhookUrl = $state('');
	let webhookConfigured = $state(false);
	let webhookLoading = $state(false);

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
		// Load changelog
		await loadChangelog();
	});

	async function loadChangelog() {
		const res = await fetch('/api/admin/head/changelog');
		if (res.ok) {
			const data = await res.json();
			changelogEntries = data.entries || [];
			webhookUrl = data.webhookUrl || '';
			webhookConfigured = data.webhookConfigured || false;
		}
	}

	async function saveWebhook() {
		if (!webhookUrl.trim()) { toast.error('Paste your Discord webhook URL first.'); return; }
		webhookLoading = true;
		try {
			const res = await fetch('/api/admin/head/changelog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'set-webhook', webhookUrl: webhookUrl.trim() })
			});
			const data = await res.json();
			if (res.ok) {
				webhookConfigured = true;
				webhookUrl = data.webhookUrl || webhookUrl;
				toast.success('Discord webhook saved! New posts will appear here.');
			} else {
				toast.error(data.error || 'Failed to save webhook');
			}
		} catch { toast.error('Server error'); } finally { webhookLoading = false; }
	}

	async function clearWebhook() {
		webhookLoading = true;
		try {
			const res = await fetch('/api/admin/head/changelog', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'clear-webhook' })
			});
			if (res.ok) { webhookConfigured = false; webhookUrl = ''; toast.success('Webhook removed.'); }
			else toast.error('Failed to remove webhook');
		} catch { toast.error('Server error'); } finally { webhookLoading = false; }
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

	async function toggleVip() {
		if (!vipUsername.trim()) return;
		vipLoading = true;
		try {
			const res = await fetch('/api/admin/users/toggle-vip', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: vipUsername.trim() })
			});
			const data = await res.json();
			if (res.ok) {
				toast.success(`VIP ${data.isVip ? 'granted' : 'revoked'} for @${data.username} (30 days)`);
				vipUsername = '';
			} else {
				toast.error(data.message || 'Failed to toggle VIP');
			}
		} catch {
			toast.error('Failed to toggle VIP');
		} finally {
			vipLoading = false;
		}
	}

	async function toggleDeveloper() {
		if (!devUsername.trim()) return;
		devLoading = true;
		try {
			const res = await fetch('/api/admin/users/toggle-developer', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: devUsername.trim() })
			});
			const data = await res.json();
			if (res.ok) {
				toast.success(`Developer badge ${data.isDeveloper ? 'granted' : 'revoked'} for @${data.username}`);
				devUsername = '';
			} else {
				toast.error(data.message || 'Failed to toggle developer badge');
			}
		} catch {
			toast.error('Failed to toggle developer badge');
		} finally {
			devLoading = false;
		}
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

	async function deleteCoin() {
		if (!deleteCoinSymbol.trim() || deleteCoinLoading) return;
		deleteCoinLoading = true;
		try {
			const response = await fetch('/api/coins/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ symbol: deleteCoinSymbol.trim() })
			});
			const data = await response.json();
			if (response.ok) { toast.success(data.message || 'Coin deleted'); deleteCoinSymbol = ''; }
			else toast.error(data.error || 'Failed to delete coin');
		} catch { toast.error('Server error'); } finally { deleteCoinLoading = false; }
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
					<div class="max-w-md space-y-2 rounded-md border border-red-500/30 bg-red-500/5 p-3">
						<p class="text-sm font-medium text-red-500">Delete Coin (Permanent)</p>
						<p class="text-muted-foreground text-xs">
							Deletes the coin, its price history, comments and all holder positions. Remaining
							pool liquidity is refunded to the creator. This cannot be undone.
						</p>
						<div class="flex gap-2">
							<Input bind:value={deleteCoinSymbol} placeholder="Coin symbol (e.g. BTC)" />
							<Button variant="destructive" onclick={() => {
								if (confirm(`Permanently delete *${deleteCoinSymbol.trim().toUpperCase()}? This cannot be undone.`)) deleteCoin();
							}} disabled={!deleteCoinSymbol.trim() || deleteCoinLoading}>
								{deleteCoinLoading ? 'Deleting...' : 'Delete'}
							</Button>
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

			<Card.Root class="mt-4">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={CrownIcon} class="h-5 w-5 text-yellow-500" />
						VIP Management
					</Card.Title>
					<Card.Description>Grant or revoke 30-day VIP status.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="max-w-md flex gap-3">
						<Input
							bind:value={vipUsername}
							placeholder="Username (without @)"
							class="flex-1"
							onkeydown={(e) => { if (e.key === 'Enter') toggleVip(); }}
						/>
						<Button onclick={toggleVip} disabled={!vipUsername.trim() || vipLoading} class="bg-yellow-500 text-white hover:bg-yellow-600">
							<HugeiconsIcon icon={CrownIcon} class="h-4 w-4" />
							{vipLoading ? 'Toggling...' : 'Toggle VIP'}
						</Button>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<HugeiconsIcon icon={BinaryCodeIcon} class="h-5 w-5 text-violet-400" />
						Developer Badge
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="max-w-md flex gap-3">
						<Input
							bind:value={devUsername}
							placeholder="Username (without @)"
							class="flex-1"
							onkeydown={(e) => { if (e.key === 'Enter') toggleDeveloper(); }}
						/>
						<Button onclick={toggleDeveloper} disabled={!devUsername.trim() || devLoading} class="bg-violet-500 text-white hover:bg-violet-600">
							<HugeiconsIcon icon={BinaryCodeIcon} class="h-4 w-4" />
							{devLoading ? 'Toggling...' : 'Toggle Developer'}
						</Button>
					</div>
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

		<!-- Discord webhook sync -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<HugeiconsIcon icon={DiscordIcon} class="h-5 w-5 text-indigo-400" />
					Discord Webhook Sync
				</Card.Title>
				<Card.Description>Paste the webhook URL of a Discord channel. Every time you post there, the message is pulled in as a changelog entry automatically.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if webhookConfigured}
					<div class="flex items-center gap-2 text-sm">
						<span class="font-mono text-muted-foreground">{webhookUrl}</span>
						<span class="rounded bg-green-500/15 px-2 py-0.5 text-xs text-green-500">Connected</span>
					</div>
					<Button variant="destructive" size="sm" onclick={clearWebhook} disabled={webhookLoading}>
						{webhookLoading ? 'Removing...' : 'Disconnect'}
					</Button>
				{:else}
					<Input bind:value={webhookUrl} placeholder="https://discord.com/api/webhooks/xxxxxxxx/yyyyyyyy" />
					<p class="text-muted-foreground text-xs">Create a webhook in your Discord channel (Channel Settings → Integrations → Webhooks) and paste its URL here.</p>
					<Button onclick={saveWebhook} disabled={!webhookUrl.trim() || webhookLoading} class="bg-indigo-500 text-white hover:bg-indigo-600">
						{webhookLoading ? 'Saving...' : 'Connect Webhook'}
					</Button>
				{/if}
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
