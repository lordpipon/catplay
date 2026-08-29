<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SEO from '$lib/components/self/SEO.svelte';
	import { toast } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { UserAdd01Icon, UserCheck01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { goto } from '$app/navigation';
	import { getPublicUrl } from '$lib/utils';

	interface Friend {
		id: number; requesterId: number; addresseeId: number; status: string;
		requesterName: string; requesterUsername: string; requesterImage: string | null;
		addresseeName: string; addresseeUsername: string; addresseeImage: string | null;
	}

	let friends = $state<Friend[]>([]);
	let loading = $state(true);
	let addUsername = $state('');
	let adding = $state(false);
	let activeTab = $state<'friends'|'pending'>('friends');

	const myId = $derived(Number($USER_DATA?.id));

	let accepted = $derived(friends.filter(f => f.status === 'accepted'));
	let incoming = $derived(friends.filter(f => f.status === 'pending' && f.addresseeId === myId));
	let outgoing = $derived(friends.filter(f => f.status === 'pending' && f.requesterId === myId));

	function getFriendUser(f: Friend) {
		// "other" is the user who is NOT me
		const otherIsRequester = f.requesterId !== myId;
		return otherIsRequester
			? { name: f.requesterName, username: f.requesterUsername, image: f.requesterImage }
			: { name: f.addresseeName, username: f.addresseeUsername, image: f.addresseeImage };
	}

	onMount(async () => {
		if (!$USER_DATA) { goto('/'); return; }
		await loadFriends();
		loading = false;
	});

	async function loadFriends() {
		const res = await fetch('/api/friends');
		if (res.ok) {
			try { friends = await res.json(); } catch { friends = []; }
		}
	}

	async function sendRequest() {
		if (!addUsername.trim()) return;
		adding = true;
		try {
			// Look up user by username
			const res = await fetch(`/api/user/lookup?username=${encodeURIComponent(addUsername.trim())}`);
			if (!res.ok) { toast.error('User not found'); return; }
			const target = await res.json();
			const r = await fetch('/api/friends', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetUserId: target.id, action: 'send' })
			});
			const d = await r.json();
			if (!r.ok) { toast.error(d.error || 'Failed'); return; }
			toast.success('Friend request sent!');
			addUsername = '';
			await loadFriends();
		} finally { adding = false; }
	}

	async function respond(f: Friend, action: 'accept'|'decline'|'remove') {
		const otherId = f.requesterId === myId ? f.addresseeId : f.requesterId;
		const r = await fetch('/api/friends', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ targetUserId: otherId, action })
		});
		if (r.ok) { toast.success(action === 'accept' ? 'Friend added!' : 'Removed'); await loadFriends(); }
		else toast.error('Failed');
	}
</script>

<SEO title="Friends | Catplay" description="Manage your friends and messages." />

<div class="mx-auto max-w-2xl space-y-4 p-4">
	<div class="flex items-center gap-3">
		<HugeiconsIcon icon={UserAdd01Icon} class="h-6 w-6" />
		<h1 class="text-2xl font-bold">Friends</h1>
	</div>

	<!-- Add friend -->
	<Card.Root>
		<Card.Content class="p-4">
			<div class="flex gap-2">
				<Input bind:value={addUsername} placeholder="Add friend by username..." onkeydown={(e) => e.key === 'Enter' && sendRequest()} />
				<Button onclick={sendRequest} disabled={adding || !addUsername.trim()}>
					<HugeiconsIcon icon={UserAdd01Icon} class="h-4 w-4 mr-1" />
					Add
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Tabs -->
	<div class="flex gap-2 border-b pb-2">
		{#each [['friends', `Friends (${accepted.length})`], ['pending', `Pending (${incoming.length + outgoing.length})`]] as [tab, label]}
			<button
				onclick={() => activeTab = tab as any}
				class="px-3 py-1.5 text-sm rounded-md transition-colors {activeTab === tab ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}"
			>{label}</button>
		{/each}
	</div>

	{#if loading}
		<Card.Root><Card.Content class="p-8 text-center text-muted-foreground">Loading...</Card.Content></Card.Root>
	{:else if activeTab === 'friends'}
		{#if accepted.length === 0}
			<Card.Root><Card.Content class="p-8 text-center text-muted-foreground">No friends yet. Add someone!</Card.Content></Card.Root>
		{:else}
			<div class="space-y-2">
				{#each accepted as f}
					{@const other = getFriendUser(f)}
					<Card.Root>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9">
								<Avatar.Image src={getPublicUrl(other.image)} alt={other.name} />
								<Avatar.Fallback>{other.name?.[0]}</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1">
								<p class="font-medium text-sm">{other.name}</p>
								<p class="text-muted-foreground text-xs">@{other.username}</p>
							</div>
							<Button size="sm" variant="ghost" class="text-red-400 hover:text-red-300" onclick={() => respond(f, 'remove')}>
								<HugeiconsIcon icon={Cancel01Icon} class="h-4 w-4" />
							</Button>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}

	{:else if activeTab === 'pending'}
		<div class="space-y-4">
			{#if incoming.length > 0}
				<h3 class="text-sm font-medium text-muted-foreground">Incoming Requests</h3>
				{#each incoming as f}
					{@const other = getFriendUser(f)}
					<Card.Root>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9">
								<Avatar.Image src={getPublicUrl(other.image)} />
								<Avatar.Fallback>{other.name?.[0]}</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1">
								<p class="font-medium text-sm">{other.name}</p>
								<p class="text-muted-foreground text-xs">@{other.username}</p>
							</div>
							<Button size="sm" class="bg-green-600 hover:bg-green-500" onclick={() => respond(f, 'accept')}>
								<HugeiconsIcon icon={UserCheck01Icon} class="h-4 w-4 mr-1" />Accept
							</Button>
							<Button size="sm" variant="ghost" class="text-red-400" onclick={() => respond(f, 'decline')}>
								<HugeiconsIcon icon={Cancel01Icon} class="h-4 w-4" />
							</Button>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
			{#if outgoing.length > 0}
				<h3 class="text-sm font-medium text-muted-foreground">Sent Requests</h3>
				{#each outgoing as f}
					{@const other = getFriendUser(f)}
					<Card.Root>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9">
								<Avatar.Image src={getPublicUrl(other.image)} />
								<Avatar.Fallback>{other.name?.[0]}</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1">
								<p class="font-medium text-sm">{other.name}</p>
								<p class="text-muted-foreground text-xs">@{other.username} · waiting for response</p>
							</div>
							<Button size="sm" variant="ghost" class="text-red-400" onclick={() => respond(f, 'remove')}>Cancel</Button>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
			{#if incoming.length === 0 && outgoing.length === 0}
				<Card.Root><Card.Content class="p-8 text-center text-muted-foreground">No pending requests.</Card.Content></Card.Root>
			{/if}
		</div>
	{/if}
</div>
