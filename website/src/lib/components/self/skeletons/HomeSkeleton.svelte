<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<div class="container mx-auto">
	<!-- Top Coins Grid Skeleton -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each Array(6) as _}
			<Card.Root class="h-full">
				<Card.Header>
					<Card.Title class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<Skeleton class="h-6 w-6 rounded-full" />
							<Skeleton class="h-6 max-w-2xl" />
						</div>
						<Skeleton class="h-6 w-16" />
					</Card.Title>
					<Card.Description>
						<Skeleton class="h-4 w-28" />
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="flex items-baseline justify-between">
						<Skeleton class="h-9 w-24" />
						<Skeleton class="h-4 w-20" />
					</div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<!-- Market Overview Skeleton -->
	<div class="mt-12">
		<Skeleton class="mb-4 h-8 w-40" />
		<Card.Root>
			<Card.Content class="p-0">
				<div class="p-6">
					{#each Array(10) as _}
						<div class="flex items-center gap-4 border-b py-4 last:border-b-0">
							<Skeleton class="h-8 w-8 rounded-full" />
							<div class="flex-1">
								<Skeleton class="h-4 w-24" />
								<Skeleton class="mt-1 h-3 w-16" />
							</div>
							<Skeleton class="h-4 w-16" />
							<Skeleton class="h-4 w-16" />
							<Skeleton class="h-4 w-20" />
							<Skeleton class="h-4 w-20" />
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
