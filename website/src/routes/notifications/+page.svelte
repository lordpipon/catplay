<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import SEO from '$lib/components/self/SEO.svelte';
	import NotificationsSkeleton from '$lib/components/self/skeletons/NotificationsSkeleton.svelte';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		Notification01Icon,
		Settings01Icon,
		TradeUpIcon,
		Alert02Icon,
		Target03Icon,
		Award01Icon,
		UserGroupIcon,
		CheckmarkCircle01Icon,
		Cancel01Icon
	} from '@hugeicons/core-free-icons';
	import { onMount } from 'svelte';
	import {
		NOTIFICATIONS,
		fetchNotifications,
		markNotificationsAsRead
	} from '$lib/stores/notifications';
	import { USER_DATA } from '$lib/stores/user-data';
	import { formatTimeAgo, formatValue, getPublicUrl } from '$lib/utils';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import NotificationItem from './NotificationItem.svelte';
	import * as Avatar from '$lib/components/ui/avatar';

	let loading = $state(true);
	let newNotificationIds = $state<number[]>([]);
	let friendRequests = $state<any[]>([]);
	let requestLoading = $state(false);

	onMount(async () => {
		if (!$USER_DATA) {
			goto('/');
			return;
		}

		try {
			await Promise.all([fetchNotifications(), fetchFriendRequests()]);

			const unreadIds = ($NOTIFICATIONS || []).filter((n) => !n.isRead).map((n) => n.id);
			newNotificationIds = unreadIds;

			await markNotificationsAsRead();
		} catch (error) {
			toast.error('Failed to load notifications');
		} finally {
			loading = false;
		}
	});

	async function fetchFriendRequests() {
		try {
			const res = await fetch('/api/friends/requests');
			if (res.ok) {
				const d = await res.json();
				friendRequests = d.requests || [];
			}
		} catch {}
	}

	async function respondToRequest(friendshipId: number, targetUserId: number, action: 'accept' | 'decline') {
		requestLoading = true;
		try {
			const res = await fetch('/api/friends', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetUserId,
					action
				})
			});

			if (!res.ok) {
				const d = await res.json();
				toast.error(d.error || `Failed to ${action} request`);
				return;
			}
			friendRequests = friendRequests.filter((r) => r.id !== friendshipId);
			toast.success(action === 'accept' ? 'Friend request accepted' : 'Request declined');
		} catch {
			toast.error('Network error');
		} finally {
			requestLoading = false;
		}
	}

	function getNotificationIcon(type: string) {
		switch (type) {
			case 'HOPIUM':
				return Target03Icon;
			case 'TRANSFER':
				return TradeUpIcon;
			case 'RUG_PULL':
				return Alert02Icon;
			case 'BATTLEPASS':
				return Award01Icon;
			case 'FRIEND':
				return UserGroupIcon;
			case 'SYSTEM':
				return Settings01Icon;
			default:
				return Notification01Icon;
		}
	}

	function getNotificationColorClasses(type: string, isNew: boolean, isRead: boolean) {
		const base =
			'hover:bg-muted/50 flex w-full items-start gap-4 rounded-md p-3 text-left transition-all duration-200';

		if (isNew) {
			return `${base} bg-primary/10`;
		}

		if (!isRead) {
			const colors = {
				HOPIUM: 'bg-blue-50/50 dark:bg-blue-950/10',
				TRANSFER: 'bg-green-50/50 dark:bg-green-950/10',
				RUG_PULL: 'bg-red-50/50 dark:bg-red-950/10',
				SYSTEM: 'bg-purple-50/50 dark:bg-purple-950/10',
				BATTLEPASS: 'bg-yellow-50/50 dark:bg-yellow-950/10',
				FRIEND: 'bg-sky-50/50 dark:bg-sky-950/10'
			};
			return `${base} ${colors[type as keyof typeof colors] || 'bg-muted/20'}`;
		}

		return base;
	}

	function getNotificationIconColorClasses(type: string) {
		const colors = {
			HOPIUM: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
			TRANSFER: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
			RUG_PULL: 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
			SYSTEM: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
			BATTLEPASS: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
			FRIEND: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400'
		};
		return colors[type as keyof typeof colors] || 'bg-muted text-muted-foreground';
	}
</script>

<SEO
	title="Notifications"
	description="View your notifications and updates from Catplay."
/>

<div class="container mx-auto max-w-4xl p-6">
	<header class="mb-8">
		<div class="text-center">
			<h1 class="mb-2 text-3xl font-bold">Notifications</h1>
			<p class="text-muted-foreground mb-6">Stay updated with your activities</p>
		</div>
	</header>

	<div class="{friendRequests.length > 0 ? 'grid gap-6 lg:grid-cols-[320px_1fr]' : ''}">
		{#if $USER_DATA && friendRequests.length > 0}
			<div class="self-start">
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2">
							<HugeiconsIcon icon={UserGroupIcon} class="h-5 w-5 text-sky-500" />
							Friend Requests ({friendRequests.length})
						</Card.Title>
						<Card.Description>Accept or decline pending friend requests</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-3">
							{#each friendRequests as request}
								<div class="rounded-lg border p-3">
									<div class="flex items-center gap-3">
										<Avatar.Root class="h-10 w-10 shrink-0 border">
											{#if request.requesterImage}
												<Avatar.Image src={getPublicUrl(request.requesterImage)} />
											{/if}
											<Avatar.Fallback class="text-sm"
												>{request.requesterName?.charAt(0)?.toUpperCase() || '?'}</Avatar.Fallback
											>
										</Avatar.Root>
										<div class="min-w-0 flex-1">
											<button
												class="hover:underline block truncate text-sm font-medium"
												onclick={() => goto(`/user/${request.requesterUsername}`)}
											>
												@{request.requesterUsername}
											</button>
											<div class="text-muted-foreground truncate text-xs">
												{request.requesterName}
											</div>
										</div>
									</div>
									<div class="mt-3 flex gap-2">
										<Button
											size="sm"
											class="flex-1"
											onclick={() => respondToRequest(request.id, request.requesterId, 'accept')}
											disabled={requestLoading}
										>
											<HugeiconsIcon icon={CheckmarkCircle01Icon} class="mr-1 h-4 w-4" />
											Accept
										</Button>
										<Button
											size="sm"
											variant="outline"
											class="flex-1 text-muted-foreground"
											onclick={() => respondToRequest(request.id, request.requesterId, 'decline')}
											disabled={requestLoading}
										>
											<HugeiconsIcon icon={Cancel01Icon} class="mr-1 h-4 w-4" />
											Decline
										</Button>
									</div>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{/if}

		<Card.Root class="gap-1">
		<Card.Content>
			{#if !$USER_DATA}
				<div class="py-12 text-center">
					<div
						class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
					>
						<HugeiconsIcon icon={Notification01Icon} class="text-muted-foreground h-8 w-8" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">Please sign in</h3>
					<p class="text-muted-foreground">You need to be signed in to view notifications</p>
				</div>
			{:else if loading}
				<NotificationsSkeleton />
			{:else if !$NOTIFICATIONS || $NOTIFICATIONS.length === 0}
				<div class="py-12 text-center">
					<div
						class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
					>
						<HugeiconsIcon icon={Notification01Icon} class="text-muted-foreground h-8 w-8" />
					</div>
					<h3 class="mb-2 text-lg font-semibold">No notifications yet</h3>
					<p class="text-muted-foreground">You'll see updates about your activities here</p>
				</div>
			{:else}
				<ScrollArea class="h-[600px]">
					<div class="space-y-1">
						{#each $NOTIFICATIONS as notification, index (notification.id)}
							{@const IconComponent = getNotificationIcon(notification.type)}
							{@const isNewNotification = newNotificationIds.includes(notification.id)}
							<NotificationItem {notification} isNew={isNewNotification}>
								<div
									class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full {getNotificationIconColorClasses(
										notification.type
									)}"
								>
									<HugeiconsIcon icon={IconComponent} class="h-4 w-4" />
								</div>
								<div class="min-w-0 flex-1">
									<div class="mb-1 flex items-center gap-2">
										<h3 class="truncate text-sm font-medium">{notification.title}</h3>
										{#if !notification.isRead && !isNewNotification}
											<div class="bg-primary h-2 w-2 flex-shrink-0 rounded-full"></div>
										{/if}
										{#if isNewNotification}
											<Badge variant="default" class="px-1.5 py-0.5 text-xs">New</Badge>
										{/if}
									</div>

									<p class="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
										{notification.message}
									</p>

									{#if notification.data}
										<div class="mt-1 flex flex-wrap gap-1">
											{#if notification.data.profit !== undefined}
												<Badge
													variant={notification.data.profit > 0 ? 'success' : 'destructive'}
													class="px-1.5 py-0.5 text-xs"
												>
													{notification.data.profit > 0 ? '+' : ''}{formatValue(
														notification.data.profit
													)}
												</Badge>
											{/if}
											{#if notification.data.resolution}
												<Badge variant="outline" class="px-1.5 py-0.5 text-xs">
													Resolved: {notification.data.resolution}
												</Badge>
											{/if}
										</div>
									{/if}
								</div>

								<div class="flex flex-shrink-0 flex-col items-end justify-center gap-1">
									<p class="text-muted-foreground text-right text-xs">
										{formatTimeAgo(notification.createdAt)}
									</p>
								</div>
							</NotificationItem>

							{#if index < $NOTIFICATIONS.length - 1}
								<Separator />
							{/if}
						{/each}
					</div>
				</ScrollArea>
			{/if}
		</Card.Content>
	</Card.Root>
	</div>
</div>
