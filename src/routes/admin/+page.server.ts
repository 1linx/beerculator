import type { PageServerLoad } from './$types';
import { supabase } from '$lib/supabase';
import { ITTY_CHANNEL_NAME, ITTY_JOIN_KEY } from '$env/static/private';

export const load: PageServerLoad = async ({ locals }) => {
	const [{ data: users }, { data: debts }] = await Promise.all([
		supabase.from('users').select('*').order('name'),
		supabase.from('beer_debts').select('*')
	]);

	return {
		isAdmin: locals.isAdmin,
		users: users ?? [],
		debts: debts ?? [],
		ittyChannel: ITTY_CHANNEL_NAME,
		ittyJoinKey: ITTY_JOIN_KEY
	};
};
