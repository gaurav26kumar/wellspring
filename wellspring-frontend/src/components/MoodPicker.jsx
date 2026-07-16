import { useRef, useState, useCallback } from 'react';
import { moodColor, moodWord, MOOD_WORDS } from '../lib/moodColor';

/**
 * value: 0..1. onChange fires continuously while dragging; onCommit fires
 * once on release, snapped to the nearest of the 5 named points — mirrors
 * moodScore being an int 1-5 on the backend even though the drag itself
 * feels continuous.
 */
export function MoodPicker({ value, onChange, onCommit, locked = false }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const setFromClientX = useCallback(
    (clientX) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const v = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(v);
    },
    [onChange]
  );

  function handlePointerDown(e) {
    if (locked) return;
    setDragging(true);
    setFromClientX(e.clientX);
  }
  function handlePointerMove(e) {
    if (dragging) setFromClientX(e.clientX);
  }
  function handlePointerUp() {
    if (!dragging) return;
    setDragging(false);
    const steps = [0, 0.25, 0.5, 0.75, 1];
    const snapped = steps.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
    onChange(snapped);
    onCommit?.(snapped);
  }

  const wordIndex = Math.min(4, Math.floor(value * 5));

  return (
    <div className="flex flex-col gap-2 min-w-[240px]" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      <div className="font-label text-[10.5px] font-semibold uppercase tracking-wider text-[var(--mist)]">
        How's this sitting with you?
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label="Mood"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        className="relative h-[34px] flex items-center"
        style={{ cursor: locked ? 'default' : 'pointer' }}
        onPointerDown={handlePointerDown}
        onKeyDown={(e) => {
          if (locked) return;
          if (e.key === 'ArrowLeft') onChange(Math.max(0, value - 0.05));
          if (e.key === 'ArrowRight') onChange(Math.min(1, value + 0.05));
        }}
      >
        <div className="w-full h-[2px] rounded bg-[var(--divider)]" />
        <div
          className="absolute top-1/2 w-[18px] h-[18px] rounded-full -translate-y-1/2 -translate-x-1/2"
          style={{
            left: `${value * 100}%`,
            background: moodColor(value),
            boxShadow: locked ? 'none' : `0 0 12px 2px ${moodColor(value)}`,
            animation: locked ? 'none' : `pulseMood ${(2.6 - value).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      </div>
      <div className="flex justify-between font-label text-[10px] tracking-wide text-[var(--mist)]">
        {MOOD_WORDS.map((w, i) => (
          <span key={w} className={i === wordIndex ? 'text-[var(--paper)] font-semibold opacity-100' : 'opacity-55'}>
            {w}
          </span>
        ))}
      </div>
      <style>{`@keyframes pulseMood { 0%,100%{ filter:brightness(1);} 50%{ filter:brightness(1.25);} }`}</style>
    </div>
  );
}

export { moodWord };
