<script lang="ts">
	import { page } from '$app/stores';
	import * as Card from '$lib/components/ui/card';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { Alert02Icon, Mail01Icon } from '@hugeicons/core-free-icons';
	import { CONTACT_EMAIL, DISCORD_INVITE } from '$lib/site';

	let reason = $derived($page.url.searchParams.get('reason') || 'none');
	let expiresAt = $derived($page.url.searchParams.get('until'));
	let expiresLabel = $derived.by(() => {
		if (!expiresAt) return null;
		const date = new Date(expiresAt);
		return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
	});
</script>

<div class="container mx-auto max-w-2xl py-20">
	<Card.Root class="border-primary">
		<Card.Header class="text-center">
			<div
				class="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
			>
				<HugeiconsIcon icon={Alert02Icon} class="text-primary h-8 w-8" />
			</div>
			<Card.Title class="text-primary text-2xl">Account Suspended</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4 text-center">
			<p class="text-muted-foreground">
				REASON PROVIDED BY ADMINS: {reason}
			</p>
			{#if expiresLabel}
				<p class="text-muted-foreground text-sm">
					This suspension is temporary and ends on <strong>{expiresLabel}</strong>. Your account will
					be available again automatically after that time.
				</p>
			{/if}
			<p class="text-muted-foreground text-sm">
				If you believe this is an error, <a
					href={DISCORD_INVITE}
					class="text-primary underline">please contact support</a
				>. You can also email us at
				<a href={`mailto:${CONTACT_EMAIL}`} class="text-primary underline">{CONTACT_EMAIL}</a>
				if you cannot access Discord.
			</p>
			<a
				href={`mailto:${CONTACT_EMAIL}?subject=Account%20suspension%20appeal`}
				class="border-input bg-background hover:bg-accent mx-auto flex w-fit items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
			>
				<HugeiconsIcon icon={Mail01Icon} class="h-4 w-4" />
				Email support
			</a>
		</Card.Content>
	</Card.Root>
</div>
