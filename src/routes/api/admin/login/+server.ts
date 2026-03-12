import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { username, password } = await request.json();

	if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
		cookies.set('admin_session', 'authenticated', {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 // 24 hours
		});
		return json({ ok: true });
	}

	throw error(401, 'Invalid credentials');
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete('admin_session', { path: '/' });
	return json({ ok: true });
};
