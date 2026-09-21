import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, changelogEntry } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { hasFlag } from '$lib/data/flags';
import { getDiscordChangelogWebhook, setDiscordChangelogWebhook, clearDiscordChangelogWebhook } from '$lib/server/discord-changelog';
import type { RequestHandler } from './$types';

async function requireHeadAdmin(headers: Headers): Promise<number> {
	const session = await auth.api.getSession({ headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const [currentUser] = await db.select({ flags: user.flags }).from(user).where(eq(user.id, Number(session.user.id))).limit(1);
	if (!hasFlag(currentUser?.flags, 'IS_HEAD_ADMIN')) throw error(403, 'Head admin only');
	return Number(session.user.id);
}

export const GET: RequestHandler = async ({ request }) => {
	await requireHeadAdmin(request.headers);
	const webhookUrl = await getDiscordChangelogWebhook();

	const entries = await db.select().from(changelogEntry).orderBy(desc(changelogEntry.createdAt)).limit(50);

	return json({ entries, webhookConfigured: Boolean(webhookUrl), webhookUrl: webhookUrl ? maskWebhookUrl(webhookUrl) : null });
};

export const POST: RequestHandler = async ({ request }) => {
	const userId = await requireHeadAdmin(request.headers);

	const body = await request.json();

	// Discord webhook config
	if (body.action === 'set-webhook') {
		try {
			const normalized = await setDiscordChangelogWebhook(String(body.webhookUrl ?? ''), userId);
			return json({ success: true, webhookUrl: maskWebhookUrl(normalized) });
		} catch (err) {
			return json({ error: err instanceof Error ? err.message : 'Invalid webhook URL' }, { status: 400 });
		}
	}
	if (body.action === 'clear-webhook') {
		await clearDiscordChangelogWebhook();
		return json({ success: true, webhookUrl: null });
	}

	const { title, content, tag } = body;
	if (!title?.trim() || !content?.trim()) return json({ error: 'Title and content required' }, { status: 400 });

	const [entry] = await db.insert(changelogEntry).values({
		title: title.trim(),
		content: content.trim(),
		tag: tag || 'update',
		createdBy: userId
	}).returning();

	return json(entry);
};

export const DELETE: RequestHandler = async ({ request }) => {
	await requireHeadAdmin(request.headers);

	const { id } = await request.json();
	await db.delete(changelogEntry).where(eq(changelogEntry.id, id));
	return json({ success: true });
};

function maskWebhookUrl(url: string): string {
	const match = url.match(/\/webhooks\/(\d+)\/[A-Za-z0-9_-]+$/);
	if (!match) return '';
	return `https://discord.com/api/webhooks/${match[1]}/••••••••`;
}
