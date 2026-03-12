import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';

const PAGE_SIZE = 20;

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const from = (page - 1) * PAGE_SIZE;
	const to = from + PAGE_SIZE - 1;

	const { data, error: err, count } = await supabase
		.from('beer_log')
		.select('*', { count: 'exact' })
		.order('created_at', { ascending: false })
		.range(from, to);

	if (err) throw error(500, err.message);

	return json({
		entries: data ?? [],
		total: count ?? 0,
		page,
		pageSize: PAGE_SIZE,
		totalPages: Math.ceil((count ?? 0) / PAGE_SIZE)
	});
};
