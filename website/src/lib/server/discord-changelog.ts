import { db } from '$lib/server/db';
import { globalSetting } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

const WEBHOOK_SETTING_KEY = 'discord_changelog_webhook';

export function parseDiscordWebhookUrl(url: string): string | null {
	if (typeof url !== 'string') return null;
	const trimmed = url.trim();
	const match = trimmed.match(/^https?:\/\/discord\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)\/?$/i);
	if (!match) return null;
	return `https://discord.com/api/webhooks/${match[1]}/${match[2]}`;
}

export async function getDiscordChangelogWebhook(): Promise<string | null> {
	const [row] = await db.select().from(globalSetting).where(eq(globalSetting.key, WEBHOOK_SETTING_KEY));
	return row?.value || null;
}

export async function setDiscordChangelogWebhook(url: string, updatedBy: number) {
	const now = new Date();
	const normalized = parseDiscordWebhookUrl(url);
	if (!normalized) {
		throw new Error('Invalid Discord webhook URL. Use the full /api/webhooks/{id}/{token} URL from your channel.');
	}
	await db
		.insert(globalSetting)
		.values({ key: WEBHOOK_SETTING_KEY, value: normalized, updatedAt: now, updatedBy })
		.onConflictDoUpdate({
			target: globalSetting.key,
			set: { value: normalized, updatedAt: now, updatedBy }
		});
	return normalized;
}

export async function clearDiscordChangelogWebhook() {
	await db.delete(globalSetting).where(eq(globalSetting.key, WEBHOOK_SETTING_KEY));
}

export async function postChangelogEntryToDiscord(entry: {
	title: string;
	content: string;
	tag?: string | null;
	createdAt: Date;
}): Promise<boolean> {
	const webhookUrl = await getDiscordChangelogWebhook();
	if (!webhookUrl) return false;

	const tagColors: Record<string, number> = {
		update: 0x3b82f6,
		feature: 0x8b5cf6,
		fix: 0x22c55e,
		hotfix: 0xef4444,
		event: 0xf59e0b,
		maintenance: 0x64748b
	};

	const payload = {
		username: 'Catplay Updates',
		embeds: [
			{
				title: entry.title,
				description: entry.content.slice(0, 4096),
				color: tagColors[entry.tag ?? 'update'] ?? 0x3b82f6,
				timestamp: entry.createdAt.toISOString(),
				footer: { text: (entry.tag ?? 'update').toUpperCase() }
			}
		]
	};

	try {
		const res = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		return res.ok;
	} catch {
		return false;
	}
}