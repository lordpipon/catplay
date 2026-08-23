import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	// Session data must never be served stale from the HTTP cache
	event.setHeaders({ 'Cache-Control': 'no-cache' });

	// Use the user data already fetched and processed in hooks
	return {
		userSession: event.locals.userSession,
		url: event.url.pathname
	};
};
