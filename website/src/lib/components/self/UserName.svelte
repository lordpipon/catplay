<script lang="ts">
	import { getColorByKey } from '$lib/data/shop-catalog';
	import { VIP_USERS } from '$lib/stores/vip-users';
	import { CrownIcon } from '@hugeicons/core-free-icons';
	import SilentBadge from './SilentBadge.svelte';

	interface Props {
		name: string;
		nameColor?: string | null;
		username?: string | null;
		founderBadge?: boolean;
		class?: string;
	}

	let { name, nameColor = null, username = null, founderBadge = false, class: className = '' }: Props = $props();

	let colorItem = $derived(nameColor ? getColorByKey(nameColor) : null);
	let isVip = $derived(username ? $VIP_USERS.has(username.toLowerCase()) : false);
</script>

<span class="inline-flex items-center gap-1">
	{#if colorItem}
		<span class="{colorItem.classes} {className}" style={colorItem.style ?? ''}>
			{name}
		</span>
	{:else}
		<span class={className}>{name}</span>
	{/if}
	{#if isVip}
		<SilentBadge icon={CrownIcon} text="VIP" class="-m-0.5 text-yellow-400 [&_svg]:h-3.5 [&_svg]:w-3.5" />
	{/if}
	{#if founderBadge}
		<span title="Founder" class="text-xs font-bold text-cyan-400">◆</span>
	{/if}
</span>
