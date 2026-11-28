<script lang="ts">
	import { getColorByKey } from '$lib/data/shop-catalog';
	import { VIP_USERS } from '$lib/stores/vip-users';
	import { CrownIcon } from '@hugeicons/core-free-icons';
	import SilentBadge from './SilentBadge.svelte';

	interface Props {
		name: string;
		nameColor?: string | null;
		username?: string | null;
		class?: string;
		truncate?: boolean;
	}

	let {
		name,
		nameColor = null,
		username = null,
		founderBadge = false,
		class: className = '',
		truncate = true
	}: Props = $props();

	let clipClass = $derived(truncate ? 'min-w-0 truncate' : 'min-w-0 break-words');

	let colorItem = $derived(nameColor ? getColorByKey(nameColor) : null);
	let isVip = $derived(username ? $VIP_USERS.has(username.toLowerCase()) : false);
</script>

<span class="inline-flex max-w-full items-center gap-1">
	{#if colorItem}
		<span
			class="{clipClass} {colorItem.classes} {className}"
			style={colorItem.style ?? ''}
		>
			{name}
		</span>
	{:else}
		<span class="{clipClass} {className}">{name}</span>
	{/if}
	{#if isVip}
		<SilentBadge icon={CrownIcon} text="VIP" class="-m-0.5 text-yellow-400 [&_svg]:h-3.5 [&_svg]:w-3.5" />
	{:else if founderBadge}
		<span title="Founder" class="shrink-0 text-xs text-cyan-400">💎</span>
	{/if}
</span>
