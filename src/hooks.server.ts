import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Site-wide auth barrier — allow through only the auth page and its API
	if (path !== '/auth' && !path.startsWith('/api/auth')) {
		const siteAuth = event.cookies.get('site_auth');
		if (siteAuth !== 'authenticated') {
			throw redirect(302, '/auth');
		}
	}

	// Admin session cookie
	const session = event.cookies.get('admin_session');
	event.locals.isAdmin = session === 'authenticated';
	return resolve(event);
};
