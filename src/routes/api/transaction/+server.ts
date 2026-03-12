import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase, logEvent } from '$lib/supabase';
import { rationalize } from '$lib/rationalize';
import type { BeerDebt, User } from '$lib/supabase';
import { pushRefresh } from '$lib/ittyPush';

// POST: buyer_id bought a beer for recipient_id → recipient owes buyer
export const POST: RequestHandler = async ({ request }) => {
	const { buyer_id, recipient_id } = await request.json();

	if (!buyer_id || !recipient_id || buyer_id === recipient_id) {
		throw error(400, 'Invalid request');
	}

	// Load users and current debts in parallel
	const [{ data: users, error: usersErr }, { data: debts, error: loadErr }] = await Promise.all([
		supabase.from('users').select('id, name'),
		supabase.from('beer_debts').select('*')
	]);

	if (usersErr) throw error(500, usersErr.message);
	if (loadErr) throw error(500, loadErr.message);

	const nameOf = (id: string) =>
		(users as User[]).find((u) => u.id === id)?.name ?? id;

	const buyer = nameOf(buyer_id);
	const recipient = nameOf(recipient_id);

	// Add 1 beer: recipient owes buyer
	const current = (debts as BeerDebt[]) ?? [];
	const existingIdx = current.findIndex(
		(d) => d.debtor_id === recipient_id && d.creditor_id === buyer_id
	);

	if (existingIdx >= 0) {
		current[existingIdx] = { ...current[existingIdx], amount: current[existingIdx].amount + 1 };
	} else {
		current.push({ id: '', debtor_id: recipient_id, creditor_id: buyer_id, amount: 1 });
	}

	// Log the transaction
	await logEvent('transaction', `${buyer} bought ${recipient} a beer (${recipient} now owes ${buyer})`);

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
			await logEvent(
				'cancellation',
				`Debts cancelled: ${buyer} owed ${recipient} ${cancel} 🍺 — offset against ${recipient} owing ${buyer}`
			);
		}
	}

	// Run chain rationalization
	const { debts: rationalized, collapses } = rationalize(current.filter((d) => d.amount > 0));

	// Log each chain collapse
	for (const { a, b, c, amount } of collapses) {
		await logEvent(
			'rationalization',
			`Chain collapsed: ${nameOf(a)} → ${nameOf(b)} → ${nameOf(c)} (${amount} 🍺 redirected)`
		);
	}

	// Persist and notify clients
	await persistDebts(current, rationalized);
	await pushRefresh();

	return json({ ok: true });
};

async function persistDebts(previous: BeerDebt[], next: BeerDebt[]) {
	const nextKeys = new Set(next.map((d) => `${d.debtor_id}|${d.creditor_id}`));

	for (const d of previous) {
		const k = `${d.debtor_id}|${d.creditor_id}`;
		if (!nextKeys.has(k) && d.id) {
			await supabase.from('beer_debts').delete().eq('id', d.id);
		}
	}

	for (const d of next) {
		if (d.id) {
			await supabase
				.from('beer_debts')
				.update({ amount: d.amount, updated_at: new Date().toISOString() })
				.eq('id', d.id);
		} else {
			await supabase
				.from('beer_debts')
				.insert({ debtor_id: d.debtor_id, creditor_id: d.creditor_id, amount: d.amount });
		}
	}
}
