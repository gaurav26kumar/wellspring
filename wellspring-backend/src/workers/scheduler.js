const cron = require('node-cron');
const { runWeeklyInsights } = require('./taskInsights');
const { runNudgeDetection } = require('./taskNudges');

/**
 * In-process scheduler (node-cron) — fine for a single backend instance.
 * If you ever run more than one instance, swap this for Agenda (jobs
 * stored in Mongo, so only one worker picks up each run) rather than
 * letting every instance fire the same job.
 */
function startScheduler() {
  // Sundays at 03:00 — weekly insight summaries
  cron.schedule('0 3 * * 0', () => {
    runWeeklyInsights().catch((err) => console.error('[scheduler] weekly insights failed', err));
  });

  // Daily at 04:00 — nudge pattern detection, runs after insights on Sundays
  cron.schedule('0 4 * * *', () => {
    runNudgeDetection().catch((err) => console.error('[scheduler] nudge detection failed', err));
  });

  console.log('[scheduler] background jobs registered');
}

module.exports = { startScheduler };
