import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import schema from './schema.sql?raw';
import type { BeerLog } from '$lib/types';

let _db: Database.Database | null = null;

/** Lazily open the SQLite database (path from DATABASE_PATH, default ./data/beerculator.db). */
export function getDb(): Database.Database {
	if (!_db) {
		const path = resolve(env.DATABASE_PATH || 'data/beerculator.db');
		mkdirSync(dirname(path), { recursive: true });
		_db = new Database(path);
		_db.pragma('journal_mode = WAL');
		_db.pragma('foreign_keys = ON');
		_db.pragma('busy_timeout = 5000');
		_db.exec(schema);
	}
	return _db;
}

export const newId = () => randomUUID();
export const now = () => new Date().toISOString();

export function logEvent(event_type: BeerLog['event_type'], description: string): void {
	getDb()
		.prepare('INSERT INTO beer_log (id, event_type, description, created_at) VALUES (?, ?, ?, ?)')
		.run(newId(), event_type, description, now());
}
