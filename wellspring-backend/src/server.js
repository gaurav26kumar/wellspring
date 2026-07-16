require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');
const { startScheduler } = require('./workers/scheduler');

const authRoutes = require('./api/v1/auth.routes');
const journalRoutes = require('./api/v1/journal.routes');
const chatRoutes = require('./api/v1/chat.routes');
const insightsRoutes = require('./api/v1/insights.routes');
const nudgesRoutes = require('./api/v1/nudges.routes');

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/journal', journalRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/nudges', nudgesRoutes);

// Deliberately no /api/v1/safety-flags route — that collection is not
// exposed through general CRUD. Build a separate, narrowly-authed admin
// surface for it if/when you need one. See models/SafetyFlag.js.

app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  if (res.headersSent) return next(err); // e.g. mid-SSE-stream — can't send a fresh response, just close
  res.status(500).json({ error: 'Internal server error' });
});

// Safety net: nothing previously caught unhandled promise rejections
// process-wide. A rejection outside a request (a fire-and-forget call
// missing its own .catch, a background worker tick) would otherwise be
// silently swallowed, or on some Node versions crash the whole process —
// taking every route, including chat, down with it. Log loudly instead.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  startScheduler();
  app.listen(PORT, () => console.log(`[server] listening on :${PORT}`));
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
