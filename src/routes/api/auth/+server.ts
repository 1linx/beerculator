import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkLock, recordFail, isPhase1Done, setPhase1Done, clearRecord } from '$lib/authLimiter';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();

	const lock = checkLock(ip);
	if (lock.locked) {
		return json({ locked: true, secondsRemaining: lock.secondsRemaining }, { status: 429 });
	}

	const { phase, value } = await request.json();

	if (phase === 1) {
		if (value === 'black') {
			setPhase1Done(ip);
			return json({ next: true });
		}
		const result = recordFail(ip);
		return json({ ok: false, ...result });
	}

	if (phase === 2) {
		if (!isPhase1Done(ip)) {
			return json({ ok: false, locked: false, secondsRemaining: 0 });
		}
		if (value === 'cat') {
			clearRecord(ip);
			cookies.set('site_auth', 'authenticated', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7
			});
			return json({ done: true });
		}
		const result = recordFail(ip);
		return json({ ok: false, ...result });
	}

	return json({ ok: false });
};
