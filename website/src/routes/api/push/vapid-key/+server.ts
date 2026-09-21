import { json } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ publicKey: publicEnv.PUBLIC_VAPID_PUBLIC_KEY ?? '' });
};