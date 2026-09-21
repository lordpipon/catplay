import { env as privateEnv } from '$env/dynamic/private';
import { SITE_ORIGIN } from '../site';

export const SECRET_WEBHOOK_URL = privateEnv.DISCORD_WEBHOOK_URL || '';

export function trustedOrigins(): string[] {
	const origins = new Set<string>();
	if (SITE_ORIGIN) origins.add(SITE_ORIGIN);
	const extraOrigins: string = (privateEnv as Record<string, string>)['PUBLIC_TRUSTED_ORIGINS'] ?? '';
	for (const extra of extraOrigins.split(',').map((s) => s.trim()).filter(Boolean)) {
		origins.add(extra);
	}
	// Localhost dev origins are always useful for a fork.
	origins.add('http://localhost:5173');
	origins.add('http://localhost:4173');
	return [...origins];
}