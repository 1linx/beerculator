const LOCK_DURATION_MS = 10 * 60 * 1000;
const MAX_FAILS = 3;

type IpRecord = {
	fails: number;
	lockedUntil: number;
	phase1Done: boolean;
};

const records = new Map<string, IpRecord>();

function get(ip: string): IpRecord {
	if (!records.has(ip)) {
		records.set(ip, { fails: 0, lockedUntil: 0, phase1Done: false });
	}
	return records.get(ip)!;
}

export function checkLock(ip: string): { locked: boolean; secondsRemaining: number } {
	const r = get(ip);
	if (r.lockedUntil > Date.now()) {
		return { locked: true, secondsRemaining: Math.ceil((r.lockedUntil - Date.now()) / 1000) };
	}
	return { locked: false, secondsRemaining: 0 };
}

export function recordFail(ip: string): { locked: boolean; secondsRemaining: number } {
	const r = get(ip);
	// Reset expired lock
	if (r.lockedUntil > 0 && r.lockedUntil <= Date.now()) {
		r.fails = 0;
		r.lockedUntil = 0;
	}
	r.fails += 1;
	if (r.fails >= MAX_FAILS) {
		r.lockedUntil = Date.now() + LOCK_DURATION_MS;
		return { locked: true, secondsRemaining: Math.ceil(LOCK_DURATION_MS / 1000) };
	}
	return { locked: false, secondsRemaining: 0 };
}

export function isPhase1Done(ip: string): boolean {
	return get(ip).phase1Done;
}

export function setPhase1Done(ip: string): void {
	get(ip).phase1Done = true;
}

export function clearRecord(ip: string): void {
	records.delete(ip);
}
