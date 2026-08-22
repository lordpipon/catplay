<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { MediaQuery } from 'svelte/reactivity';

	const isDesktop = new MediaQuery('(min-width: 768px)');
	let perPage = $derived(isDesktop.current ? 12 : 9);
</script>

<!-- Pagination Info Skeleton -->
<div class="mb-4 flex items-center justify-between">
	<Skeleton class="h-5 w-48" />
	<Skeleton class="h-5 w-24" />
</div>

<!-- Market Grid Skeleton -->
<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
	{#each Array(perPage) as _}
		<Card.Root class="gap-1">
			<Card.Header>
				<div class="flex items-start justify-between">
					<div class="flex items-center gap-3">
						<Skeleton class="h-8 w-8 rounded-full" />
						<div>
							<Skeleton class="mb-1 h-5 w-24" />
							<Skeleton class="h-4 w-16" />
						</div>
					</div>
					<div class="text-right">
						<Skeleton class="h-3 w-8" />
					</div>
				</div>
			</Card.Header>

			<Card.Content>
				<div class="space-y-3">
					<!-- Price -->
					<div>
						<Skeleton class="mb-2 h-8 w-24" />
						<div class="mt-1 flex items-center gap-2">
							<Skeleton class="h-5 w-12" />
							<Skeleton class="h-5 w-16" />
						</div>
					</div>

					<!-- Stats -->
					<div class="space-y-4 text-sm">
						<div class="flex justify-between">
							<Skeleton class="h-4 w-16" />
							<Skeleton class="h-4 w-12" />
						</div>
						<div class="flex justify-between">
							<Skeleton class="h-4 w-20" />
							<Skeleton class="h-4 w-12" />
						</div>
						<div class="flex justify-between">
							<Skeleton class="h-4 w-12" />
							<Skeleton class="h-4 w-16" />
						</div>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	{/each}
</div>
