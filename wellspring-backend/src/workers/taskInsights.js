const User = require('../models/User');
const { generateWeeklyInsight } = require('../services/agents/insightAgent');

async function runWeeklyInsights() {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const users = await User.find({}, '_id');
  console.log(`[taskInsights] generating weekly insights for ${users.length} users`);

  for (const user of users) {
    try {
      await generateWeeklyInsight({ userId: user._id, periodStart, periodEnd });
    } catch (err) {
      console.error(`[taskInsights] failed for user ${user._id}`, err.message);
    }
  }
}

module.exports = { runWeeklyInsights };
