const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const DAILY_HOUR_CAP = 10;

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

// Sum of hours already logged for a user on a given date, optionally
// excluding one entry (used when editing that same entry).
function hoursLoggedOnDate(userId, date, excludeId = null) {
  const row = excludeId
    ? db
        .prepare(
          `SELECT COALESCE(SUM(hours), 0) AS total FROM work_logs
           WHERE user_id = ? AND work_date = ? AND id != ?`
        )
        .get(userId, date, excludeId)
    : db
        .prepare(`SELECT COALESCE(SUM(hours), 0) AS total FROM work_logs WHERE user_id = ? AND work_date = ?`)
        .get(userId, date);
  return row.total;
}

// GET /api/worklogs/today -> every entry logged today, plus any open clock-in session
router.get('/today', (req, res) => {
  const userId = resolveTargetUserId(req);
  const date = todayStr();

  const entries = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date = ? ORDER BY created_at')
    .all(userId, date);

  const activeEntry = entries.find((e) => e.clock_in && !e.clock_out) || null;
  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  res.json({ entries, activeEntry, totalHours, dailyCap: DAILY_HOUR_CAP });
});

// POST /api/worklogs/clock-in -> starts a new entry for today (only for yourself)
router.post('/clock-in', (req, res) => {
  const date = todayStr();
  const now = new Date().toISOString();

  const alreadyOpen = db
    .prepare(`SELECT * FROM work_logs WHERE user_id = ? AND clock_in IS NOT NULL AND clock_out IS NULL`)
    .get(req.user.id);

  if (alreadyOpen) {
    return res.status(409).json({ error: 'Already clocked in', entry: alreadyOpen });
  }

  const result = db
    .prepare(`INSERT INTO work_logs (user_id, work_date, clock_in) VALUES (?, ?, ?)`)
    .run(req.user.id, date, now);

  const entry = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ entry });
});

// POST /api/worklogs/clock-out -> closes the open entry, capped at the daily limit
router.post('/clock-out', (req, res) => {
  const open = db
    .prepare(`SELECT * FROM work_logs WHERE user_id = ? AND clock_in IS NOT NULL AND clock_out IS NULL`)
    .get(req.user.id);

  if (!open) {
    return res.status(400).json({ error: 'You are not clocked in' });
  }

  const now = new Date();
  const rawHours = Math.round(((now - new Date(open.clock_in)) / 3600000) * 100) / 100;

  const alreadyToday = hoursLoggedOnDate(req.user.id, open.work_date, open.id);
  const remaining = Math.max(0, DAILY_HOUR_CAP - alreadyToday);
  const finalHours = Math.min(rawHours, remaining);
  const capped = finalHours < rawHours;

  db.prepare(`UPDATE work_logs SET clock_out = ?, hours = ?, updated_at = datetime('now') WHERE id = ?`).run(
    now.toISOString(),
    finalHours,
    open.id
  );

  const entry = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(open.id);
  res.json({ entry, capped, rawHours });
});

// POST /api/worklogs/manual  { date, hours, notes } -> adds a NEW activity entry for that day
router.post('/manual', (req, res) => {
  const { date, hours, notes } = req.body || {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });
  }
  const numHours = Number(hours);
  if (hours === undefined || Number.isNaN(numHours) || numHours <= 0 || numHours > 24) {
    return res.status(400).json({ error: 'hours must be a number between 0 and 24' });
  }

  const alreadyToday = hoursLoggedOnDate(req.user.id, date);
  if (alreadyToday + numHours > DAILY_HOUR_CAP) {
    const remaining = Math.max(0, DAILY_HOUR_CAP - alreadyToday);
    return res.status(400).json({
      error: `That would bring ${date} to ${(alreadyToday + numHours).toFixed(2)}h, over the ${DAILY_HOUR_CAP}h daily limit. ${remaining.toFixed(2)}h remaining today.`,
    });
  }

  const result = db
    .prepare(`INSERT INTO work_logs (user_id, work_date, hours, notes) VALUES (?, ?, ?, ?)`)
    .run(req.user.id, date, numHours, notes || null);

  const entry = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ entry });
});

// PATCH /api/worklogs/entry/:id  { hours, notes } -> edit one of your own entries
router.patch('/entry/:id', (req, res) => {
  const id = Number(req.params.id);
  const entry = db.prepare('SELECT * FROM work_logs WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  const { hours, notes } = req.body || {};
  const numHours = Number(hours);
  if (hours === undefined || Number.isNaN(numHours) || numHours <= 0 || numHours > 24) {
    return res.status(400).json({ error: 'hours must be a number between 0 and 24' });
  }

  const alreadyToday = hoursLoggedOnDate(req.user.id, entry.work_date, id);
  if (alreadyToday + numHours > DAILY_HOUR_CAP) {
    const remaining = Math.max(0, DAILY_HOUR_CAP - alreadyToday);
    return res.status(400).json({
      error: `That would bring ${entry.work_date} to ${(alreadyToday + numHours).toFixed(2)}h, over the ${DAILY_HOUR_CAP}h daily limit. ${remaining.toFixed(2)}h remaining (excluding this entry).`,
    });
  }

  db.prepare(`UPDATE work_logs SET hours = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`).run(
    numHours,
    notes || null,
    id
  );

  const updated = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(id);
  res.json({ entry: updated });
});

// DELETE /api/worklogs/entry/:id -> remove one of your own entries
router.delete('/entry/:id', (req, res) => {
  const id = Number(req.params.id);
  const entry = db.prepare('SELECT * FROM work_logs WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });

  db.prepare('DELETE FROM work_logs WHERE id = ?').run(id);
  res.json({ ok: true });
});

// GET /api/worklogs?year=2026&month=6  -> every entry in that month, for the calendar view
router.get('/', (req, res) => {
  const userId = resolveTargetUserId(req);
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;

  const logs = db
    .prepare('SELECT * FROM work_logs WHERE user_id = ? AND work_date LIKE ? ORDER BY work_date, created_at')
    .all(userId, `${monthPrefix}%`);

  res.json({ logs, dailyCap: DAILY_HOUR_CAP });
});

module.exports = router;