import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
	if (!_client) {
		_client = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
	}
	return _client;
}

// Convenience proxy so existing `supabase.from(...)` calls still work at runtime
export const supabase = new Proxy({} as SupabaseClient, {
	get(_target, prop) {
		return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
	}
});

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

export async function logEvent(
	event_type: BeerLog['event_type'],
	description: string
): Promise<void> {
	await getSupabase().from('beer_log').insert({ event_type, description });
}
