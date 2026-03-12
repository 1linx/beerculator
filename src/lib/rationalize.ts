import type { BeerDebt } from './supabase';

export type ChainCollapse = {
	a: string; // debtor
	b: string; // middle node (removed from chain)
	c: string; // creditor
	amount: number;
};

export type RationalizeResult = {
	debts: BeerDebt[];
	collapses: ChainCollapse[];
};

/**
 * Rationalize debts by collapsing chains: if A owes B and B owes C,
 * reduce A→B and B→C by the min amount, and increase A→C by that amount.
 * Repeat until stable. Returns updated debts and a list of chain collapse events.
 */
export function rationalize(debts: BeerDebt[]): RationalizeResult {
	const map = new Map<string, number>();

	for (const d of debts) {
		if (d.amount > 0) {
			map.set(key(d.debtor_id, d.creditor_id), d.amount);
		}
	}

	const collapses: ChainCollapse[] = [];

	let changed = true;
	while (changed) {
		changed = false;

		const users = new Set<string>();
		for (const [k] of map) {
			const [a, b] = k.split('|');
			users.add(a);
			users.add(b);
		}

		const userList = [...users];

		for (const a of userList) {
			for (const b of userList) {
				if (a === b) continue;
				const ab = map.get(key(a, b)) ?? 0;
				if (ab === 0) continue;

				for (const c of userList) {
					if (c === a || c === b) continue;
					const bc = map.get(key(b, c)) ?? 0;
					if (bc === 0) continue;

					// Collapse A→B→C
					const transfer = Math.min(ab, bc);
					setDebt(map, a, b, ab - transfer);
					setDebt(map, b, c, bc - transfer);
					const ac = map.get(key(a, c)) ?? 0;
					setDebt(map, a, c, ac + transfer);

					collapses.push({ a, b, c, amount: transfer });
					changed = true;
				}
			}
		}
	}

	// Convert back to BeerDebt array (preserve ids where possible)
	const existingById = new Map(debts.map((d) => [key(d.debtor_id, d.creditor_id), d]));
	const result: BeerDebt[] = [];

	for (const [k, amount] of map) {
		if (amount === 0) continue;
		const [debtor_id, creditor_id] = k.split('|');
		const existing = existingById.get(k);
		result.push({ id: existing?.id ?? '', debtor_id, creditor_id, amount });
	}

	return { debts: result, collapses };
}

function key(a: string, b: string): string {
	return `${a}|${b}`;
}

function setDebt(map: Map<string, number>, a: string, b: string, amount: number) {
	if (amount <= 0) {
		map.delete(`${a}|${b}`);
	} else {
		map.set(`${a}|${b}`, amount);
	}
}
