import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, logEvent, newId, now } from '$lib/server/db';
import { rationalize } from '$lib/rationalize';
import type { BeerDebt, User } from '$lib/types';
import { pushRefresh } from '$lib/ittyPush';

// POST: buyer_id bought a beer for recipient_id → recipient owes buyer
export const POST: RequestHandler = async ({ request }) => {
	const { buyer_id, recipient_id } = await request.json();

	if (!buyer_id || !recipient_id || buyer_id === recipient_id) {
		throw error(400, 'Invalid request');
	}

	const db = getDb();

	// The whole read → compute → write runs in one SQLite transaction, so concurrent
	// drops can't interleave and a failure leaves no partial state.
	try {
		db.transaction(() => recordBeer(db, buyer_id, recipient_id))();
	} catch (err) {
		throw error(500, (err as Error).message);
	}

	await pushRefresh();
	return json({ ok: true });
};

function recordBeer(db: ReturnType<typeof getDb>, buyer_id: string, recipient_id: string) {
	const users = db.prepare('SELECT id, name FROM users').all() as User[];
	const current = db.prepare('SELECT id, debtor_id, creditor_id, amount FROM beer_debts').all() as BeerDebt[];

	const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;

	const buyer = nameOf(buyer_id);
	const recipient = nameOf(recipient_id);

	// Add 1 beer: recipient owes buyer
	const existingIdx = current.findIndex(
		(d) => d.debtor_id === recipient_id && d.creditor_id === buyer_id
	);

	if (existingIdx >= 0) {
		current[existingIdx] = { ...current[existingIdx], amount: current[existingIdx].amount + 1 };
	} else {
		current.push({ id: '', debtor_id: recipient_id, creditor_id: buyer_id, amount: 1 });
	}

	// Log the transaction
	logEvent('transaction', `${buyer} bought ${recipient} a beer (${recipient} now owes ${buyer})`);

	// Cancel any direct reverse debt (buyer owes recipient)
	const reverseIdx = current.findIndex(
		(d) => d.debtor_id === buyer_id && d.creditor_id === recipient_id
	);
	if (reverseIdx >= 0) {
		const reverse = current[reverseIdx];
		const forward = current[existingIdx >= 0 ? existingIdx : current.length - 1];
		const cancel = Math.min(reverse.amount, forward.amount);
		if (cancel > 0) {
			reverse.amount -= cancel;
			forward.amount -= cancel;
			logEvent(
				'cancellation',
				`Debts cancelled: ${buyer} owed ${recipient} ${cancel} 🍺 — offset against ${recipient} owing ${buyer}`
			);
		}
	}

	// Run chain rationalization
	const { debts: rationalized, collapses } = rationalize(current.filter((d) => d.amount > 0));

	// Log each chain collapse
	for (const { a, b, c, amount } of collapses) {
		logEvent(
			'rationalization',
			`Chain collapsed: ${nameOf(a)} → ${nameOf(b)} → ${nameOf(c)} (${amount} 🍺 redirected)`
		);
	}

	persistDebts(db, current, rationalized);
}

function persistDebts(db: ReturnType<typeof getDb>, previous: BeerDebt[], next: BeerDebt[]) {
	const nextKeys = new Set(next.map((d) => `${d.debtor_id}|${d.creditor_id}`));
	const ts = now();

	const del = db.prepare('DELETE FROM beer_debts WHERE id = ?');
	const upd = db.prepare('UPDATE beer_debts SET amount = ?, updated_at = ? WHERE id = ?');
	const ins = db.prepare(
		`INSERT INTO beer_debts (id, debtor_id, creditor_id, amount, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (debtor_id, creditor_id)
		 DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`
	);

	for (const d of previous) {
		const k = `${d.debtor_id}|${d.creditor_id}`;
		if (!nextKeys.has(k) && d.id) del.run(d.id);
	}

	for (const d of next) {
		if (d.id) upd.run(d.amount, ts, d.id);
		else ins.run(newId(), d.debtor_id, d.creditor_id, d.amount, ts, ts);
	}
}
