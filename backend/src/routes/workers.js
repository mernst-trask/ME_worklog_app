const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate, requireManager } = require('../middleware/auth');

const router = express.Router();

// All routes here require a logged-in manager.
router.use(authenticate, requireManager);

// GET /api/workers -> list every worker, with this month's logged hours
router.get('/', (req, res) => {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const workers = db
    .prepare(`SELECT id, name, email, created_at FROM users WHERE role = 'worker' ORDER BY name`)
    .all();

  const hoursStmt = db.prepare(
    `SELECT COALESCE(SUM(hours), 0) AS total
     FROM work_logs
     WHERE user_id = ? AND work_date LIKE ?`
  );

  const withSummary = workers.map((w) => {
    const { total } = hoursStmt.get(w.id, `${monthPrefix}%`);
    return { ...w, hoursThisMonth: total };
  });

  res.json({ workers: withSummary });
});

// POST /api/workers  { name, email, password } -> creates a new worker account
router.post('/', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'A user with that email already exists' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'worker')`)
    .run(name.trim(), normalizedEmail, password_hash);

  res.status(201).json({
    worker: { id: result.lastInsertRowid, name: name.trim(), email: normalizedEmail },
  });
});
// PATCH /api/workers/:id/password  { password } -> manager resets a worker's password
router.patch('/:id/password', (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body || {};

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const worker = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'worker'`).get(id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);

  res.json({ ok: true });
});
// DELETE /api/workers/:id -> remove a worker account and their logs
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const worker = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'worker'`).get(id);
  if (!worker) return res.status(404).json({ error: 'Worker not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(id); // work_logs cascade via FK
  res.json({ ok: true });
});

module.exports = router;
