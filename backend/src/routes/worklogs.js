const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Workers can only ever see their own logs. Managers may pass ?userId=
// to look at a specific worker's logs instead of their own.
function resolveTargetUserId(req) {
  if (req.user.role === 'manager' && req.query.userId) {
    return Number(req.query.userId);
  }
  return req.user.id;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD in server-local UTC date
}

// GET /api/worklogs/today -> today's log for the current user (or ?userId= for managers)
router.get('/today', (req, res) => {
  const userId = resolveTargetUserId(req);
  const log = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ?')
    .get(userId, todayStr());
  res.json({ log: log || null });
});

// POST /api/worklogs/clock-in -> starts today's entry (only the logged-in worker, for themself)
router.post('/clock-in', (req, res) => {
  const date = todayStr();
  const now = new Date().toISOString();

  const existing = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ?')
    .get(req.user.id, date);

  if (existing && existing.clock_in && !existing.clock_out) {
    return res.status(409).json({ error: 'Already clocked in today', log: existing });
  }

  if (existing) {
    db.prepare(
      `UPDATE work_logs SET clock_in = ?, clock_out = NULL, hours = NULL, updated_at = datetime('now')
       WHERE id = ?`
    ).run(now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO work_logs (user_id, work_date, clock_in) VALUES (?, ?, ?)`
    ).run(req.user.id, date, now);
  }

  const log = db.prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ?').get(req.user.id, date);
  res.json({ log });
});

// POST /api/worklogs/clock-out -> closes today's entry and computes hours
router.post('/clock-out', (req, res) => {
  const date = todayStr();
  const existing = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ?')
    .get(req.user.id, date);

  if (!existing || !existing.clock_in) {
    return res.status(400).json({ error: 'You have not clocked in today' });
  }
  if (existing.clock_out) {
    return res.status(409).json({ error: 'Already clocked out today', log: existing });
  }

  const now = new Date();
  const hours = Math.round(((now - new Date(existing.clock_in)) / 3600000) * 100) / 100;

  db.prepare(
    `UPDATE work_logs SET clock_out = ?, hours = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(now.toISOString(), hours, existing.id);

  const log = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(existing.id);
  res.json({ log });
});

// POST /api/worklogs/manual  { date, hours, notes } -> create/overwrite a day's entry
// Useful for backfilling a missed clock-in/out, or logging hours without using the timer.
router.post('/manual', (req, res) => {
  const { date, hours, notes } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  if (hours === undefined || Number(hours) < 0 || Number(hours) > 24) {
    return res.status(400).json({ error: 'hours must be a number between 0 and 24' });
  }

  const existing = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ?')
    .get(req.user.id, date);

  if (existing) {
    db.prepare(
      `UPDATE work_logs SET hours = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(Number(hours), notes || null, existing.id);
  } else {
    db.prepare(
      `INSERT INTO work_logs (user_id, work_date, hours, notes) VALUES (?, ?, ?, ?)`
    ).run(req.user.id, date, Number(hours), notes || null);
  }

  const log = db.prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ?').get(req.user.id, date);
  res.json({ log });
});

// GET /api/worklogs?year=2026&month=6  -> every entry in that month, for the calendar view
router.get('/', (req, res) => {
  const userId = resolveTargetUserId(req);
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const logs = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date LIKE ? ORDER BY work_date')
    .all(userId, `${monthPrefix}%`);

  res.json({ logs });
});

module.exports = router;
