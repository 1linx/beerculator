import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1') || 1);
	const offset = (page - 1) * PAGE_SIZE;

	const db = getDb();
	const { count } = db.prepare('SELECT COUNT(*) AS count FROM beer_log').get() as { count: number };
	const entries = db
		.prepare('SELECT * FROM beer_log ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?')
		.all(PAGE_SIZE, offset);

	return json({
		entries,
		total: count,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.ceil(count / PAGE_SIZE)
	});
};
