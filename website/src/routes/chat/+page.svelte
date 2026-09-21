<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { USER_DATA } from '$lib/stores/user-data';
	import {
		CHAT_MESSAGES,
		setChatMessages,
		CHAT_UNREAD,
		clearChatUnread,
		ACTIVE_CHANNEL_ID,
		REMOVED_CHAT_CHANNEL,
		handleChatChannelRemoved,
		CHAT_CHANNEL_REFRESH
	} from '$lib/stores/chat';
	import { getPublicUrl, formatDate } from '$lib/utils';
	import SEO from '$lib/components/self/SEO.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import {
		Message01Icon,
		ArrowLeft01Icon,
		Search01Icon,
		SentIcon,
		UserGroupIcon,
		PlusSignIcon,
		UserRemove01Icon,
		Delete01Icon,
		Settings01Icon,
		UserAdd01Icon,
		UserCheck01Icon,
		Cancel01Icon,
		CrownIcon,
		CircleArrowDataTransferHorizontalIcon,
		Upload01Icon
	} from '@hugeicons/core-free-icons';

	interface ChatChannel {
		id: number | null;
		type: string;
		user1Id: number | null;
		user2Id: number | null;
		ownerId?: number | null;
		createdAt: string;
		name: string;
		image: string | null;
		kind: 'channel' | 'friend';
		partnerId?: number;
		username?: string;
		members?: { id: number; username: string; image: string | null }[];
		lastMessage: string | null;
		lastMessageAt: string | null;
		sortAt: string;
	}

	let channels = $state<ChatChannel[]>([]);
	let loadingChannels = $state(true);
	let activeChannelId = $state<number | null>(null);
	let messageInput = $state('');
	let sending = $state(false);
	let searchQuery = $state('');

	let showCreateGroup = $state(false);
	let creatingGroup = $state(false);

	let showManageGroup = $state(false);
	let removingMemberId = $state<number | null>(null);
	let deletingGroup = $state(false);
	let groupActionPending = $state(false);

	// Group settings (rename + image)
	let groupNameInput = $state('');
	let groupImageInput = $state<File | undefined>(undefined);
	let groupImagePreview = $state<string | null>(null);
	let savingGroupSettings = $state(false);
	let transferringLeaderId = $state<number | null>(null);

	$effect(() => {
		if (showManageGroup && activeChannel) {
			groupNameInput = activeChannel.name && isGroup(activeChannel) ? activeChannel.name : '';
			groupImagePreview = null;
		}
	});

	let activeChannel = $derived(channels.find((c) => c.id === activeChannelId));
	let messages = $derived($CHAT_MESSAGES[activeChannelId as number] || []);

	let scrollViewport: HTMLElement;

	function isGlobal(c: ChatChannel): boolean {
		return c.type === 'DIRECT' && c.user1Id === null && c.user2Id === null;
	}

	let filteredChannels = $derived.by(() => {
		let list = channels;
		if (searchQuery.trim()) {
			const q = searchQuery.trim().toLowerCase();
			list = list.filter((c) => (c.name || '').toLowerCase().includes(q));
		}
		return [...list].sort((a, b) => {
			const aGlobal = isGlobal(a);
			const bGlobal = isGlobal(b);
			if (aGlobal !== bGlobal) return aGlobal ? -1 : 1;
			const aAt = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
			const bAt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
			return bAt - aAt;
		});
	});

	let isGlobalSearch = $derived(searchQuery.trim().length > 0);
	let hasResults = $derived(filteredChannels.length > 0);

	// ---- Friends tab ----
	let activeTab = $state<'chats' | 'friends'>('chats');
	interface FriendRow {
		id: number;
		requesterId: number;
		addresseeId: number;
		status: string;
		requesterName: string;
		requesterUsername: string;
		requesterImage: string | null;
		addresseeName: string;
		addresseeUsername: string;
		addresseeImage: string | null;
	}
	let friendRows = $state<FriendRow[]>([]);
	let loadingFriends = $state(false);
	let addUsername = $state('');
	let addingFriend = $state(false);

	let acceptedFriends = $derived(friendRows.filter((f) => f.status === 'accepted'));
	let incomingRequests = $derived(friendRows.filter((f) => f.status === 'pending' && f.addresseeId === myUserId));
	let outgoingRequests = $derived(friendRows.filter((f) => f.status === 'pending' && f.requesterId === myUserId));

	function otherUser(f: FriendRow) {
		const otherIsRequester = f.requesterId !== myUserId;
		return otherIsRequester
			? { id: f.requesterId, name: f.requesterName, username: f.requesterUsername, image: f.requesterImage }
			: { id: f.addresseeId, name: f.addresseeName, username: f.addresseeUsername, image: f.addresseeImage };
	}

	async function loadFriends() {
		try {
			const res = await fetch('/api/friends');
			if (res.ok) friendRows = await res.json();
		} catch (e) {
			toast.error('Failed to load friends');
		} finally {
			loadingFriends = false;
		}
	}

	async function sendFriendRequest() {
		if (!addUsername.trim()) return;
		addingFriend = true;
		try {
			const res = await fetch(`/api/user/lookup?username=${encodeURIComponent(addUsername.trim())}`);
			if (!res.ok) {
				toast.error('User not found');
				return;
			}
			const target = await res.json();
			if (Number(target.id) === myUserId) {
				toast.error("You can't add yourself");
				return;
			}
			const r = await fetch('/api/friends', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ targetUserId: Number(target.id), action: 'send' })
			});
			const d = await r.json();
			if (!r.ok) {
				toast.error(d.error || 'Failed to send request');
				return;
			}
			toast.success('Friend request sent!');
			addUsername = '';
			await loadFriends();
		} catch {
			toast.error('Network error');
		} finally {
			addingFriend = false;
		}
	}

	async function respondToFriend(f: FriendRow, action: 'accept' | 'decline' | 'remove') {
		const otherId = f.requesterId === myUserId ? f.addresseeId : f.requesterId;
		const r = await fetch('/api/friends', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ targetUserId: otherId, action })
		});
		if (r.ok) {
			toast.success(action === 'accept' ? 'Friend added!' : 'Removed');
			await loadFriends();
			if (action === 'accept' || action === 'remove') await fetchChannels();
		} else {
			toast.error('Failed');
		}
	}

	function unfriendFriend(f: FriendRow) {
		if (!confirm('Remove this friend? Your private chat with them will also be deleted.')) return;
		respondToFriend(f, 'remove');
	}

	async function openFriendChat(f: FriendRow) {
		const other = otherUser(f);
		const entry: ChatChannel = {
			id: null,
			type: 'DIRECT',
			user1Id: null,
			user2Id: null,
			createdAt: new Date().toISOString(),
			name: `@${other.username}`,
			image: other.image,
			kind: 'friend',
			partnerId: other.id,
			username: other.username,
			lastMessage: null,
			lastMessageAt: null,
			sortAt: new Date().toISOString()
		};
		await openChat(entry);
	}

	onMount(async () => {
		if (!$USER_DATA) {
			goto('/');
			return;
		}

		myUserId = Number($USER_DATA?.id);
		await Promise.all([fetchChannels(), loadFriends()]);

		const channelQuery = $page.url.searchParams.get('channel');
		const userQuery = $page.url.searchParams.get('user');
		if (channelQuery) {
			const id = parseInt(channelQuery);
			const target = channels.find((c) => c.id === id);
			if (target && target.kind === 'channel') {
				selectChannel(id);
			}
		} else if (userQuery) {
			// "Message" button from the friends page: open a DM with that friend.
			const uid = parseInt(userQuery);
			const target = channels.find((c) => c.kind === 'friend' && c.partnerId === uid);
			if (target) {
				await openChat(target);
			}
		} else if (channels.length > 0) {
			selectChannel(channels[0].id!);
		}
	});

	$effect(() => {
		if (messages.length > 0 && scrollViewport) {
			setTimeout(() => {
				scrollViewport.scrollTo({ top: scrollViewport.scrollHeight, behavior: 'smooth' });
			}, 100);
		}
	});

	async function fetchChannels() {
		try {
			const res = await fetch('/api/chat/channels');
			if (res.ok) {
				const d = await res.json();
				const seen = new Set<string>();
				channels = (d.channels || []).filter((c) => {
					const key = c.id ? `id-${c.id}` : `friend-${c.partnerId}`;
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
			}
		} catch (e) {
			toast.error('Failed to load conversations');
		} finally {
			loadingChannels = false;
		}
	}

	async function selectChannel(id: number) {
		activeChannelId = id;
		ACTIVE_CHANNEL_ID.set(id);
		clearChatUnread(id);
		const url = new URL(window.location.href);
		url.searchParams.set('channel', id.toString());
		window.history.replaceState({}, '', url);

		try {
			const res = await fetch(`/api/chat/${id}/messages`);
			if (res.ok) {
				const d = await res.json();
				setChatMessages(id, d.messages || []);
			}
		} catch (e) {
			toast.error('Failed to load messages');
		}
	}

	async function openChat(entry: ChatChannel) {
		if (entry.kind === 'friend' && entry.partnerId != null) {
			try {
				const res = await fetch('/api/chat/channels', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ targetUserId: entry.partnerId })
				});
				if (!res.ok) {
					const d = await res.json();
					toast.error(d.message || d.error || 'Cannot start chat');
					return;
				}
				const d = await res.json();
				await fetchChannels();
				const fresh = channels.find((c) => c.id === d.channel.id);
				if (fresh) {
					selectChannel(fresh.id!);
				} else {
					selectChannel(d.channel.id);
				}
			} catch {
				toast.error('Network error');
			}
			return;
		}
		if (entry.id != null) selectChannel(entry.id);
	}

	async function sendMessage() {
		if (!activeChannelId || !messageInput.trim() || sending) return;

		const content = messageInput.trim();
		messageInput = '';
		sending = true;

		try {
			const res = await fetch(`/api/chat/${activeChannelId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content })
			});
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || 'Failed to send message');
				messageInput = content;
			}
		} catch {
			toast.error('Network error');
			messageInput = content;
		} finally {
			sending = false;
		}
	}

	function goBackToList() {
		activeChannelId = null;
		ACTIVE_CHANNEL_ID.set(null);
	}

	// When the websocket reports a removed channel (group deleted / member kicked),
	// drop it from the sidebar and close it if it was open.
	$effect(() => {
		const removedId = $REMOVED_CHAT_CHANNEL;
		if (removedId != null) {
			channels = channels.filter((c) => c.id !== removedId);
			if (activeChannelId === removedId) {
				ACTIVE_CHANNEL_ID.set(null);
				activeChannelId = null;
			}
			REMOVED_CHAT_CHANNEL.set(null);
		}
	});

	function substringFor(c: ChatChannel): string {
		return c.name?.charAt(c.name?.startsWith('@') ? 1 : 0)?.toUpperCase() || '?';
	}

	function relativeTime(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		const now = Date.now();
		const diff = now - d.getTime();
		if (diff < 60000) return 'now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function truncate(s: string | null, len: number): string {
		if (!s) return '';
		return s.length > len ? s.slice(0, len - 1).trimEnd() + '…' : s;
	}

	function isGroup(c: ChatChannel): boolean {
		return c.type === 'GROUP';
	}

	// Friends available to add to a new group:
	// - virtual friend entries (no DM channel yet)
	// - DM partners who already have a DIRECT channel
	let myUserId = $state(0);
	let groupFriendOptions = $derived.by(() => {
		const opt = new Map<number, string>();
		for (const c of channels) {
			if (c.kind === 'friend' && c.partnerId != null) {
				opt.set(c.partnerId, c.username ?? '');
			} else if (
				c.type === 'DIRECT' &&
				c.user1Id !== null &&
				c.user2Id !== null &&
				!isGlobal(c)
			) {
				const partnerId = Number(c.user1Id) === myUserId ? Number(c.user2Id) : Number(c.user1Id);
				if (partnerId === myUserId) continue;
				opt.set(partnerId, c.name?.replace(/^@/, '') ?? '');
			}
		}
		return [...opt].map(([id, username]) => ({ id, username }));
	});

	let selectedGroupFriends = $state<number[]>([]);

	function toggleGroupFriend(id: number) {
		if (selectedGroupFriends.includes(id)) {
			selectedGroupFriends = selectedGroupFriends.filter((x) => x !== id);
		} else {
			selectedGroupFriends = [...selectedGroupFriends, id];
		}
	}

	async function createGroup() {
		if (selectedGroupFriends.length < 2 || creatingGroup) return;
		creatingGroup = true;
		try {
			const res = await fetch('/api/chat/channels', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'group', memberIds: selectedGroupFriends })
			});
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || d.error || 'Failed to create group');
				return;
			}
			const d = await res.json();
			showCreateGroup = false;
			selectedGroupFriends = [];
			await fetchChannels();
			const fresh = channels.find((c) => c.id === d.channel.id);
			if (fresh) selectChannel(fresh.id!);
			else selectChannel(d.channel.id);
		} catch {
			toast.error('Network error');
		} finally {
			creatingGroup = false;
		}
	}

	async function kickMember(memberId: number) {
		if (!activeChannelId || removingMemberId !== null) return;
		if (!confirm('Remove this member from the group?')) return;
		removingMemberId = memberId;
		try {
			const res = await fetch(`/api/chat/channels/${activeChannelId}/members/${memberId}`, {
				method: 'DELETE'
			});
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || d.error || 'Failed to remove member');
				return;
			}
			toast.success('Member removed');
			await fetchChannels();
		} catch (e) {
			toast.error('Network error');
		} finally {
			removingMemberId = null;
		}
	}

	async function deleteGroup() {
		if (!activeChannelId || !activeChannel || deletingGroup) return;
		if (!confirm(`Permanently delete "${activeChannel.name}" for everyone? This cannot be undone.`))
			return;
		deletingGroup = true;
		try {
			const res = await fetch(`/api/chat/channels/${activeChannelId}`, { method: 'DELETE' });
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || d.error || 'Failed to delete group');
				return;
			}
			showManageGroup = false;
			toast.success('Group deleted');
			ACTIVE_CHANNEL_ID.set(null);
			activeChannelId = null;
			await fetchChannels();
		} catch (e) {
			toast.error('Network error');
		} finally {
			deletingGroup = false;
		}
	}

	async function leaveGroup() {
		if (!activeChannelId || groupActionPending) return;
		if (!confirm('Leave this group? You can only come back if someone adds you again.')) return;
		groupActionPending = true;
		try {
			const res = await fetch(`/api/chat/channels/${activeChannelId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'leave' })
			});
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || d.error || 'Failed to leave group');
				return;
			}
			showManageGroup = false;
			toast.success('You left the group');
			handleChatChannelRemoved(activeChannelId!);
			await fetchChannels();
		} catch (e) {
			toast.error('Network error');
		} finally {
			groupActionPending = false;
		}
	}

	async function saveGroupSettings() {
		if (!activeChannelId || savingGroupSettings) return;
		const name = groupNameInput.trim();
		if (!name && !groupImageInput) {
			toast.error('Enter a group name or pick a new image.');
			return;
		}
		savingGroupSettings = true;
		try {
			const fd = new FormData();
			if (name) fd.append('name', name);
			if (groupImageInput) fd.append('image', groupImageInput);
			const res = await fetch(`/api/chat/channels/${activeChannelId}`, {
				method: 'POST',
				body: fd
			});
			const d = await res.json();
			if (!res.ok) {
				toast.error(d.message || d.error || 'Failed to update group');
				return;
			}
			toast.success('Group updated');
			groupImageInput = undefined;
			groupImagePreview = null;
			await fetchChannels();
		} catch {
			toast.error('Server error');
		} finally {
			savingGroupSettings = false;
		}
	}

	function onGroupImagePicked(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			toast.error('Pick an image file');
			input.value = '';
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error('Image must be under 5 MB');
			input.value = '';
			return;
		}
		groupImageInput = file;
		groupImagePreview = URL.createObjectURL(file);
	}

	async function transferLeadership(memberId: number) {
		if (!activeChannelId || transferringLeaderId !== null) return;
		if (!confirm('Transfer group leadership to this member? You will no longer be the leader.')) return;
		transferringLeaderId = memberId;
		try {
			const res = await fetch(`/api/chat/channels/${activeChannelId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'transfer', memberId })
			});
			if (!res.ok) {
				const d = await res.json();
				toast.error(d.message || d.error || 'Failed to transfer leadership');
				return;
			}
			toast.success('Leadership transferred');
			await fetchChannels();
		} catch {
			toast.error('Network error');
		} finally {
			transferringLeaderId = null;
		}
	}

	// Refetch channels when another client renames the group / updates its image /
	// transfers leadership, so the sidebar and header always stay in sync.
	$effect(() => {
		void $CHAT_CHANNEL_REFRESH;
		if ($USER_DATA && !loadingChannels) fetchChannels();
	});
</script>

<SEO
	title="Messages - Catplay"
	description="Chat with your friends and fellow traders on Catplay."
/>

<div class="container mx-auto flex h-[calc(100vh-80px)] max-w-6xl flex-col p-3 sm:p-6">
	<div class="mb-3 flex items-center justify-between sm:mb-4">
		<h1 class="text-2xl font-bold sm:text-3xl">Messages</h1>
	</div>

	<div class="flex min-h-0 flex-1 gap-2 sm:gap-4">
		<!-- Sidebar -->
		<Card.Root
			class="flex flex-col overflow-hidden {activeChannelId
				? 'hidden md:flex md:w-[340px]'
				: 'w-full md:w-[340px]'} py-0"
		>
			<div class="border-b p-3">
					<div class="mb-2 flex items-center gap-1 rounded-full bg-muted/60 p-1">
						<button
							class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors {activeTab ===
							'chats'
								? 'bg-primary text-primary-foreground shadow-sm'
								: 'text-muted-foreground hover:bg-muted'}"
							onclick={() => (activeTab = 'chats')}
						>
							<HugeiconsIcon icon={Message01Icon} class="h-3.5 w-3.5" />
							Chats
						</button>
						<button
							class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors {activeTab ===
							'friends'
								? 'bg-primary text-primary-foreground shadow-sm'
								: 'text-muted-foreground hover:bg-muted'}"
							onclick={() => (activeTab = 'friends')}
						>
							<HugeiconsIcon icon={UserGroupIcon} class="h-3.5 w-3.5" />
							Friends ({acceptedFriends.length + incomingRequests.length})
						</button>
					</div>
					{#if activeTab === 'chats'}
						<div class="flex items-center gap-2">
							<div class="relative flex-1">
								<HugeiconsIcon
									icon={Search01Icon}
									class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
								/>
								<Input
									bind:value={searchQuery}
									placeholder="Search chats and friends..."
									class="bg-muted/50 rounded-full pl-9"
								/>
							</div>
							<Button
								size="icon"
								variant="outline"
								class="h-8 w-8 shrink-0 rounded-full"
								title="New group chat"
								aria-label="New group chat"
								onclick={() => (showCreateGroup = true)}
							>
								<HugeiconsIcon icon={PlusSignIcon} class="h-4 w-4" />
							</Button>
						</div>
					{:else}
						<form
							class="flex items-center gap-2"
							onsubmit={(e) => {
								e.preventDefault();
								sendFriendRequest();
							}}
						>
							<div class="relative flex-1">
								<HugeiconsIcon
									icon={UserAdd01Icon}
									class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
								/>
								<Input
									bind:value={addUsername}
									placeholder="Add friend by username..."
									class="bg-muted/50 rounded-full pl-9"
									autocomplete="off"
								/>
							</div>
							<Button
								size="icon"
								variant="outline"
								class="h-8 w-8 shrink-0 rounded-full"
								title="Send friend request"
								aria-label="Send friend request"
								disabled={addingFriend || !addUsername.trim()}
								onclick={sendFriendRequest}
							>
								<HugeiconsIcon icon={UserAdd01Icon} class="h-4 w-4" />
							</Button>
						</form>
					{/if}
				</div>

			<div class="flex-1 overflow-y-auto">
				{#if activeTab === 'chats'}
					{#if loadingChannels}
					<div class="space-y-3 p-4">
						{#each Array(6) as _}
							<div class="flex items-center gap-3">
								<div class="bg-muted h-11 w-11 animate-pulse rounded-full"></div>
								<div class="flex-1 space-y-2">
									<div class="bg-muted h-4 w-2/3 animate-pulse rounded"></div>
									<div class="bg-muted h-3 w-1/3 animate-pulse rounded"></div>
								</div>
							</div>
						{/each}
					</div>
				{:else if !hasResults}
					<div class="text-muted-foreground flex flex-col items-center gap-3 p-8 text-center text-sm">
						<HugeiconsIcon icon={UserGroupIcon} class="h-10 w-10 opacity-30" />
						{isGlobalSearch
							? 'No chats or friends match your search.'
							: 'No conversations yet. Add some friends to start chatting!'}
					</div>
				{:else}
					<div class="flex flex-col gap-1 p-2">
						{#each filteredChannels as channel (channel.id ?? `friend-${channel.partnerId}`)}
							{@const unread = $CHAT_UNREAD[channel.id as number] || 0}
							{@const active = activeChannelId === channel.id}
							<button
								class="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors {active
									? 'bg-primary/10'
									: 'hover:bg-muted'}"
								onclick={() => openChat(channel)}
							>
								<div class="relative shrink-0">
									<Avatar.Root class="h-11 w-11 border">
										{#if channel.image}
											<Avatar.Image src={getPublicUrl(channel.image)} />
										{/if}
										<Avatar.Fallback class="text-sm">{substringFor(channel)}</Avatar.Fallback>
									</Avatar.Root>
									{#if isGlobal(channel)}
										<span class="bg-primary absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background">
											<HugeiconsIcon icon={Message01Icon} class="h-2.5 w-2.5 text-primary-foreground" />
										</span>
									{:else if isGroup(channel)}
										<span class="bg-primary absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background">
											<HugeiconsIcon icon={UserGroupIcon} class="h-2.5 w-2.5 text-primary-foreground" />
										</span>
									{/if}
								</div>
								<div class="min-w-0 flex-1">
									<div class="flex items-center justify-between gap-2">
										<span class="truncate text-sm font-semibold">{channel.name}</span>
										{#if channel.lastMessageAt}
											<span class="text-muted-foreground shrink-0 text-[11px]">
												{relativeTime(channel.lastMessageAt)}
											</span>
										{/if}
									</div>
									<div class="mt-0.5 flex items-center justify-between gap-2">
										<span class="text-muted-foreground truncate text-xs">
											{channel.kind === 'friend' && !channel.lastMessage
												? 'Say hi to start chatting'
												: truncate(channel.lastMessage, 40)}
										</span>
										{#if unread > 0}
											<span class="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold">
												{unread > 99 ? '99+' : unread}
											</span>
										{/if}
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
				{:else}
					{#if loadingFriends}
						<div class="space-y-3 p-4">
							{#each Array(6) as _}
								<div class="flex items-center gap-3">
									<div class="bg-muted h-11 w-11 animate-pulse rounded-full"></div>
									<div class="flex-1 space-y-2">
										<div class="bg-muted h-4 w-2/3 animate-pulse rounded"></div>
										<div class="bg-muted h-3 w-1/3 animate-pulse rounded"></div>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="flex flex-col gap-3 p-3">
							{#if incomingRequests.length > 0}
								<p class="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide uppercase">
									<HugeiconsIcon icon={UserAdd01Icon} class="h-3 w-3" />
									Incoming ({incomingRequests.length})
								</p>
								<div class="flex flex-col gap-1">
									{#each incomingRequests as f}
										{@const other = otherUser(f)}
										<div class="hover:bg-muted flex items-center gap-2.5 rounded-xl p-2">
											<Avatar.Root class="h-9 w-9 shrink-0 border">
												{#if other.image}
													<Avatar.Image src={getPublicUrl(other.image)} />
												{/if}
												<Avatar.Fallback class="text-xs">{other.name?.charAt(0) || '?'}</Avatar.Fallback>
											</Avatar.Root>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium">{other.name}</p>
												<p class="text-muted-foreground truncate text-xs">@{other.username}</p>
											</div>
											<Button
												size="xs"
												class="bg-green-600 shrink-0 hover:bg-green-500"
												onclick={() => respondToFriend(f, 'accept')}
											>
												<HugeiconsIcon icon={UserCheck01Icon} class="mr-1 h-3.5 w-3.5" />Accept
											</Button>
											<Button
												size="icon"
												variant="ghost"
												class="text-red-400 hover:text-red-300"
												title="Decline"
												onclick={() => respondToFriend(f, 'decline')}
											>
												<HugeiconsIcon icon={Cancel01Icon} class="h-3.5 w-3.5" />
											</Button>
										</div>
									{/each}
								</div>
							{/if}

							{#if outgoingRequests.length > 0}
								<p class="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide uppercase">
									<HugeiconsIcon icon={UserAdd01Icon} class="h-3 w-3" />
									Sent ({outgoingRequests.length})
								</p>
								<div class="flex flex-col gap-1">
									{#each outgoingRequests as f}
										{@const other = otherUser(f)}
										<div class="flex items-center gap-2.5 rounded-xl p-2">
											<Avatar.Root class="h-9 w-9 shrink-0 border">
												{#if other.image}
													<Avatar.Image src={getPublicUrl(other.image)} />
												{/if}
												<Avatar.Fallback class="text-xs">{other.name?.charAt(0) || '?'}</Avatar.Fallback>
											</Avatar.Root>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium">{other.name}</p>
												<p class="text-muted-foreground truncate text-xs">@{other.username} · waiting</p>
											</div>
											<Button
												size="xs"
												variant="ghost"
												class="text-red-400 shrink-0 hover:text-red-300"
												onclick={() => respondToFriend(f, 'remove')}
											>
												Cancel
											</Button>
										</div>
									{/each}
								</div>
							{/if}

							{#if acceptedFriends.length > 0}
								<p class="text-muted-foreground flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide uppercase">
									<HugeiconsIcon icon={UserGroupIcon} class="h-3 w-3" />
									Friends ({acceptedFriends.length})
								</p>
								<div class="flex flex-col gap-1">
									{#each acceptedFriends as f}
										{@const other = otherUser(f)}
										<div class="hover:bg-muted flex items-center gap-2.5 rounded-xl p-2">
											<Avatar.Root class="h-9 w-9 shrink-0 border">
												{#if other.image}
													<Avatar.Image src={getPublicUrl(other.image)} />
												{/if}
												<Avatar.Fallback class="text-xs">{other.name?.charAt(0) || '?'}</Avatar.Fallback>
											</Avatar.Root>
											<div class="min-w-0 flex-1">
												<p class="truncate text-sm font-medium">{other.name}</p>
												<p class="text-muted-foreground truncate text-xs">@{other.username}</p>
											</div>
											<Button
												size="icon"
												variant="outline"
												class="h-7 w-7 shrink-0"
												title={`Chat with ${other.name}`}
												onclick={() => openFriendChat(f)}
											>
												<HugeiconsIcon icon={Message01Icon} class="h-3.5 w-3.5" />
											</Button>
											<Button
												size="icon"
												variant="ghost"
												class="text-red-400 h-7 w-7 shrink-0 hover:text-red-300"
												title="Remove friend"
												onclick={() => unfriendFriend(f)}
											>
												<HugeiconsIcon icon={UserRemove01Icon} class="h-3.5 w-3.5" />
											</Button>
										</div>
									{/each}
								</div>
							{/if}

							{#if acceptedFriends.length === 0 && incomingRequests.length === 0 && outgoingRequests.length === 0}
								<div class="text-muted-foreground flex flex-col items-center gap-2 p-6 text-center text-sm">
									<HugeiconsIcon icon={UserAdd01Icon} class="h-10 w-10 opacity-30" />
									No friends yet.
								</div>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</Card.Root>

		<!-- Main Chat Area -->
		<Card.Root
			class="flex flex-1 flex-col overflow-hidden py-0 {activeChannelId ? 'flex' : 'hidden md:flex'}"
		>
			{#if activeChannel}
				<div class="flex shrink-0 items-center gap-2 border-b p-3 sm:gap-3 sm:p-4">
					<button class="hover:bg-muted -ml-1 rounded-full p-1" onclick={goBackToList} aria-label="Back to chats">
						<HugeiconsIcon icon={ArrowLeft01Icon} class="h-5 w-5" />
					</button>
					<Avatar.Root class="h-10 w-10 shrink-0 border">
						{#if activeChannel.image}
							<Avatar.Image src={getPublicUrl(activeChannel.image)} />
						{/if}
						<Avatar.Fallback class="text-sm">{substringFor(activeChannel)}</Avatar.Fallback>
					</Avatar.Root>
					<div class="min-w-0 flex-1">
						<div class="truncate text-base font-semibold">{activeChannel.name}</div>
						<div class="text-muted-foreground text-xs">
							{isGlobal(activeChannel)
								? 'Everyone across Catplay'
								: activeChannel.type === 'DIRECT'
									? 'Direct Message'
									: activeChannel.type === 'GROUP'
										? `${activeChannel.members?.length ?? 0} members`
										: activeChannel.type?.replace('_', ' ')}
						</div>
					</div>
					{#if isGroup(activeChannel) && activeChannel.members?.some((m) => m.id === myUserId)}
						<Button
							size="xs"
							variant="outline"
							class="ml-auto shrink-0 gap-1"
							onclick={() => (showManageGroup = true)}
						>
							<HugeiconsIcon icon={Settings01Icon} class="h-3.5 w-3.5" />
							<span class="hidden sm:inline">Manage</span>
						</Button>
					{/if}
				</div>

				<div class="flex flex-1 flex-col gap-3 overflow-y-auto p-4" bind:this={scrollViewport}>
					{#if messages.length === 0}
						<div class="text-muted-foreground m-auto flex flex-col items-center gap-2 text-sm">
							<HugeiconsIcon icon={Message01Icon} class="h-8 w-8 opacity-30" />
							<p>No messages yet. Say hi!</p>
						</div>
					{:else}
						{#each messages as msg (msg.id)}
							{@const isMe = msg.senderId === Number($USER_DATA?.id)}
							<div class="flex max-w-[80%] gap-2.5 {isMe ? 'flex-row-reverse self-end' : 'self-start'}">
								<Avatar.Root class="mt-1 h-8 w-8 shrink-0">
									{#if msg.senderImage}
										<Avatar.Image src={getPublicUrl(msg.senderImage)} />
									{/if}
									<Avatar.Fallback class="text-xs"
										>{msg.senderUsername?.charAt(0)?.toUpperCase() || '?'}</Avatar.Fallback
									>
								</Avatar.Root>
								<div class="flex min-w-0 flex-col gap-1 {isMe ? 'items-end' : 'items-start'}">
									<div class="text-muted-foreground flex items-center gap-2 px-1 text-[11px]">
										{msg.senderUsername}
										<span>·</span>
										<span>{formatDate(msg.createdAt)}</span>
									</div>
									<div
										class="max-w-full break-words whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm {isMe
											? 'bg-primary text-primary-foreground rounded-tr-sm'
											: 'bg-muted rounded-tl-sm'}"
									>
										{msg.content}
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<div class="shrink-0 border-t p-3">
					<form
						class="flex items-center gap-2"
						onsubmit={(e) => {
							e.preventDefault();
							sendMessage();
						}}
					>
						<Input
							placeholder="Type a message..."
							bind:value={messageInput}
							disabled={sending}
							autocomplete="off"
							class="flex-1 rounded-full"
						/>
						<button
							type="submit"
							aria-label="Send message"
							disabled={!messageInput.trim() || sending}
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
						>
							<HugeiconsIcon icon={SentIcon} class="h-4 w-4" />
						</button>
					</form>
				</div>
			{:else}
				<div class="text-muted-foreground m-auto flex flex-col items-center gap-3">
					<HugeiconsIcon icon={Message01Icon} class="h-12 w-12 opacity-20" />
					<p class="text-sm">Select a conversation to start chatting</p>
					<p class="max-w-xs text-center text-xs opacity-70">
						Your friends automatically show up on the left — just tap one to start messaging.
					</p>
				</div>
			{/if}
		</Card.Root>
	</div>
</div>

<Dialog.Root bind:open={showCreateGroup}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={UserGroupIcon} class="h-5 w-5" />
				New group chat
			</Dialog.Title>
			<Dialog.Description>
				Pick 2–9 friends to start a group chat (max 10 members).
			</Dialog.Description>
		</Dialog.Header>
		<div class="max-h-[45vh] overflow-y-auto px-6">
			{#if groupFriendOptions.length === 0}
				<p class="text-muted-foreground py-6 text-center text-sm">
					You need at least 2 friends to create a group. Add some friends first!
				</p>
			{:else}
				<div class="flex flex-col gap-1">
					{#each groupFriendOptions as friend (friend.id)}
						<button
							class="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors {selectedGroupFriends.includes(
								friend.id
							)
								? 'bg-primary/10'
								: 'hover:bg-muted'}"
							onclick={() => toggleGroupFriend(friend.id)}
						>
							<Avatar.Root class="h-9 w-9 border">
								<Avatar.Fallback class="text-sm">{friend.username?.charAt(0)?.toUpperCase()}</Avatar.Fallback>
							</Avatar.Root>
							<span class="min-w-0 flex-1 truncate text-sm">@{friend.username}</span>
							<span
								class="flex h-5 w-5 items-center justify-center rounded-md border {selectedGroupFriends.includes(
									friend.id
								)
									? 'bg-primary border-primary text-primary-foreground'
									: 'border-input text-primary-foreground'}"
							>
								{#if selectedGroupFriends.includes(friend.id)}
									<svg viewBox="0 0 12 12" class="h-3 w-3" fill="none">
										<path
											d="M2.5 6l2.5 2.5 4.5-5"
											stroke="currentColor"
											stroke-width="1.8"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button
				variant="outline"
				disabled={creatingGroup}
				onclick={() => (showCreateGroup = false)}
			>
				Cancel
			</Button>
<Button
			onclick={createGroup}
			disabled={selectedGroupFriends.length < 2 || selectedGroupFriends.length > 9 || creatingGroup}
			class="gap-1.5"
		>
			<HugeiconsIcon icon={UserGroupIcon} class="h-4 w-4" />
			{creatingGroup ? 'Creating...' : `Create group (${selectedGroupFriends.length})`}
		</Button>
	</Dialog.Footer>
</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={showManageGroup}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={Settings01Icon} class="h-5 w-5" />
				Manage group
			</Dialog.Title>
			{#if activeChannel?.ownerId === myUserId}
				<Dialog.Description>
					You're the leader of this group. You can rename it, change its picture, add a new
					leader, or remove members.
				</Dialog.Description>
			{:else}
				<Dialog.Description>
					Change the group name or picture, or leave the group.
				</Dialog.Description>
			{/if}
		</Dialog.Header>

		<!-- Group name + picture -->
		<div class="space-y-3 px-6 pb-3">
			<div class="flex items-center gap-3">
				<Avatar.Root class="h-12 w-12 shrink-0 border">
					{#if groupImagePreview}
						<Avatar.Image src={groupImagePreview} />
					{:else if activeChannel?.image}
						<Avatar.Image src={getPublicUrl(activeChannel.image)} />
					{/if}
					<Avatar.Fallback class="text-sm">{activeChannel ? substringFor(activeChannel) : '?'}</Avatar.Fallback>
				</Avatar.Root>
				<label class="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed p-2 text-sm text-muted-foreground hover:bg-muted">
					<HugeiconsIcon icon={Upload01Icon} class="h-4 w-4" />
					{groupImageInput ? 'New image picked' : 'Change group picture'}
					<input type="file" accept="image/*" class="hidden" onchange={onGroupImagePicked} />
				</label>
			</div>
			<div class="flex items-center gap-2">
				<Input bind:value={groupNameInput} placeholder="Group name" maxlength={60} class="flex-1" />
				<Button
					onclick={saveGroupSettings}
					disabled={savingGroupSettings || (!groupNameInput.trim() && !groupImageInput)}
					class="gap-1"
				>
					{savingGroupSettings ? 'Saving...' : 'Save'}
				</Button>
			</div>
		</div>

		<div class="flex max-h-[45vh] flex-col gap-1 overflow-y-auto px-6">
			{#each activeChannel?.members ?? [] as member (member.id)}
				<div class="hover:bg-muted flex items-center gap-3 rounded-xl p-2">
					<Avatar.Root class="h-8 w-8 shrink-0 border">
						{#if member.image}
							<Avatar.Image src={getPublicUrl(member.image)} />
						{/if}
						<Avatar.Fallback class="text-xs"
							>{member.username?.charAt(0)?.toUpperCase() || '?'}</Avatar.Fallback
						>
					</Avatar.Root>
					<div class="min-w-0 flex-1 truncate text-sm font-medium">
						@{member.username}
						{#if member.id === myUserId}
							<span class="text-muted-foreground text-xs">(you)</span>
						{:else if member.id === activeChannel?.ownerId}
							<span class="text-muted-foreground text-xs">(leader)</span>
						{/if}
					</div>
					{#if activeChannel?.ownerId === myUserId && member.id !== activeChannel.ownerId}
						<Button
							size="xs"
							variant="ghost"
							class="shrink-0 gap-1 text-yellow-500 hover:text-yellow-400"
							disabled={transferringLeaderId !== null}
							onclick={() => transferLeadership(member.id)}
							title="Make this member the group leader"
						>
							<HugeiconsIcon icon={CircleArrowDataTransferHorizontalIcon} class="h-3.5 w-3.5" />
							{transferringLeaderId === member.id ? 'Transferring...' : 'Make leader'}
						</Button>
						<Button
							size="xs"
							variant="ghost"
							class="text-destructive shrink-0 gap-1"
							disabled={removingMemberId !== null}
							onclick={() => kickMember(member.id)}
						>
							<HugeiconsIcon icon={UserRemove01Icon} class="h-3.5 w-3.5" />
							{removingMemberId === member.id ? 'Removing...' : 'Remove'}
						</Button>
					{/if}
				</div>
			{/each}
		</div>
		<Dialog.Footer class="flex items-center justify-between gap-2">
			{#if activeChannel?.ownerId === myUserId}
				<Button
					variant="destructive"
					class="shrink-0 gap-1.5"
					disabled={deletingGroup || !activeChannel}
					onclick={deleteGroup}
				>
					<HugeiconsIcon icon={Delete01Icon} class="h-4 w-4" />
					{deletingGroup ? 'Deleting...' : 'Delete group'}
				</Button>
			{:else}
				<Button
					variant="destructive"
					class="gap-1.5"
					disabled={groupActionPending}
					onclick={leaveGroup}
				>
					<HugeiconsIcon icon={UserRemove01Icon} class="h-4 w-4" />
					{groupActionPending ? 'Leaving...' : 'Leave group'}
				</Button>
			{/if}
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
