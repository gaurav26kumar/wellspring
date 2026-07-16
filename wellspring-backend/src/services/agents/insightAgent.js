const JournalEntry = require('../../models/JournalEntry');
const Insight = require('../../models/Insight');
const { generate } = require('../llmProvider');

/**
 * Summarizes one user's entries over a period into a short reflection plus
 * a theme breakdown. Called by workers/taskInsights.js on a schedule —
 * never synchronously from a user-facing request.
 */
async function generateWeeklyInsight({ userId, periodStart, periodEnd }) {
  const entries = await JournalEntry.find({
    userId,
    createdAt: { $gte: periodStart, $lte: periodEnd },
  }).sort({ createdAt: 1 });

  if (entries.length < 2) return null; // not enough signal for a meaningful summary

  const combined = entries.map((e) => `- ${e.content}`).join('\n');
  const raw = await generate({
    system:
      'Summarize this week of journal entries in 2-3 warm, specific sentences — ' +
      'no generic platitudes. Then list up to 4 recurring themes as a JSON array ' +
      'on a new line prefixed with THEMES:, e.g. THEMES: ["sleep","work"]. ' +
      'Never diagnose or use clinical labels.',
    messages: [{ role: 'user', content: combined }],
    stream: false,
  });

  const [summaryText, themesLine] = raw.split(/THEMES:/i);
  let themeNames = [];
  try {
    themeNames = JSON.parse((themesLine || '[]').trim());
  } catch {
    themeNames = [];
  }
  const themes = themeNames.map((theme) => ({
    theme,
    count: entries.filter((e) => e.content.toLowerCase().includes(theme.toLowerCase())).length,
  }));

  return Insight.create({
    userId,
    periodStart,
    periodEnd,
    summaryText: summaryText.trim(),
    themes,
  });
}

module.exports = { generateWeeklyInsight };
