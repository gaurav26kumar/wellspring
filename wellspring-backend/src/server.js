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
  res.status(500).json({ error: 'Internal server error' });
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
