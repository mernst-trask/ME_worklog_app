require('dotenv').config();
const express = require('express');
const cors = require('cors');

require('./db'); // ensures tables exist before routes are hit

const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const workLogRoutes = require('./routes/worklogs');
const reportRoutes = require('./routes/reports');

const app = express();
app.use(cors()); // open by default for local dev; lock down `origin` before going to production
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/worklogs', workLogRoutes);
app.use('/api/reports', reportRoutes);

// Fallback error handler so a bug in one route doesn't crash the whole server.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Worklog API listening on http://localhost:${PORT}`);
});
