const express = require('express');
const db = require('../db');
const { authenticate, requireManager } = require('../middleware/auth');
const { toCsv } = require('../utils/csv');

const router = express.Router();
router.use(authenticate);

function defaultRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = new Date().toISOString().slice(0, 10);
  return { from, to };
}

// GET /api/reports?userId=&from=&to=&format=json|csv
// - Worker: always reports on themselves.
// - Manager: omit userId for a report across ALL workers; pass userId for one worker.
router.get('/', (req, res) => {
  const { from, to } = { ...defaultRange(), ...req.query };
  const format = req.query.format === 'csv' ? 'csv' : 'json';

  let rows;
  if (req.user.role === 'manager' && !req.query.userId) {
    // All workers, grouped.
    rows = db
      .prepare(
        `SELECT u.id AS user_id, u.name, u.email,
                COALESCE(SUM(w.hours), 0) AS total_hours,
                COUNT(w.id) AS days_logged
         FROM users u
         LEFT JOIN work_logs w
           ON w.user_id = u.id AND w.work_date BETWEEN ? AND ?
         WHERE u.role = 'worker'
         GROUP BY u.id
         ORDER BY u.name`
      )
      .all(from, to);
  } else {
    const userId =
      req.user.role === 'manager' ? Number(req.query.userId) : req.user.id;

    if (req.user.role !== 'manager' && req.query.userId && Number(req.query.userId) !== req.user.id) {
      return res.status(403).json({ error: 'Workers can only view their own report' });
    }

    rows = db
      .prepare(
        `SELECT work_date, clock_in, clock_out, hours, notes
         FROM work_logs
         WHERE user_id = ? AND work_date BETWEEN ? AND ?
         ORDER BY work_date`
      )
      .all(userId, from, to);
  }

  if (format === 'csv') {
    const columns =
      req.user.role === 'manager' && !req.query.userId
        ? [
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            { key: 'total_hours', label: 'Total Hours' },
            { key: 'days_logged', label: 'Days Logged' },
          ]
        : [
            { key: 'work_date', label: 'Date' },
            { key: 'clock_in', label: 'Clock In' },
            { key: 'clock_out', label: 'Clock Out' },
            { key: 'hours', label: 'Hours' },
            { key: 'notes', label: 'Notes' },
          ];

    const csv = toCsv(rows, columns);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="report_${from}_to_${to}.csv"`);
    return res.send(csv);
  }

  res.json({ from, to, rows });
});

module.exports = router;
