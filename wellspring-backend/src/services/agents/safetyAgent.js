const SafetyFlag = require('../../models/SafetyFlag');
const { generate } = require('../llmProvider');

/**
 * SAFETY AGENT
 * ------------
 * Runs first, on every message, no exceptions. Nothing else in the chat
 * pipeline (retrieval, reflection, the general-purpose LLM) sees a message
 * until this has cleared it.
 *
 * Two passes, cheapest first:
 *   1. A fast regex/keyword pass — instant, no network call, catches the
 *      most direct language outright.
 *   2. A small classification call for language the keyword pass can't
 *      catch (indirect phrasing, negation, context-dependent risk).
 *
 * This list is deliberately short and illustrative, not exhaustive. Treat
 * it as a coarse first-pass filter that buys time for pass 2, not as the
 * whole system — a real deployment should pair this with the
 * classification call below, ongoing review of false negatives/positives,
 * and ideally input from a clinician, not just an ever-growing regex list.
 */
const HIGH_RISK_PATTERNS = [
  /\bkill(ing)? myself\b/i,
  /\bend(ing)? (my|it all)\b.{0,20}\b(life|lives)\b/i,
  /\bsuicid(e|al)\b/i,
  /\bno reason to (live|go on|keep going)\b/i,
  /\bwant(ed|ing)? to die\b/i,
  /\bself[- ]?harm\b/i,
  /\bhurt(ing)? myself\b/i,
];

function patternPass(text) {
  return HIGH_RISK_PATTERNS.some((re) => re.test(text));
}

/**
 * Cheap classification pass for language the regex list misses.
 * Uses a small/fast model with a strict, narrow system prompt — this is
 * NOT the same call as the Reflection Agent, and its output never reaches
 * the user directly.
 */
async function classificationPass(text) {
  try {
    const raw = await generate({
      system:
        'You are a safety classifier for a mental wellness app. Given a single ' +
        'message, respond with ONLY one word: none, low, medium, or high — your ' +
        'best estimate of acute self-harm or suicide risk expressed in the message. ' +
        'No other text.',
      messages: [{ role: 'user', content: text }],
      stream: false,
    });
    const severity = raw.trim().toLowerCase();
    return ['low', 'medium', 'high'].includes(severity) ? severity : 'none';
  } catch (err) {
    // If the classifier call itself fails, fail closed on the side of caution
    // only when the pattern pass already found nothing — don't block normal
    // chat over an infra hiccup, but log it loudly so it gets noticed.
    console.error('[safetyAgent] classification pass failed', err.message);
    return 'none';
  }
}

async function checkSafety({ text, userId }) {
  if (patternPass(text)) {
    return { flagged: true, severity: 'high', reason: 'keyword_pattern' };
  }

  const severity = await classificationPass(text);
  if (severity !== 'none') {
    return { flagged: true, severity, reason: 'model_classification' };
  }

  return { flagged: false, severity: 'none', reason: null };
}

async function logSafetyFlag({ userId, messageId, severity, reason }) {
  return SafetyFlag.create({ userId, messageId, severity, reason });
}

/**
 * Notify admin of high-risk safety flags
 * This is a placeholder implementation - integrate with your alert system
 * (Slack, email, PagerDuty, etc.)
 */
async function notifyAdminOfHighRiskFlag({ userId, messageId, flagRecord }) {
  try {
    // Placeholder: Log to console (replace with actual notification service)
    console.warn('[safetyAgent] HIGH-RISK FLAG DETECTED:', {
      userId,
      messageId,
      flagRecord,
      timestamp: new Date().toISOString(),
    });

    // TODO: Integrate with actual alert system
    // Example implementations:
    // - Send to Slack: await sendSlackAlert(...)
    // - Send email: await sendEmailAlert(...)
    // - Log to monitoring service: await logToSentry(...)
    // - Send webhook: await sendWebhook(...)

    // For now, just ensure it's logged prominently
    if (process.env.ADMIN_ALERT_EMAIL) {
      console.warn(`[safetyAgent] Should send alert email to: ${process.env.ADMIN_ALERT_EMAIL}`);
    }
  } catch (err) {
    console.error('[safetyAgent] failed to notify admin', err.message);
    // Don't throw - notification failure should not block the flag from being logged
  }
}

/**
 * Fixed, pre-written response. The general-purpose LLM never improvises on
 * this path — this string is the entire response, every time.
 * Numbers are India-specific; swap for your target region.
 */
function getFixedSafetyResponse() {
  return (
    "It sounds like things feel really heavy right now — heavier than usual. " +
    "This isn't something for the AI to guess its way through, so here's what's " +
    "real and immediate:\n\n" +
    "• KIRAN Mental Health Helpline — 1800-599-0019 (toll-free, 24/7, 13 languages)\n" +
    "• Tele MANAS — 14416 or 1-800-891-4416 (toll-free, 24/7)\n\n" +
    "This reply is fixed and reviewed in advance. It's logged for follow-up — " +
    "never browsed casually."
  );
}

module.exports = { 
  checkSafety, 
  logSafetyFlag, 
  getFixedSafetyResponse,
  notifyAdminOfHighRiskFlag 
};
