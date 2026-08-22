<script lang="ts">
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import SEO from '$lib/components/self/SEO.svelte';
	import { toast } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { UserAdd01Icon, UserCheck01Icon, Cancel01Icon, Message01Icon } from '@hugeicons/core-free-icons';
	import { USER_DATA } from '$lib/stores/user-data';
	import { goto } from '$app/navigation';
	import { getPublicUrl } from '$lib/utils';

	interface Friend {
		id: number; requesterId: number; addresseeId: number; status: string;
		requesterName: string; requesterUsername: string; requesterImage: string;
	}

	let friends = $state<Friend[]>([]);
	let loading = $state(true);
	let addUsername = $state('');
	let adding = $state(false);
	let activeTab = $state<'friends'|'pending'|'messages'>('friends');
	let dmThreads = $state<any[]>([]);

	const myId = $derived($USER_DATA?.id);

	let accepted = $derived(friends.filter(f => f.status === 'accepted'));
	let incoming = $derived(friends.filter(f => f.status === 'pending' && f.addresseeId === myId));
	let outgoing = $derived(friends.filter(f => f.status === 'pending' && f.requesterId === myId));

	function getFriendUser(f: Friend) {
		const isRequester = f.requesterId === myId;
		return {
			name: isRequester ? f.requesterName : f.requesterName, // same field for now
			username: f.requesterUsername,
			image: f.requesterImage
		};
	}

	onMount(async () => {
		if (!$USER_DATA) { goto('/'); return; }
		await loadFriends();
		await loadDMs();
		loading = false;
	});

	async function loadFriends() {
		const res = await fetch('/api/friends');
		if (res.ok) friends = await res.json();
	}

	async function loadDMs() {
		const res = await fetch('/api/dm');
		if (res.ok) dmThreads = await res.json();
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
		{#each [['friends', `Friends (${accepted.length})`], ['pending', `Pending (${incoming.length + outgoing.length})`], ['messages', 'Messages']] as [tab, label]}
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
					<Card.Root>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9">
								<Avatar.Image src={getPublicUrl(f.requesterImage)} alt={f.requesterName} />
								<Avatar.Fallback>{f.requesterName?.[0]}</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1">
								<p class="font-medium text-sm">{f.requesterName}</p>
								<p class="text-muted-foreground text-xs">@{f.requesterUsername}</p>
							</div>
							<Button size="sm" variant="ghost" onclick={() => goto(`/friends?dm=${f.requesterId === myId ? f.addresseeId : f.requesterId}`)}>
								<HugeiconsIcon icon={Message01Icon} class="h-4 w-4" />
							</Button>
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
					<Card.Root>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9">
								<Avatar.Image src={getPublicUrl(f.requesterImage)} />
								<Avatar.Fallback>{f.requesterName?.[0]}</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1">
								<p class="font-medium text-sm">{f.requesterName}</p>
								<p class="text-muted-foreground text-xs">@{f.requesterUsername}</p>
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
					<Card.Root>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9"><Avatar.Fallback>?</Avatar.Fallback></Avatar.Root>
							<div class="flex-1"><p class="text-sm text-muted-foreground">Waiting for response...</p></div>
							<Button size="sm" variant="ghost" class="text-red-400" onclick={() => respond(f, 'remove')}>Cancel</Button>
						</Card.Content>
					</Card.Root>
				{/each}
			{/if}
			{#if incoming.length === 0 && outgoing.length === 0}
				<Card.Root><Card.Content class="p-8 text-center text-muted-foreground">No pending requests.</Card.Content></Card.Root>
			{/if}
		</div>

	{:else}
		<!-- Messages list -->
		{#if dmThreads.length === 0}
			<Card.Root><Card.Content class="p-8 text-center text-muted-foreground">No messages yet. Start a conversation with a friend!</Card.Content></Card.Root>
		{:else}
			<div class="space-y-2">
				{#each dmThreads as thread}
					<Card.Root class="cursor-pointer hover:bg-muted/50" onclick={() => goto(`/dm/${thread.other_user}`)}>
						<Card.Content class="p-3 flex items-center gap-3">
							<Avatar.Root class="h-9 w-9">
								<Avatar.Image src={getPublicUrl(thread.image)} />
								<Avatar.Fallback>{thread.name?.[0]}</Avatar.Fallback>
							</Avatar.Root>
							<div class="flex-1 min-w-0">
								<p class="font-medium text-sm">{thread.name}</p>
								<p class="text-muted-foreground text-xs truncate">{thread.last_message}</p>
							</div>
							{#if !thread.is_read && thread.sender_id !== myId}
								<div class="h-2 w-2 rounded-full bg-primary shrink-0"></div>
							{/if}
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		{/if}
	{/if}
</div>
