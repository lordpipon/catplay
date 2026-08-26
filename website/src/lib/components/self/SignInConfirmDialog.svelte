<script lang="ts">
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { signIn, signUp } from '$lib/auth-client';
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';
	import { toast } from 'svelte-sonner';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';

	let { open = $bindable(false) } = $props<{
		open?: boolean;
	}>();

	let mode = $state<'signin' | 'signup'>('signin');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let loading = $state(false);

	const callbackURL = `${page.url.pathname}?signIn=1`;

	async function onGoogle() {
		await signIn.social({
			provider: 'google',
			callbackURL
		});
	}

	async function onEmailSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!email.trim() || !password || loading) return;

		if (mode === 'signup' && password !== confirmPassword) {
			toast.error('Passwords do not match');
			return;
		}

		loading = true;
		try {
			if (mode === 'signup') {
				const res = await signUp.email({
					email: email.trim(),
					password,
					name: email.trim().split('@')[0],
					callbackURL
				});
				if (res.error) throw new Error(res.error.message || 'Failed to create account');
			} else {
				const res = await signIn.email({
					email: email.trim(),
					password,
					callbackURL
				});
				if (res.error) throw new Error(res.error.message || 'Invalid email or password');
			}
			open = false;
			location.reload();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			loading = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{$_('sign_in.form.title')}</DialogTitle>
			<DialogDescription>
				{$_('sign_in.form.description')}
			</DialogDescription>
		</DialogHeader>
		<div class="flex flex-col gap-4 py-2">
			<form class="flex flex-col gap-3" onsubmit={onEmailSubmit}>
				<div class="grid grid-cols-2 gap-2">
					<Button
						type="button"
						variant={mode === 'signin' ? 'default' : 'outline'}
						onclick={() => { mode = 'signin'; confirmPassword = ''; }}
					>
						Sign In
					</Button>
					<Button
						type="button"
						variant={mode === 'signup' ? 'default' : 'outline'}
						onclick={() => { mode = 'signup'; confirmPassword = ''; }}
					>
						Create Account
					</Button>
				</div>
				<Input
					type="email"
					required
					placeholder="you@example.com"
					bind:value={email}
					autocomplete="email"
				/>
				<div class="relative">
					<Input
						type={showPassword ? 'text' : 'password'}
						required
						minlength={8}
						placeholder="Password{mode === 'signup' ? ' (min. 8 characters)' : ''}"
						bind:value={password}
						autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
						class="pr-10"
					/>
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
						onclick={() => (showPassword = !showPassword)}
						tabindex={-1}
					>
						<HugeiconsIcon icon={showPassword ? ViewOffIcon : ViewIcon} class="h-4 w-4" />
					</button>
				</div>
				{#if mode === 'signup'}
					<div class="relative">
						<Input
							type={showPassword ? 'text' : 'password'}
							required
							minlength={8}
							placeholder="Confirm password"
							bind:value={confirmPassword}
							autocomplete="new-password"
							class="pr-10"
						/>
						<button
							type="button"
							class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
							onclick={() => (showPassword = !showPassword)}
							tabindex={-1}
						>
							<HugeiconsIcon icon={showPassword ? ViewOffIcon : ViewIcon} class="h-4 w-4" />
						</button>
					</div>
					{#if confirmPassword && password !== confirmPassword}
						<p class="text-destructive text-xs">Passwords do not match</p>
					{/if}
				{/if}
				<Button type="submit" disabled={loading || (mode === 'signup' && password !== confirmPassword)}>
					{loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
				</Button>
			</form>

			<div class="flex items-center gap-3">
				<div class="bg-border h-px flex-1"></div>
				<span class="text-muted-foreground text-xs">or</span>
				<div class="bg-border h-px flex-1"></div>
			</div>

			<Button
				class="flex w-full items-center justify-center gap-2"
				variant="outline"
				onclick={() => onGoogle()}
			>
				<img
					class="h-5 w-5"
					src="https://lh3.googleusercontent.com/COxitqgJr1sJnIDe8-jiKhxDx1FrYbtRHKJ9z_hELisAlapwE9LUPh6fcXIfb5vwpbMl4xl9H9TRFPc5NOO8Sb3VSgIBrfRYvW6cUA"
					alt="Google"
				/>
				<span>{$_('sign_in.form.services.google')}</span>
			</Button>

			<p class="text-muted-foreground text-center text-xs">
				{$_('sign_in.form.terms.0')}
				<a href="/legal/terms" class="text-primary hover:underline">{$_('sign_in.form.terms.1')}</a>
				{$_('sign_in.form.terms.2')}
				<a href="/legal/privacy" class="text-primary hover:underline"
					>{$_('sign_in.form.terms.3')}</a
				>
			</p>
		</div>
	</DialogContent>
</Dialog>
