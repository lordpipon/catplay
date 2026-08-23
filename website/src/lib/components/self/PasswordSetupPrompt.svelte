<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { USER_DATA } from '$lib/stores/user-data';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { LockIcon, Tick01Icon } from '@hugeicons/core-free-icons';

	const DISMISS_KEY = 'password-setup-dismissed-at';

	let open = $state(false);
	let password = $state('');
	let confirmPassword = $state('');
	let saving = $state(false);
	let checked = $state(false);
	let attempted = $state(false);

	$effect(() => {
		if ($USER_DATA && !checked) {
			checked = true;
			checkSecurity();
		}
	});

	$effect(() => {
		if (!attempted) {
			attempted = true;
			checkSecurity();
		}
	});

	async function checkSecurity() {
		try {
			const res = await fetch('/api/user/security');
			if (!res.ok) return;
			const sec = await res.json();
			if (sec.googleLinked && !sec.hasPassword) {
				const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
				if (Date.now() - dismissedAt > 14 * 24 * 60 * 60 * 1000) {
					open = true;
				}
			}
		} catch {
			// ignore
		}
	}

	async function setPassword() {
		if (saving) return;
		if (password.length < 8) {
			toast.error('Password must be at least 8 characters');
			return;
		}
		if (password !== confirmPassword) {
			toast.error("Passwords don't match");
			return;
		}
		saving = true;
		try {
			const res = await fetch('/api/user/set-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ newPassword: password })
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok) {
				toast.error(d.message || d.error || 'Failed to set password');
				return;
			}
			localStorage.removeItem(DISMISS_KEY);
			open = false;
			password = '';
			confirmPassword = '';
			toast.success('Password set! You can now sign in with email too.');
		} catch {
			toast.error('Failed to set password');
		} finally {
			saving = false;
		}
	}

	function dismiss() {
		localStorage.setItem(DISMISS_KEY, String(Date.now()));
		open = false;
	}
</script>

<Dialog.Root {open} onOpenChange={(v) => open = v}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<HugeiconsIcon icon={LockIcon} class="h-5 w-5 text-primary" />
				Add a Password
			</Dialog.Title>
			<Dialog.Description>
				You signed up with Google. Set a password to also sign in with your email.
			</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-3">
			<div class="space-y-1.5">
				<Label for="psp-pass">New Password</Label>
				<Input id="psp-pass" type="password" bind:value={password} placeholder="At least 8 characters" />
			</div>
			<div class="space-y-1.5">
				<Label for="psp-confirm">Confirm Password</Label>
				<Input
					id="psp-confirm"
					type="password"
					bind:value={confirmPassword}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && setPassword()}
					placeholder="Repeat your password"
				/>
			</div>
			<div class="flex gap-2 pt-1">
				<Button class="flex-1" onclick={setPassword} disabled={saving}>
					<HugeiconsIcon icon={Tick01Icon} class="h-4 w-4" />
					{saving ? 'Saving...' : 'Set Password'}
				</Button>
				<Button variant="ghost" onclick={dismiss}>Not now</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
