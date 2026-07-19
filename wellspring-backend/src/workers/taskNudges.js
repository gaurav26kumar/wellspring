const User = require('../models/User');
const JournalEntry = require('../models/JournalEntry');
const Nudge = require('../models/Nudge');
const Insight = require('../models/Insight');

/**
 * Simple pattern check: if a theme from the most recent Insight shows up
 * in 4+ of the last 6 entries, propose a nudge. Deliberately simple —
 * this is the kind of rule you'll want to tune with real usage data,
 * not something to over-engineer up front.
 */
async function runNudgeDetection() {
  const users = await User.find({}, '_id');

  for (const user of users) {
    try {
      const latestInsight = await Insight.findOne({ userId: user._id }).sort({ periodStart: -1 });
      if (!latestInsight || !latestInsight.themes.length) continue;

      const recentEntries = await JournalEntry.find({ userId: user._id }).sort({ createdAt: -1 }).limit(6);
      if (recentEntries.length < 6) continue;

      const topTheme = [...latestInsight.themes].sort((a, b) => b.count - a.count)[0];
      const matches = recentEntries.filter((e) => e.content.toLowerCase().includes(topTheme.theme.toLowerCase()));

      if (matches.length >= 4) {
        const alreadyExists = await Nudge.findOne({
          userId: user._id,
          triggerReason: `theme:${topTheme.theme}`,
          status: 'pending',
        });
        if (!alreadyExists) {
          await Nudge.create({
            userId: user._id,
            triggerReason: `theme:${topTheme.theme}`,
            message: `You've mentioned ${topTheme.theme} in ${matches.length} of your last 6 entries. Want next week's prompts to lean into that?`,
          });
        }
      }
    } catch (err) {
      console.error(`[taskNudges] failed for user ${user._id}`, err.message);
    }
  }
}

module.exports = { runNudgeDetection };
