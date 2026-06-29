// Database connection + schema setup.
// Uses better-sqlite3: a single local file (worklog.db) holds all data.
// Swap this file out later if you move to Postgres/MySQL for a hosted backend.

const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'worklog.db');
const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('worker', 'manager')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- Migration: allow multiple entries per worker per day -----------------
// The original schema had UNIQUE(user_id, work_date), limiting each worker
// to one row per day. We now allow several "activities" per day (each its
// own clock-in/out or manual entry), so that constraint has to go. This
// rebuilds the table in place, keeping any existing rows.
const existing = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'work_logs'`).get();
if (existing && existing.sql.includes('UNIQUE(user_id, work_date)')) {
  db.exec(`
    ALTER TABLE work_logs RENAME TO work_logs_old_unique;

    CREATE TABLE work_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      work_date   TEXT NOT NULL,
      clock_in    TEXT,
      clock_out   TEXT,
      hours       REAL,
      notes       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO work_logs (id, user_id, work_date, clock_in, clock_out, hours, notes, created_at, updated_at)
      SELECT id, user_id, work_date, clock_in, clock_out, hours, notes, created_at, updated_at
      FROM work_logs_old_unique;

    DROP TABLE work_logs_old_unique;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS work_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date   TEXT NOT NULL,              -- 'YYYY-MM-DD' - several rows per worker per day are allowed
    clock_in    TEXT,                       -- ISO timestamp, set by "clock in"
    clock_out   TEXT,                       -- ISO timestamp, set by "clock out"
    hours       REAL,                       -- hours for THIS entry (computed or manual)
    notes       TEXT,                       -- doubles as the "activity" description
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_worklogs_user_date ON work_logs(user_id, work_date);
`);

module.exports = db;