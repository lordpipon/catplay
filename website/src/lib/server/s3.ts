import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { processImage } from './image.js';

const UPLOADS_DIR = '/app/uploads';

async function ensureDir(filePath: string): Promise<void> {
	const dir = dirname(filePath);
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
}

export async function deleteObject(key: string): Promise<void> {
	const filePath = `${UPLOADS_DIR}/${key}`;
	try {
		await unlink(filePath);
	} catch {
		// File doesn't exist, ignore
	}
}

export async function uploadProfilePicture(
	identifier: string,
	body: Uint8Array,
	contentType: string
): Promise<string> {
	if (!contentType || !contentType.startsWith('image/')) {
		throw new Error('Invalid file type. Only images are allowed.');
	}

	const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
	if (!allowedTypes.includes(contentType.toLowerCase())) {
		throw new Error('Unsupported image format. Only JPEG, PNG, GIF, and WebP are allowed.');
	}

	const processedImage = await processImage(Buffer.from(body));
	const key = `avatars/${identifier}-${Date.now()}.webp`;
	const filePath = `${UPLOADS_DIR}/${key}`;

	await ensureDir(filePath);
	await writeFile(filePath, processedImage.buffer);

	return key;
}

export async function uploadCoinIcon(
	coinSymbol: string,
	body: Uint8Array,
	contentType: string
): Promise<string> {
	if (!contentType || !contentType.startsWith('image/')) {
		throw new Error('Invalid file type. Only images are allowed.');
	}

	const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
	if (!allowedTypes.includes(contentType.toLowerCase())) {
		throw new Error('Unsupported image format. Only JPEG, PNG, GIF, and WebP are allowed.');
	}

	const processedImage = await processImage(Buffer.from(body));
	const key = `coins/${coinSymbol.toLowerCase()}-${Date.now()}.webp`;
	const filePath = `${UPLOADS_DIR}/${key}`;

	await ensureDir(filePath);
	await writeFile(filePath, processedImage.buffer);

	return key;
}

// Stub exports kept for compatibility
export async function generatePresignedUrl(key: string, _contentType: string): Promise<string> {
	return `/api/proxy/s3/${key}`;
}

export async function generateDownloadUrl(key: string): Promise<string> {
	return `/api/proxy/s3/${key}`;
}
