import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

// createRequire keeps bundlers/test runners from trying to resolve the "node:sqlite" builtin
const req = createRequire(import.meta.url);
const { DatabaseSync: Sqlite } = req('node:sqlite') as typeof import('node:sqlite');

export type Db = DatabaseSync;

export function openDb(path = ':memory:'): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Sqlite(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  return db;
}
