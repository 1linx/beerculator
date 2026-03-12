import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase, logEvent } from '$lib/supabase';
import type { User } from '$lib/supabase';
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

	// Fetch names for the log
	const { data: users } = await supabase
		.from('users')
		.select('id, name')
		.in('id', [debtor_id, creditor_id]);

	const nameOf = (id: string) =>
		(users as User[] | null)?.find((u) => u.id === id)?.name ?? id;

	const debtor = nameOf(debtor_id);
	const creditor = nameOf(creditor_id);

	if (amt === 0) {
		await supabase
			.from('beer_debts')
			.delete()
			.eq('debtor_id', debtor_id)
			.eq('creditor_id', creditor_id);
		await logEvent('manual_debt', `Admin cleared debt: ${debtor} owed ${creditor}`);
		await pushRefresh();
		return json({ ok: true });
	}

	const { error: err } = await supabase.from('beer_debts').upsert(
		{ debtor_id, creditor_id, amount: amt, updated_at: new Date().toISOString() },
		{ onConflict: 'debtor_id,creditor_id' }
	);

	if (err) throw error(500, err.message);

	await logEvent('manual_debt', `Admin set: ${debtor} owes ${creditor} ${amt} 🍺`);
	await pushRefresh();

	return json({ ok: true });
};
