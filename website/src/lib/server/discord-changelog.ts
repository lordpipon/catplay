import { db } from '$lib/server/db';
import { globalSetting, changelogEntry } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

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

export interface DiscordChangelogSyncResult {
	added: number;
	fetched: number;
	messagesTotal: number;
}

export async function syncDiscordChangelog(): Promise<DiscordChangelogSyncResult> {
	const webhookUrl = await getDiscordChangelogWebhook();
	if (!webhookUrl) return { added: 0, fetched: 0, messagesTotal: 0 };

	let res: Response;
	try {
		res = await fetch(`${webhookUrl}/messages?limit=50`, {
			headers: { Accept: 'application/json' }
		});
	} catch {
		return { added: 0, fetched: 0, messagesTotal: 0 };
	}

	if (!res.ok) return { added: 0, fetched: 0, messagesTotal: 0 };

	const messages: Array<{ id: string; content?: string; author?: { username?: string } | null }> =
		await res.json();

	const messagesTotal = messages.length;
	let added = 0;

	const messageIds = messages.map((m) => m.id);
	let existing: Array<{ discordMessageId: string | null }> = [];
	if (messageIds.length > 0) {
		existing = await db
			.select({ discordMessageId: changelogEntry.discordMessageId })
			.from(changelogEntry)
			.where(inArray(changelogEntry.discordMessageId, messageIds));
	}
	const existingSet = new Set(existing.map((e) => e.discordMessageId));

	for (const message of messages) {
		if (existingSet.has(message.id)) continue;
		let content = (message.content ?? '').trim();
		if (!content) continue;

		const firstLine = content.split('\n')[0]?.trim() ?? '';
		const title = (firstLine || `Update from ${message.author?.username || 'Discord'}`).slice(0, 200);

		await db.insert(changelogEntry).values({
			title,
			content,
			tag: 'update',
			discordMessageId: message.id
		});
		existingSet.add(message.id);
		added++;
	}

	return { added, fetched: messages.length, messagesTotal };
}