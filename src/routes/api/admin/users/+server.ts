import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';
import { pushRefresh } from '$lib/ittyPush';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const { name } = await request.json();
	if (!name?.trim()) throw error(400, 'Name required');

	const { data, error: err } = await supabase
		.from('users')
		.insert({ name: name.trim() })
		.select()
		.single();

	if (err) throw error(500, err.message);
	await pushRefresh();
	return json(data);
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const { id } = await request.json();
	if (!id) throw error(400, 'ID required');

	const { error: err } = await supabase.from('users').delete().eq('id', id);
	if (err) throw error(500, err.message);
	await pushRefresh();
	return json({ ok: true });
};
