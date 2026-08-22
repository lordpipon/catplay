<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<!-- Profile Header Skeleton -->
<Card.Root class="mb-6 py-0">
	<Card.Content class="p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-start">
			<!-- Avatar Skeleton -->
			<div class="flex-shrink-0">
				<Skeleton class="size-16 rounded-full sm:size-20 md:size-24" />
			</div>

			<!-- Profile Info Skeleton -->
			<div class="min-w-0 flex-1">
				<div class="mb-3">
					<div class="mb-1 flex flex-wrap items-center gap-2">
						<Skeleton class="h-6 w-32 sm:h-8 sm:w-48" />
						<Skeleton class="h-5 w-12 sm:h-6 sm:w-16" />
					</div>
					<Skeleton class="h-5 w-24 sm:h-6 sm:w-32" />
				</div>

				<Skeleton class="mb-3 h-4 w-full max-w-2xl" />
				<Skeleton class="mb-6 h-4 max-w-2xl" />

				<div class="flex items-center gap-2">
					<Skeleton class="h-4 w-4" />
					<Skeleton class="h-4 w-20 sm:w-24" />
				</div>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<!-- Main Portfolio Stats Skeleton -->
<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	{#each Array(4) as _}
		<Card.Root class="py-0">
			<Card.Content class="p-4">
				<div class="flex items-center justify-between">
					<Skeleton class="h-4 w-20 sm:w-24" />
					<Skeleton class="h-4 w-4" />
				</div>
				<Skeleton class="mt-1 h-6 w-24 sm:h-8 sm:w-32" />
				<Skeleton class="mt-1 h-3 w-16 sm:w-20" />
			</Card.Content>
		</Card.Root>
	{/each}
</div>

<!-- Buy & Sell Activity Skeleton -->
<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
	{#each Array(4) as _}
		<Card.Root class="py-0">
			<Card.Content class="p-4">
				<div class="flex items-center justify-between">
					<Skeleton class="h-4 w-20 sm:w-24" />
					<Skeleton class="h-4 w-4" />
				</div>
				<div class="mt-1">
					<Skeleton class="h-6 w-20 sm:h-8 sm:w-28" />
					<Skeleton class="mt-1 h-3 w-20 sm:w-24" />
				</div>
				<div class="border-muted mt-3 border-t pt-3">
					<Skeleton class="h-5 w-16 sm:h-6 sm:w-24" />
					<Skeleton class="mt-1 h-3 w-16 sm:w-20" />
				</div>
			</Card.Content>
		</Card.Root>
	{/each}
</div>

<!-- Created Coins Skeleton -->
<Card.Root class="mb-6">
	<Card.Header class="pb-3">
		<Card.Title class="flex items-center gap-2">
			<Skeleton class="h-5 w-5" />
			<Skeleton class="h-5 w-24 sm:h-6 sm:w-32" />
		</Card.Title>
		<Skeleton class="h-4 w-32 sm:w-48" />
	</Card.Header>
	<Card.Content class="p-0">
		<div class="p-4 sm:p-6">
			{#each Array(3) as _}
				<div class="flex items-center gap-3 border-b py-3 last:border-b-0 sm:gap-4 sm:py-4">
					<Skeleton class="h-6 w-6 rounded-full sm:h-8 sm:w-8" />
					<div class="min-w-0 flex-1">
						<Skeleton class="h-4 w-16 sm:w-24" />
						<Skeleton class="mt-1 h-3 w-12 sm:w-16" />
					</div>
					<div class="hidden sm:block">
						<Skeleton class="h-4 w-16" />
					</div>
					<div class="hidden md:block">
						<Skeleton class="h-4 w-20" />
					</div>
					<Skeleton class="h-4 w-12 sm:w-16" />
				</div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>

<!-- Recent Trading Activity Skeleton -->
<Card.Root>
	<Card.Header class="pb-3">
		<Card.Title class="flex items-center gap-2">
			<Skeleton class="h-5 w-5" />
			<Skeleton class="h-5 w-32 sm:h-6 sm:w-40" />
		</Card.Title>
		<Skeleton class="h-4 w-36 sm:w-52" />
	</Card.Header>
	<Card.Content class="p-0">
		<div class="p-4 sm:p-6">
			{#each Array(5) as _}
				<div class="flex items-center gap-3 border-b py-3 last:border-b-0 sm:gap-4 sm:py-4">
					<Skeleton class="h-5 w-10 sm:h-6 sm:w-12" />
					<Skeleton class="h-6 w-6 rounded-full sm:h-8 sm:w-8" />
					<div class="min-w-0 flex-1">
						<Skeleton class="h-4 w-16 sm:w-20" />
						<Skeleton class="mt-1 h-3 w-12 sm:w-16" />
					</div>
					<div class="hidden sm:block">
						<Skeleton class="h-4 w-16" />
					</div>
					<div class="hidden md:block">
						<Skeleton class="h-4 w-16" />
					</div>
					<Skeleton class="h-4 w-16 sm:w-20" />
				</div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
