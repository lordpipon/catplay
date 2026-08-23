import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveVipUsernames } from '$lib/server/vip';

export const GET: RequestHandler = async () => {
	const usernames = await getActiveVipUsernames();
	return json({ vips: [...usernames] });
};
