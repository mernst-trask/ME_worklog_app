// Run once with: npm run seed:manager
// Creates the first manager account from the SEED_MANAGER_* values in .env
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const name = process.env.SEED_MANAGER_NAME || 'Admin';
const email = (process.env.SEED_MANAGER_EMAIL || 'admin@example.com').toLowerCase().trim();
const password = process.env.SEED_MANAGER_PASSWORD || 'changeme123';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  console.log(`A user with email ${email} already exists (id ${existing.id}). Nothing to do.`);
  process.exit(0);
}

const password_hash = bcrypt.hashSync(password, 10);
const result = db
  .prepare(`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'manager')`)
  .run(name, email, password_hash);

console.log(`Manager account created: ${email} (id ${result.lastInsertRowid})`);
console.log('You can now log in with this email/password from the mobile app or admin dashboard.');
