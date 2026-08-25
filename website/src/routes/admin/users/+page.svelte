<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { LegalHammerIcon, UserCheck01Icon, Cancel01Icon, CrownIcon } from '@hugeicons/core-free-icons';
	import { toast } from 'svelte-sonner';

	interface BannedUser {
		id: number;
		name: string;
		username: string;
		banReason: string;
	}

	let bannedUsers = $state<BannedUser[]>([]);
	let loading = $state(true);
	let actionLoading = $state(false);
	let banDialogOpen = $state(false);
	let usernameToAction = $state('');
	let banReason = $state('');
	let vipUsername = $state('');
	let vipLoading = $state(false);

	async function loadBannedUsers() {
		loading = true;
		try {
			const response = await fetch('/api/admin/users/banned-list');
			if (response.ok) {
				bannedUsers = await response.json();
			}
		} catch (e) {
			toast.error('Failed to load banned users');
		} finally {
			loading = false;
		}
	}

	async function banUser() {
		if (!usernameToAction.trim() || !banReason.trim()) return;

		actionLoading = true;
		try {
			const response = await fetch('/api/admin/users/ban', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: usernameToAction.trim(), reason: banReason.trim() })
			});

			if (response.ok) {
				toast.success('User banned successfully');
				await loadBannedUsers();
				banDialogOpen = false;
				usernameToAction = '';
				banReason = '';
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to ban user');
			}
		} catch (e) {
			toast.error('Failed to ban user');
		} finally {
			actionLoading = false;
		}
	}

	async function unbanUser(userId: number) {
		actionLoading = true;
		try {
			const response = await fetch('/api/admin/users/unban', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId })
			});

			if (response.ok) {
				toast.success('User unbanned successfully');
				await loadBannedUsers();
			} else {
				const error = await response.json();
				toast.error(error.message || 'Failed to unban user');
			}
		} catch (e) {
			toast.error('Failed to unban user');
		} finally {
			actionLoading = false;
		}
	}

	function openBanDialog() {
		usernameToAction = '';
		banReason = '';
		banDialogOpen = true;
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

	onMount(() => {
		loadBannedUsers();
	});
</script>

<div class="container mx-auto max-w-4xl py-6">
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between">
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={LegalHammerIcon} class="h-5 w-5" />
				Banned Users ({bannedUsers.length})
			</Card.Title>
			<Button onclick={openBanDialog}>
				<HugeiconsIcon icon={Cancel01Icon} class="h-4 w-4" />
				Ban User
			</Button>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<div class="space-y-4">
					{#each Array(5) as _}
						<div class="flex items-center justify-between rounded border p-4">
							<div class="flex-1 space-y-2">
								<Skeleton class="h-4 w-48" />
								<Skeleton class="h-3 w-32" />
								<Skeleton class="h-3 w-64" />
							</div>
							<Skeleton class="h-8 w-16" />
						</div>
					{/each}
				</div>
			{:else if bannedUsers.length === 0}
				<div class="py-8 text-center">
					<p class="text-muted-foreground">No banned users found.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each bannedUsers as user}
						<div class="flex items-center justify-between rounded border p-4">
							<div class="flex-1 space-y-1">
								<div class="font-medium">{user.name}</div>
								<div class="text-muted-foreground text-sm">@{user.username}</div>
								<div class="text-sm">
									<span class="font-medium">Reason:</span>
									{user.banReason}
								</div>
							</div>
							<Button
								size="sm"
								variant="outline"
								onclick={() => unbanUser(user.id)}
								disabled={actionLoading}
							>
								<HugeiconsIcon icon={UserCheck01Icon} class="h-4 w-4" />
								Unban
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>

	<Card.Root class="mt-6">
		<Card.Header class="flex flex-row items-center justify-between">
			<Card.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={CrownIcon} class="h-5 w-5 text-yellow-500" />
				VIP Management
			</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="flex gap-3">
				<Input
					bind:value={vipUsername}
					placeholder="Enter username"
					class="flex-1"
					onkeydown={(e) => { if (e.key === 'Enter') toggleVip(); }}
				/>
				<Button onclick={toggleVip} disabled={!vipUsername.trim() || vipLoading} variant="outline">
					<HugeiconsIcon icon={CrownIcon} class="h-4 w-4" />
					{vipLoading ? 'Toggling...' : 'Toggle VIP (30d)'}
				</Button>
			</div>
			<p class="text-muted-foreground mt-2 text-xs">Grants or revokes 30-day VIP status. Works as a toggle.</p>
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root bind:open={banDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Ban User</Dialog.Title>
			<Dialog.Description>Enter the username and reason to ban a user.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-4">
			<div>
				<label for="username" class="mb-2 block text-sm font-medium">Username</label>
				<Input
					id="username"
					bind:value={usernameToAction}
					placeholder="Enter username (without @)"
					required
				/>
			</div>
			<div>
				<label for="reason" class="mb-2 block text-sm font-medium">Reason for ban</label>
				<Textarea
					id="reason"
					bind:value={banReason}
					placeholder="Enter the reason for banning this user..."
					required
				/>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (banDialogOpen = false)}>Cancel</Button>
			<Button
				variant="destructive"
				onclick={banUser}
				disabled={!usernameToAction.trim() || !banReason.trim() || actionLoading}
			>
				Ban User
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
