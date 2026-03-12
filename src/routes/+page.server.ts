import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabase';
const ITTY_CHANNEL_NAME = process.env.ITTY_CHANNEL_NAME!;
const ITTY_JOIN_KEY = process.env.ITTY_JOIN_KEY!;

export const load: PageServerLoad = async () => {
	const [{ data: users }, { data: debts }] = await Promise.all([
		supabase.from('users').select('*').order('name'),
		supabase.from('beer_debts').select('*')
	]);

	return {
		users: users ?? [],
		debts: debts ?? [],
		ittyChannel: ITTY_CHANNEL_NAME,
		ittyJoinKey: ITTY_JOIN_KEY
	};
};
