#!/usr/bin/env node
/**
 * One-off import of a Supabase CSV export into the SQLite database.
 *
 * Usage:
 *   node scripts/import-csv.js <export-dir> [--force]
 *
 * <export-dir> must contain users_rows.csv, beer_debts_rows.csv and beer_log_rows.csv.
 * The DB path comes from DATABASE_PATH (default: data/beerculator.db).
 * Refuses to run against a DB that already has data unless --force is given,
 * in which case existing rows are wiped first.
 */
import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const force = args.includes('--force');
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
	console.error('Usage: node scripts/import-csv.js <export-dir> [--force]');
	process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(process.env.DATABASE_PATH || 'data/beerculator.db');
const schema = readFileSync(join(root, 'src/lib/server/schema.sql'), 'utf8');

/** Minimal RFC 4180 CSV parser → array of objects keyed by header row. */
function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (quoted) {
			if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
			else if (ch === '"') quoted = false;
			else field += ch;
		} else if (ch === '"') quoted = true;
		else if (ch === ',') row.push(field), (field = '');
		else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && text[i + 1] === '\n') i++;
			row.push(field), rows.push(row), (row = []), (field = '');
		} else field += ch;
	}
	if (field || row.length) row.push(field), rows.push(row);
	const [header, ...data] = rows.filter((r) => r.length > 1 || r[0]);
	return data.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const read = (name) => parseCsv(readFileSync(join(dir, name), 'utf8'));

/** Postgres "2026-11-04 13:06:32.751812+00" → ISO "2026-11-04T13:06:32.751Z" */
function iso(ts) {
	const d = new Date(ts.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
	if (isNaN(d.getTime())) throw new Error(`Bad timestamp: ${ts}`);
	return d.toISOString();
}

const users = read('users_rows.csv');
const debts = read('beer_debts_rows.csv');
const logs = read('beer_log_rows.csv');

mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(schema);

const existing =
	db.prepare('SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM beer_log) AS n').get().n;
if (existing > 0 && !force) {
	console.error(`${dbPath} already contains data. Re-run with --force to wipe and re-import.`);
	process.exit(1);
}

db.transaction(() => {
	db.exec('DELETE FROM beer_debts; DELETE FROM beer_log; DELETE FROM users;');

	const insUser = db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)');
	for (const u of users) insUser.run(u.id, u.name, iso(u.created_at));

	const insDebt = db.prepare(
		'INSERT INTO beer_debts (id, debtor_id, creditor_id, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
	);
	for (const d of debts) {
		insDebt.run(d.id, d.debtor_id, d.creditor_id, Number(d.amount), iso(d.created_at), iso(d.updated_at));
	}

	const insLog = db.prepare(
		'INSERT INTO beer_log (id, event_type, description, created_at) VALUES (?, ?, ?, ?)'
	);
	for (const l of logs) insLog.run(l.id, l.event_type, l.description, iso(l.created_at));
})();

const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Imported into ${dbPath}:`);
console.log(`  users:      ${count('users')}`);
console.log(`  beer_debts: ${count('beer_debts')}`);
console.log(`  beer_log:   ${count('beer_log')}`);
db.close();
