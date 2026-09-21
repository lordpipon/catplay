import { env as publicEnv } from '$env/dynamic/public';

export const SITE_NAME = publicEnv.PUBLIC_SITE_NAME || 'Catplay';
export const SITE_ORIGIN = (
	publicEnv.PUBLIC_SITE_ORIGIN ||
	publicEnv.PUBLIC_BETTER_AUTH_URL ||
	'https://catplay.org'
).replace(/\/+$/, '');
export const SITE_DESCRIPTION =
	publicEnv.PUBLIC_SITE_DESCRIPTION ||
	'The fake crypto trading simulator. Practice trading with virtual cash — no real money involved.';

export const CONTACT_EMAIL = publicEnv.PUBLIC_SITE_CONTACT_EMAIL || 'contact@outpoot.com';
export const DISCORD_INVITE = publicEnv.PUBLIC_DISCORD_INVITE || 'https://discord.gg/NKzq7ppNQK';
export const GITHUB_REPO = publicEnv.PUBLIC_GITHUB_REPO || 'https://github.com/lordpipon/catplay';
export const ADSENSE_CLIENT = publicEnv.PUBLIC_ADSENSE_CLIENT || 'ca-pub-8656856296349420';