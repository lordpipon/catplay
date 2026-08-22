<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
</script>

<Skeleton class="h-6 w-20 rounded-full sm:ml-auto" />

<!-- Trade items skeleton -->
{#each Array(8) as _}
	<div
		class="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
	>
		<div class="flex items-center gap-3 sm:gap-4">
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-1 sm:gap-2">
					<!-- Coin icon and symbol -->
					<div class="flex items-center gap-1.5">
						<Skeleton class="h-5 w-5 rounded-full sm:h-6 sm:w-6" />
						<Skeleton class="h-4 w-20 sm:h-5 sm:w-24" />
					</div>
					<!-- "bought by" / "sold by" text -->
					<Skeleton class="h-3 w-12 sm:h-4 sm:w-16" />
					<!-- User avatar and username -->
					<div class="flex items-center gap-1">
						<Skeleton class="h-4 w-4 rounded-full sm:h-5 sm:w-5" />
						<Skeleton class="h-3 w-16 sm:h-4 sm:w-20" />
					</div>
				</div>
			</div>
		</div>

		<div class="flex items-center justify-between gap-2">
			<!-- Trade type and value -->
			<div class="flex items-center gap-2">
				<Skeleton class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
				<Skeleton class="h-4 w-8 sm:h-4 sm:w-10" />
				<Skeleton class="h-4 w-1" />
				<Skeleton class="h-4 w-12 sm:h-4 sm:w-16" />
			</div>

			<!-- Timestamp -->
			<div class="flex items-center gap-1">
				<Skeleton class="h-3 w-3 sm:h-4 sm:w-4" />
				<Skeleton class="h-3 w-12 sm:h-4 sm:w-16" />
			</div>
		</div>
	</div>
{/each}
