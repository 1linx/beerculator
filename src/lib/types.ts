export type User = {
	id: string;
	name: string;
	created_at: string;
};

export type BeerDebt = {
	id: string;
	debtor_id: string;
	creditor_id: string;
	amount: number;
};

export type BeerLog = {
	id: string;
	event_type: 'transaction' | 'cancellation' | 'rationalization' | 'manual_debt';
	description: string;
	created_at: string;
};
