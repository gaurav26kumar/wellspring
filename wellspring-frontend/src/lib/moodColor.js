/**
 * Same teal->amber mapping used across every screen's mood language.
 * Uses CSS color-mix() against the live theme variables, so it stays
 * correct across the dark/light toggle without any JS-side hex math.
 */
export function moodColor(value) {
  const v = Math.max(0, Math.min(1, value));
  return `color-mix(in srgb, var(--glow-amber) ${Math.round(v * 100)}%, var(--line-teal) ${Math.round((1 - v) * 100)}%)`;
}

export const MOOD_WORDS = ['Still', 'Steady', 'Lifted', 'Bright', 'Sparkling'];

export function moodWord(value) {
  return MOOD_WORDS[Math.min(4, Math.floor(value * 5))] || MOOD_WORDS[0];
}

/**
 * The color-mix() trick above only works for DOM styling — WebGL vertex
 * colors need actual float RGB components, not a CSS string. This reads
 * the same --line-teal / --glow-amber variables and does the interpolation
 * by hand, for use in three.js scenes (see GrowthPage.jsx).
 */
function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
}

export function readMoodEndpoints() {
  const style = getComputedStyle(document.documentElement);
  return {
    from: hexToRgb01(style.getPropertyValue('--line-teal').trim()),
    to: hexToRgb01(style.getPropertyValue('--glow-amber').trim()),
  };
}

export function lerpMoodRgb(endpoints, value) {
  const v = Math.max(0, Math.min(1, value ?? 0.5));
  return [
    endpoints.from[0] + (endpoints.to[0] - endpoints.from[0]) * v,
    endpoints.from[1] + (endpoints.to[1] - endpoints.from[1]) * v,
    endpoints.from[2] + (endpoints.to[2] - endpoints.from[2]) * v,
  ];
}
