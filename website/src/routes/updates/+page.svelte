<script lang="ts">
	import { onMount } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import SEO from '$lib/components/self/SEO.svelte';
	import { formatRelativeTime } from '$lib/utils';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Notification01Icon } from '@hugeicons/core-free-icons';

	interface ChangelogEntry {
		id: number;
		title: string;
		content: string;
		tag: string;
		createdAt: string;
	}

	let entries = $state<ChangelogEntry[]>([]);
	let loading = $state(true);

	const TAG_COLORS: Record<string, string> = {
		update: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		fix: 'bg-green-500/20 text-green-400 border-green-500/30',
		feature: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
		event: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
		hotfix: 'bg-red-500/20 text-red-400 border-red-500/30',
		maintenance: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
	};

	onMount(async () => {
		try {
			const res = await fetch('/api/changelog');
			if (res.ok) entries = await res.json();
		} catch (e) {
			console.error(e);
		} finally {
			loading = false;
		}
	});
</script>

<SEO title="Updates" description="Latest updates, fixes and events on Catplay." />

<div class="mx-auto max-w-2xl space-y-6 p-4">
	<div class="flex items-center gap-3">
		<HugeiconsIcon icon={Notification01Icon} class="h-6 w-6" />
		<div>
			<h1 class="text-2xl font-bold">Updates</h1>
			<p class="text-muted-foreground text-sm">Latest news, fixes and events</p>
		</div>
	</div>

	{#if loading}
		{#each Array(4) as _}
			<Card.Root>
				<Card.Content class="p-5">
					<div class="mb-2 h-5 w-1/3 animate-pulse rounded bg-muted"></div>
					<div class="h-4 w-full animate-pulse rounded bg-muted"></div>
				</Card.Content>
			</Card.Root>
		{/each}
	{:else if entries.length === 0}
		<Card.Root>
			<Card.Content class="p-8 text-center">
				<p class="text-muted-foreground">No updates yet. Check back soon!</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="relative">
			<!-- Timeline line -->
			<div class="absolute left-4 top-0 h-full w-0.5 bg-border"></div>
			<div class="space-y-6 pl-12">
				{#each entries as entry}
					<div class="relative">
						<!-- Dot -->
						<div class="absolute -left-[2.05rem] top-5 h-3 w-3 rounded-full border-2 border-background bg-primary"></div>
						<Card.Root>
							<Card.Header class="pb-2">
								<div class="flex items-start justify-between gap-2">
									<Card.Title class="text-base">{entry.title}</Card.Title>
									<div class="flex shrink-0 items-center gap-2">
										<span class="border rounded px-2 py-0.5 text-xs font-medium {TAG_COLORS[entry.tag] ?? TAG_COLORS['update']}">
											{entry.tag}
										</span>
										<span class="text-muted-foreground text-xs">{formatRelativeTime(entry.createdAt)}</span>
									</div>
								</div>
							</Card.Header>
							<Card.Content class="pb-4">
								<p class="text-muted-foreground whitespace-pre-wrap text-sm">{entry.content}</p>
							</Card.Content>
						</Card.Root>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
