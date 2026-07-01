import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabase';

// Health check for keep-alive service — no auth, no styling, just JSON.
// Also confirms DB connectivity by fetching one recent log entry.
export const GET: RequestHandler = async () => {
	const { data, error: err } = await supabase
		.from('beer_log')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (err) {
		return json({ ok: false, db: false, error: err.message }, { status: 503 });
	}

	return json({ ok: true, db: true, latest: data ?? null });
};
