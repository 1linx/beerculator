import type { PageServerLoad } from './$types';
import { checkLock } from '$lib/authLimiter';

export const load: PageServerLoad = async ({ getClientAddress }) => {
	const ip = getClientAddress();
	return checkLock(ip);
};
