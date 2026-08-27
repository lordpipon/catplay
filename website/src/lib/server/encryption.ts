import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
	const secret = process.env.CHAT_ENCRYPTION_KEY || process.env.PRIVATE_BETTER_AUTH_SECRET;
	if (!secret) throw new Error('CHAT_ENCRYPTION_KEY or PRIVATE_BETTER_AUTH_SECRET is required');
	return createHmac('sha256', secret).update('catplay-chat-v1').digest();
}

function deriveConversationKey(user1Id: number, user2Id: number): Buffer {
	const minId = Math.min(user1Id, user2Id);
	const maxId = Math.max(user1Id, user2Id);
	return createHmac('sha256', getMasterKey()).update(`${minId}:${maxId}`).digest();
}

export function encryptMessage(plainText: string, user1Id: number, user2Id: number): string {
	const key = deriveConversationKey(user1Id, user2Id);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plainText, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptMessage(cipherText: string, user1Id: number, user2Id: number): string {
	const key = deriveConversationKey(user1Id, user2Id);
	const parts = cipherText.split(':');

	if (parts.length !== 3) return cipherText;

	const [ivHex, tagHex, encrypted] = parts;
	const iv = Buffer.from(ivHex, 'hex');
	const authTag = Buffer.from(tagHex, 'hex');
	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted = decipher.update(encrypted, 'hex', 'utf8');
	decrypted += decipher.final('utf8');

	return decrypted;
}

export function isEncrypted(text: string): boolean {
	const parts = text.split(':');
	return parts.length === 3 && parts[0].length === IV_LENGTH * 2 && parts[1].length === TAG_LENGTH * 2;
}
