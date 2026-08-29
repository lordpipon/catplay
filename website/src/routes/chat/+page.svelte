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
	import { CHAT_MESSAGES, setChatMessages, CHAT_UNREAD, clearChatUnread } from '$lib/stores/chat';
	import { getPublicUrl, formatDate } from '$lib/utils';
	import SEO from '$lib/components/self/SEO.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Message01Icon,
		ArrowLeft01Icon,
		Search01Icon,
		Send01Icon,
		Users01Icon
	} from '@hugeicons/core-free-icons';

	interface ChatChannel {
		id: number | null;
		type: string;
		user1Id: number | null;
		user2Id: number | null;
		createdAt: string;
		name: string;
		image: string | null;
		kind: 'channel' | 'friend';
		partnerId?: number;
		username?: string;
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

	onMount(async () => {
		if (!$USER_DATA) {
			goto('/');
			return;
		}

		await fetchChannels();

		const channelQuery = $page.url.searchParams.get('channel');
		if (channelQuery) {
			const id = parseInt(channelQuery);
			const target = channels.find((c) => c.id === id);
			if (target && target.kind === 'channel') {
				selectChannel(id);
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
	}

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
</script>

<SEO
	title="Messages - Catplay"
	description="Chat with your friends and fellow traders on Catplay."
/>

<div class="container mx-auto flex h-[calc(100vh-80px)] max-w-6xl flex-col p-6">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-3xl font-bold">Messages</h1>
		{#if activeChannel}
			<Button size="xs" variant="ghost" class="gap-1 text-muted-foreground" onclick={goBackToList}>
				<HugeiconsIcon icon={ArrowLeft01Icon} class="h-3.5 w-3.5" />
				Back
			</Button>
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 gap-4">
		<!-- Sidebar -->
		<Card.Root
			class="flex flex-col overflow-hidden {activeChannelId
				? 'hidden md:flex md:w-[340px]'
				: 'w-full md:w-[340px]'} py-0"
		>
			<div class="border-b p-3">
				<div class="relative">
					<Search01Icon
						class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
					/>
					<Input
						bind:value={searchQuery}
						placeholder="Search chats and friends..."
						class="bg-muted/50 rounded-full pl-9"
					/>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto">
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
						<HugeiconsIcon icon={Users01Icon} class="h-10 w-10 opacity-30" />
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
			</div>
		</Card.Root>

		<!-- Main Chat Area -->
		<Card.Root
			class="flex flex-1 flex-col overflow-hidden py-0 {activeChannelId ? 'flex' : 'hidden md:flex'}"
		>
			{#if activeChannel}
				<div class="flex shrink-0 items-center gap-3 border-b p-4">
					<button class="hover:bg-muted -ml-1 rounded-full p-1 md:hidden" onclick={goBackToList}>
						<HugeiconsIcon icon={ArrowLeft01Icon} class="h-5 w-5" />
					</button>
					<Avatar.Root class="h-10 w-10 shrink-0 border">
						{#if activeChannel.image}
							<Avatar.Image src={getPublicUrl(activeChannel.image)} />
						{/if}
						<Avatar.Fallback class="text-sm">{substringFor(activeChannel)}</Avatar.Fallback>
					</Avatar.Root>
					<div class="min-w-0">
						<div class="truncate text-base font-semibold">{activeChannel.name}</div>
						<div class="text-muted-foreground text-xs">
							{isGlobal(activeChannel)
								? 'Everyone across Catplay'
								: activeChannel.type === 'DIRECT'
									? 'Direct Message'
									: activeChannel.type?.replace('_', ' ')}
						</div>
					</div>
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
						class="flex gap-2"
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
						<Button
							type="submit"
							disabled={!messageInput.trim() || sending}
							class="gap-1.5 rounded-full px-6"
						>
							<HugeiconsIcon icon={Send01Icon} class="h-4 w-4" />
							Send
						</Button>
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
