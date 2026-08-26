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

	const DISPOSABLE_DOMAINS = new Set([
		'guerrillamail.com','tempmail.com','temp-mail.org','mailinator.com',
		'maildrop.cc','yopmail.com','trashmail.com','trashmail.net',
		'discard.email','sharklasers.com','guerrillamail.de',
		'guerrillamail.net','guerrillamail.org','tempail.com',
		'tempmailer.com','tempmailer.de','tempinbox.com',
		'getnada.com','fakeinbox.com','dispostable.com',
		'10minutemail.com','tempmailo.com','mailnesia.com',
		'mohmal.com','trashmail.me','temp-mail.io',
		'emailondeck.com','33mail.com','guerrillamailblock.com',
		'dropmail.me','discardmail.com','tempmail.net',
		'mailsac.com','mailsac.me','mailnull.com',
		'jetable.com','jetable.fr.nf','jetable.net',
		'spam4.me','spamgourmet.com','spamgourmet.net',
		'mailcatch.com','trashemail.de','wegwerfmail.de',
		'wegwerfmail.net','wegwerfmail.org','wegwerfemail.de',
		'zerobounce.net','kickmail.com','meltmail.com',
		'nospamthanks.info','mytempemail.com','mytempmail.com',
		'spoofmail.de','safetymail.info','filzmail.com',
		'rejectmail.com','spambox.us','spambox.info',
		'spamhole.com','spamcero.com','spamex.com',
		'freemails.cf','freemails.ga','freemails.ml',
		'emailspam.cf','emailspam.ga','emailspam.ml',
		'emailtemporanea.com','emailtemporario.com.br',
		'coldemail.info','mailsiphon.com','mailshell.com',
		'mailslite.com','notsharingmy.info','chacuo.net',
		'redpe.spacetechnology.co','tradermail.info'
	]);

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

		const domain = email.trim().split('@')[1]?.toLowerCase();
		if (mode === 'signup' && domain && DISPOSABLE_DOMAINS.has(domain)) {
			toast.error('Please use a real email address');
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
