import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, newId, now } from '$lib/server/db';
import type { User } from '$lib/types';
import { pushRefresh } from '$lib/ittyPush';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const { name } = await request.json();
	if (!name?.trim()) throw error(400, 'Name required');

	let user: User;
	try {
		user = getDb()
			.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?) RETURNING *')
			.get(newId(), name.trim(), now()) as User;
	} catch (err) {
		throw error(500, (err as Error).message);
	}

	await pushRefresh();
	return json(user);
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const { id } = await request.json();
	if (!id) throw error(400, 'ID required');

	// beer_debts rows are removed via ON DELETE CASCADE
	getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
	await pushRefresh();
	return json({ ok: true });
};
