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

  CREATE TABLE IF NOT EXISTS work_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date   TEXT NOT NULL,              -- 'YYYY-MM-DD', one row per worker per day
    clock_in    TEXT,                       -- ISO timestamp, set by "clock in"
    clock_out   TEXT,                       -- ISO timestamp, set by "clock out"
    hours       REAL,                       -- final hours for the day (computed or manual)
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, work_date)
  );

  CREATE INDEX IF NOT EXISTS idx_worklogs_user_date ON work_logs(user_id, work_date);
`);

module.exports = db;
