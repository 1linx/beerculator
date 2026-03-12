import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Read session cookie
	const session = event.cookies.get('admin_session');
	event.locals.isAdmin = session === 'authenticated';
	return resolve(event);
};
