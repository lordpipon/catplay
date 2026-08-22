import { error } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const UPLOADS_DIR = '/app/uploads';

export async function GET({ params }: { params: { path: string } }) {
	const path = params.path;

	if (!path) {
		throw error(400, 'Path is required');
	}

	// Prevent path traversal attacks
	if (path.includes('..') || path.startsWith('/')) {
		throw error(400, 'Invalid path');
	}

	const filePath = `${UPLOADS_DIR}/${path}`;

	if (!existsSync(filePath)) {
		throw error(404, 'File not found');
	}

	try {
		const buffer = await readFile(filePath);

		const ext = path.split('.').pop()?.toLowerCase();
		const contentTypeMap: Record<string, string> = {
			webp: 'image/webp',
			jpg: 'image/jpeg',
			jpeg: 'image/jpeg',
			png: 'image/png',
			gif: 'image/gif'
		};
		const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

		let cacheControl: string;
		if (path.startsWith('coins/')) {
			cacheControl = 'public, max-age=31536000, immutable';
		} else if (path.startsWith('avatars/')) {
			cacheControl = 'public, max-age=60';
		} else {
			cacheControl = 'public, max-age=86400';
		}

		return new Response(buffer, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': cacheControl,
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET',
				'Access-Control-Allow-Headers': 'Content-Type'
			}
		});
	} catch (e) {
		console.error('File serve error:', e);
		throw error(500, 'Failed to serve file');
	}
}
