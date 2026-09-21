import { writable } from 'svelte/store';

export interface ChatMessage {
	id: number;
	channelId: number;
	senderId: number;
	senderUsername: string;
	senderImage: string | null;
	content: string;
	createdAt: string | number;
}

// Map of channelId to array of messages
export const CHAT_MESSAGES = writable<Record<number, ChatMessage[]>>({});

// Unread counts per channel
export const CHAT_UNREAD = writable<Record<number, number>>({});
export const CHAT_UNREAD_COUNT = writable<number>(0);

// Channel the user is currently viewing (from the chat page)
export const ACTIVE_CHANNEL_ID = writable<number | null>(null);

// Channel that was just removed (group deleted / member kicked) — the chat page
// watches this to drop it from the UI immediately.
export const REMOVED_CHAT_CHANNEL = writable<number | null>(null);

export function handleChatChannelRemoved(channelId: number) {
	CHAT_MESSAGES.update((messages) => {
		const next = { ...messages };
		delete next[channelId];
		return next;
	});
	CHAT_UNREAD.update((counts) => {
		const next = { ...counts };
		delete next[channelId];
		const total = Object.values(next).reduce((sum, n) => sum + n, 0);
		CHAT_UNREAD_COUNT.set(total);
		return next;
	});
	REMOVED_CHAT_CHANNEL.set(channelId);
}

export function incrementChatUnread(channelId: number) {
	CHAT_UNREAD.update((counts) => ({
		...counts,
		[channelId]: (counts[channelId] || 0) + 1
	}));
	CHAT_UNREAD_COUNT.update((c) => c + 1);
}

export function clearChatUnread(channelId: number) {
	CHAT_UNREAD.update((counts) => {
		const next = { ...counts };
		delete next[channelId];
		return next;
	});
	CHAT_UNREAD_COUNT.set(0);
}

export function addChatMessage(message: ChatMessage) {
	CHAT_MESSAGES.update((messages) => {
		const channelMessages = messages[message.channelId] || [];

		// Prevent duplicates
		if (channelMessages.some((m) => m.id === message.id)) {
			return messages;
		}

		return {
			...messages,
			[message.channelId]: [...channelMessages, message].sort(
				(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
			)
		};
	});
}

export function setChatMessages(channelId: number, newMessages: ChatMessage[]) {
	CHAT_MESSAGES.update((messages) => ({
		...messages,
		[channelId]: newMessages.sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		)
	}));
}
