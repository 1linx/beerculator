import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, logEvent, newId, now } from '$lib/server/db';
import { pushRefresh } from '$lib/ittyPush';

// Set a specific debt amount between two users
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.isAdmin) throw error(401, 'Unauthorized');

	const { debtor_id, creditor_id, amount } = await request.json();

	if (!debtor_id || !creditor_id || debtor_id === creditor_id) {
		throw error(400, 'Invalid request');
	}

	const amt = parseInt(amount);
	if (isNaN(amt) || amt < 0) throw error(400, 'Amount must be a non-negative integer');

	const db = getDb();
	const nameStmt = db.prepare('SELECT name FROM users WHERE id = ?');
	const nameOf = (id: string) => (nameStmt.get(id) as { name: string } | undefined)?.name ?? id;

	const debtor = nameOf(debtor_id);
	const creditor = nameOf(creditor_id);

	try {
		db.transaction(() => {
			if (amt === 0) {
				db.prepare('DELETE FROM beer_debts WHERE debtor_id = ? AND creditor_id = ?').run(
					debtor_id,
					creditor_id
				);
				logEvent('manual_debt', `Admin cleared debt: ${debtor} owed ${creditor}`);
			} else {
				const ts = now();
				db.prepare(
					`INSERT INTO beer_debts (id, debtor_id, creditor_id, amount, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ?, ?)
					 ON CONFLICT (debtor_id, creditor_id)
					 DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`
				).run(newId(), debtor_id, creditor_id, amt, ts, ts);
				logEvent('manual_debt', `Admin set: ${debtor} owes ${creditor} ${amt} 🍺`);
			}
		})();
	} catch (err) {
		throw error(500, (err as Error).message);
	}

	await pushRefresh();
	return json({ ok: true });
};
