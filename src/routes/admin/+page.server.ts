import type { PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import type { User, BeerDebt } from '$lib/types';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ locals }) => {
	const db = getDb();
	const users = db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE').all() as User[];
	const debts = db.prepare('SELECT * FROM beer_debts').all() as BeerDebt[];

	return {
		isAdmin: locals.isAdmin,
		users,
		debts,
		ittyChannel: env.ITTY_CHANNEL_NAME,
		ittyJoinKey: env.ITTY_JOIN_KEY
	};
};
