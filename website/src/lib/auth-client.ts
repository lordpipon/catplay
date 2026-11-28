import { createAuthClient } from 'better-auth/svelte';
import { apiKeyClient } from '@better-auth/api-key/client';
import {
	emailOTPClient,
	magicLinkClient,
	twoFactorClient
} from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { env } from '$env/dynamic/public';

export const client = createAuthClient({
	baseURL: env.PUBLIC_BETTER_AUTH_URL,
	plugins: [
		apiKeyClient(),
		emailOTPClient(),
		magicLinkClient(),
		twoFactorClient({
			onTwoFactorRedirect: () => {
				if (typeof window !== 'undefined') {
					window.dispatchEvent(new CustomEvent('catplay:two-factor-required'));
				}
			}
		}),
		passkeyClient()
	]
});

export const { signIn, signUp, getSession, signOut } = client;
export { client as authClient };
