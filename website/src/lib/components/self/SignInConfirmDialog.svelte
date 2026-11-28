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
	import { client, signIn, signUp } from '$lib/auth-client';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
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

	type Stage = 'credentials' | 'verify' | 'reset' | 'twoFactor' | 'magicLink';
	type VerifyPurpose = 'email-verification' | 'sign-in';

	let mode = $state<'signin' | 'signup'>('signin');
	let stage = $state<Stage>('credentials');
	let verifyPurpose = $state<VerifyPurpose>('email-verification');
	let email = $state('');
	let magicLinkEmail = $state('');
	let username = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let otp = $state('');
	let twoFactorCode = $state('');
	let showPassword = $state(false);
	let loading = $state(false);

	const callbackURL = `${page.url.pathname}?signIn=1`;

	onMount(() => {
		const handler = () => {
			open = true;
			stage = 'twoFactor';
			toast.info('Enter your two-factor code to finish signing in.');
		};
		window.addEventListener('catplay:two-factor-required', handler);
		return () => window.removeEventListener('catplay:two-factor-required', handler);
	});

	function resetToCredentials() {
		stage = 'credentials';
		otp = '';
		twoFactorCode = '';
		loading = false;
	}

	function finish() {
		open = false;
		location.reload();
	}

	async function onGoogle() {
		await signIn.social({
			provider: 'google',
			callbackURL
		});
	}

	async function askForCode(purpose: VerifyPurpose) {
		const target = email.trim();
		if (!target) {
			toast.error('Enter your email first');
			return;
		}
		verifyPurpose = purpose;
		stage = 'verify';
		otp = '';
		loading = true;
		try {
			const res = await client.emailOtp.sendVerificationOtp({ email: target, type: purpose });
			if (res.error) throw new Error(res.error.message || 'Could not send code');
			toast.success(`Code sent to ${target}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not send code');
		} finally {
			loading = false;
		}
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
				const res = await (signUp.email as any)({
					email: email.trim(),
					password,
					name: email.trim().split('@')[0],
					username: username.trim() || undefined,
					callbackURL
				});
				if (res.error) throw new Error(res.error.message || 'Failed to create account');
				verifyPurpose = 'email-verification';
				stage = 'verify';
				otp = '';
				toast.success(`Check ${email.trim()} for your verification code.`);
				return;
			}

			const identifier = email.trim();
			let signedIn: any;
			if (identifier.includes('@')) {
				signedIn = await signIn.email({
					email: identifier,
					password,
					callbackURL
				});
				if (signedIn.error) {
					const code = (signedIn.error as any)?.code;
					if (code === 'EMAIL_NOT_VERIFIED' || String(signedIn.error.message ?? '').toLowerCase().includes('verify')) {
						await askForCode('email-verification');
						return;
					}
					throw new Error(signedIn.error.message || 'Invalid email or password');
				}
			} else {
				const response = await fetch('/api/auth/sign-in-identifier', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ identifier, password, callbackURL })
				});
				const data = await response.json().catch(() => ({}));
				const authError = data?.error ?? data;
				if (!response.ok) {
					const code = authError?.code;
					if (code === 'EMAIL_NOT_VERIFIED' || String(authError?.message ?? '').toLowerCase().includes('verify')) {
						await askForCode('email-verification');
						return;
					}
					throw new Error(authError?.message || 'Invalid username or password');
				}
				signedIn = { data };
			}
			if (signedIn?.data?.twoFactorRedirect) {
				stage = 'twoFactor';
				toast.info('Enter your two-factor code to finish signing in.');
				return;
			}
			finish();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Something went wrong');
		} finally {
			loading = false;
		}
	}

	async function verifyCode() {
		if (!otp.trim() || loading) return;
		loading = true;
		try {
			if (verifyPurpose === 'sign-in') {
				const res = await client.signIn.emailOtp({ email: email.trim(), otp: otp.trim() });
				if (res.error) throw new Error(res.error.message || 'Invalid code');
			} else {
				const res = await client.emailOtp.verifyEmail({ email: email.trim(), otp: otp.trim() });
				if (res.error) throw new Error(res.error.message || 'Invalid code');
			}
			finish();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Invalid code');
		} finally {
			loading = false;
		}
	}

	async function requestPasswordReset() {
		if (!email.trim()) {
			toast.error('Enter your email first');
			return;
		}
		loading = true;
		try {
			const res = await client.emailOtp.requestPasswordReset({ email: email.trim() });
			if (res.error) throw new Error(res.error.message || 'Could not send reset code');
			stage = 'reset';
			otp = '';
			toast.success(`Reset code sent to ${email.trim()}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not send reset code');
		} finally {
			loading = false;
		}
	}

	async function resetPassword() {
		if (!otp.trim() || password.length < 8 || loading) return;
		if (password !== confirmPassword) {
			toast.error("Passwords don't match");
			return;
		}
		loading = true;
		try {
			const res = await client.emailOtp.resetPassword({
				email: email.trim(),
				otp: otp.trim(),
				password
			});
			if (res.error) throw new Error(res.error.message || 'Could not reset password');
			toast.success('Password reset. Signing you in...');
			const signInRes = await signIn.email({ email: email.trim(), password, callbackURL });
			if (signInRes.error) {
				resetToCredentials();
				toast.success('Password reset. You can sign in now.');
				return;
			}
			finish();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not reset password');
		} finally {
			loading = false;
		}
	}

	async function verifyTwoFactor() {
		if (twoFactorCode.trim().length < 6 || loading) return;
		loading = true;
		try {
			const res = await client.twoFactor.verifyTotp({ code: twoFactorCode.trim() });
			if (res.error) throw new Error(res.error.message || 'Invalid code');
			finish();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Invalid code');
		} finally {
			loading = false;
		}
	}

	async function emailTwoFactorCode() {
		loading = true;
		try {
			const res = await client.twoFactor.sendOtp();
			if (res.error) throw new Error(res.error.message || 'Could not send code');
			toast.success('Two-factor code sent to your email.');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not send code');
		} finally {
			loading = false;
		}
	}

	async function verifyTwoFactorEmail() {
		if (twoFactorCode.trim().length < 6 || loading) return;
		loading = true;
		try {
			const res = await client.twoFactor.verifyOtp({ code: twoFactorCode.trim() });
			if (res.error) throw new Error(res.error.message || 'Invalid code');
			finish();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Invalid code');
		} finally {
			loading = false;
		}
	}

	async function signInWithPasskey() {
		loading = true;
		try {
			const res = await client.signIn.passkey();
			if (res.error) throw new Error(res.error.message || 'Passkey sign-in failed');
			finish();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Passkey sign-in failed');
		} finally {
			loading = false;
		}
	}

	function openMagicLinkPrompt() {
		magicLinkEmail = email.trim();
		stage = 'magicLink';
	}

	async function sendMagicLink() {
		const target = magicLinkEmail.trim();
		if (!target) {
			toast.error('Enter your email first');
			return;
		}
		loading = true;
		try {
			const res = await client.signIn.magicLink({ email: target, callbackURL });
			if (res.error) throw new Error(res.error.message || 'Could not send magic link');
			toast.success(`Sign-in link sent to ${target}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Could not send magic link');
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
				{#if stage === 'verify'}
					Enter the verification code we sent to {email}.
				{:else if stage === 'reset'}
					Enter the reset code and choose a new password.
				{:else if stage === 'twoFactor'}
					Enter the code from your authenticator app.
				{:else if stage === 'magicLink'}
					Enter the email address where we should send your one-time sign-in link.
				{:else}
					{$_('sign_in.form.description')}
				{/if}
			</DialogDescription>
		</DialogHeader>

		{#if stage === 'credentials'}
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
						type="text"
						required
						placeholder={mode === 'signup' ? 'you@example.com' : 'username@example.com or username'}
						bind:value={email}
						autocomplete="username"
					/>
					{#if mode === 'signup'}
						<Input
							type="text"
							placeholder="Username (optional, 3–30 characters)"
							minlength={3}
							maxlength={30}
							bind:value={username}
							autocomplete="username"
						/>
					{/if}
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

				{#if mode === 'signin'}
					<div class="flex justify-end gap-3 text-xs">
						<button type="button" class="text-primary cursor-pointer" onclick={() => requestPasswordReset()}>
							Forgot password?
						</button>
						<button
							type="button"
							class="text-primary cursor-pointer"
							onclick={() => askForCode('sign-in')}
						>
							Sign in with code
						</button>
					</div>
				{/if}

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

				<div class="grid grid-cols-2 gap-2">
					<Button variant="outline" size="sm" onclick={signInWithPasskey} disabled={loading}>
						Use passkey
					</Button>
					<Button variant="outline" size="sm" onclick={openMagicLinkPrompt} disabled={loading}>
						Magic link
					</Button>
				</div>

				<p class="text-muted-foreground text-center text-xs">
					{$_('sign_in.form.terms.0')}
					<a href="/legal/terms" class="text-primary hover:underline">{$_('sign_in.form.terms.1')}</a>
					{$_('sign_in.form.terms.2')}
					<a href="/legal/privacy" class="text-primary hover:underline"
						>{$_('sign_in.form.terms.3')}</a
					>
				</p>
			</div>
		{:else if stage === 'magicLink'}
			<div class="flex flex-col gap-3 py-2">
				<Input
					type="email"
					required
					placeholder="you@example.com"
					bind:value={magicLinkEmail}
					autocomplete="email"
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && sendMagicLink()}
				/>
				<Button onclick={sendMagicLink} disabled={loading || !magicLinkEmail.trim()}>
					Send magic link
				</Button>
				<button type="button" class="text-muted-foreground cursor-pointer text-xs" onclick={resetToCredentials}>
					Back
				</button>
			</div>
		{:else if stage === 'verify'}
			<div class="flex flex-col gap-3 py-2">
				<Input
					placeholder="6-digit code"
					inputmode="numeric"
					maxlength={6}
					bind:value={otp}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && verifyCode()}
				/>
				<Button onclick={verifyCode} disabled={loading || otp.trim().length < 6}>Verify Code</Button>
				<div class="flex justify-between text-xs">
					<button
						type="button"
						class="text-primary cursor-pointer"
						onclick={() => askForCode(verifyPurpose)}
					>
						Resend code
					</button>
					<button type="button" class="text-muted-foreground cursor-pointer" onclick={resetToCredentials}>
						Back
					</button>
				</div>
			</div>
		{:else if stage === 'reset'}
			<div class="flex flex-col gap-3 py-2">
				<Input
					placeholder="6-digit reset code"
					inputmode="numeric"
					maxlength={6}
					bind:value={otp}
				/>
				<div class="relative">
					<Input
						type={showPassword ? 'text' : 'password'}
						placeholder="New password (min. 8 characters)"
						bind:value={password}
						class="pr-10"
					/>
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
						tabindex={-1}
					>
						<HugeiconsIcon icon={showPassword ? ViewOffIcon : ViewIcon} class="h-4 w-4" />
					</button>
				</div>
				<div class="relative">
					<Input
						type={showPassword ? 'text' : 'password'}
						placeholder="Confirm new password"
						bind:value={confirmPassword}
						class="pr-10"
					/>
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
						onclick={() => (showPassword = !showPassword)}
						aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
						tabindex={-1}
					>
						<HugeiconsIcon icon={showPassword ? ViewOffIcon : ViewIcon} class="h-4 w-4" />
					</button>
				</div>
				<Button
					onclick={resetPassword}
					disabled={loading || otp.trim().length < 6 || password.length < 8 || password !== confirmPassword}
				>
					Reset Password
				</Button>
				<div class="flex justify-between text-xs">
					<button type="button" class="text-primary cursor-pointer" onclick={requestPasswordReset}>
						Resend code
					</button>
					<button type="button" class="text-muted-foreground cursor-pointer" onclick={resetToCredentials}>
						Back
					</button>
				</div>
			</div>
		{:else}
			<div class="flex flex-col gap-3 py-2">
				<Input
					placeholder="6-digit code"
					inputmode="numeric"
					maxlength={6}
					bind:value={twoFactorCode}
					onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && verifyTwoFactor()}
				/>
				<Button
					onclick={verifyTwoFactor}
					disabled={loading || twoFactorCode.trim().length < 6}
				>
					Verify Authenticator Code
				</Button>
				<div class="grid grid-cols-2 gap-2">
					<Button variant="outline" size="sm" onclick={emailTwoFactorCode} disabled={loading}>
						Email me a code
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={verifyTwoFactorEmail}
						disabled={loading || twoFactorCode.trim().length < 6}
					>
						Use emailed code
					</Button>
				</div>
				<button type="button" class="text-muted-foreground cursor-pointer text-xs" onclick={resetToCredentials}>
					Back
				</button>
			</div>
		{/if}
	</DialogContent>
</Dialog>
