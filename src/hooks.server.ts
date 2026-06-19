import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

// Common credential-probe paths bots scan for — reject these outright.
const BLOCKED = [
	/^\/\.env/i, // .env, .env.local, .env.production, ...
	/^\/\.git(\/|$)/i, // .git/config, .git/HEAD
	/^\/\.aws(\/|$)/i,
	/^\/\.htaccess$/i,
	/^\/\.DS_Store$/i,
	/\.(sql|php|key|pem)$/i, // backup.sql, phpinfo.php, server.key, id_rsa.pem
	/^\/(secrets|credentials|security-settings|config)\.json$/i,
	/^\/ecosystem\.config\.(c?js)$/i,
	/^\/id_rsa$/i
];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// Credential-probe blocklist — reject early with 403, before auth/redirect.
	if (BLOCKED.some((re) => re.test(path))) {
		return new Response('Forbidden', { status: 403 });
	}

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
