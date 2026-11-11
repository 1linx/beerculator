import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';

// Health check for keep-alive service — no auth, no styling, just JSON.
// Also confirms DB connectivity by fetching one recent log entry.
export const GET: RequestHandler = async () => {
	try {
		const latest = getDb()
			.prepare('SELECT * FROM beer_log ORDER BY created_at DESC, rowid DESC LIMIT 1')
			.get();
		return json({ ok: true, db: true, latest: latest ?? null });
	} catch (err) {
		return json({ ok: false, db: false, error: (err as Error).message }, { status: 503 });
	}
};
