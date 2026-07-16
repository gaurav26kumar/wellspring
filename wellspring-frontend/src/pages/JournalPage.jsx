import { useEffect, useState } from 'react';
import { api } from '../lib/apiClient';
import { MoodPicker, moodWord } from '../components/MoodPicker';
import { moodColor } from '../lib/moodColor';

function scoreToValue(score) {
  // moodScore is 1-5 on the backend; the picker works in 0..1
  return score ? (score - 1) / 4 : 0.5;
}
function valueToScore(value) {
  return Math.max(1, Math.min(5, Math.round(value * 4) + 1));
}

export function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [content, setContent] = useState('');
  const [mood, setMood] = useState(0.5);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null); // an entry object, or null for "today"

  useEffect(() => {
    api
      .getJournal()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const entry = await api.postJournal(content.trim(), valueToScore(mood));
      setEntries((prev) => [entry, ...prev]);
      setContent('');
      setMood(0.5);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const showingEntry = viewing || (content || mood !== 0.5 ? null : null);
  const displayMoodValue = viewing ? scoreToValue(viewing.moodScore) : mood;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-7 pt-4">
      <aside className="flex flex-col gap-2">
        <div className="font-label text-[11px] font-semibold uppercase tracking-wide text-[var(--mist)] mb-1">
          Entries
        </div>
        <button
          onClick={() => setViewing(null)}
          className="w-full text-left font-label text-xs font-semibold bg-[var(--glow-amber)] text-[var(--bg)] rounded-xl px-4 py-3 mb-1"
        >
          ＋ New entry
        </button>

        {loading && <div className="text-sm text-[var(--mist)] px-1">Loading…</div>}
        {!loading && entries.length === 0 && (
          <div className="text-sm text-[var(--mist)] px-1">Nothing yet — your first entry will show up here.</div>
        )}

        {entries.map((e) => (
          <button
            key={e._id}
            onClick={() => setViewing(e)}
            className="text-left w-full rounded-xl px-3.5 py-3 flex gap-2.5 items-start transition-colors"
            style={{
              background: viewing?._id === e._id ? 'var(--surface-active)' : 'var(--surface)',
              border: `1px solid ${viewing?._id === e._id ? 'var(--panel-border-hover)' : 'transparent'}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
              style={{ background: moodColor(scoreToValue(e.moodScore)), boxShadow: `0 0 8px 1px ${moodColor(scoreToValue(e.moodScore))}` }}
            />
            <span>
              <div className="font-label text-[10.5px] font-semibold uppercase tracking-wider text-[var(--mist)] mb-0.5">
                {new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
              <div className="text-[13px] leading-snug text-[var(--mist)] line-clamp-2">{e.content}</div>
            </span>
          </button>
        ))}
      </aside>

      <section className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-[20px] px-10 py-9 flex flex-col min-h-[520px]">
        {viewing && (
          <div className="flex items-center justify-between gap-3 bg-[var(--surface-active)] rounded-lg px-4 py-2.5 mb-6 text-[12.5px] text-[var(--mist)]">
            <span>Viewing a past entry — entries can't be edited once saved.</span>
            <button
              onClick={() => setViewing(null)}
              className="font-label text-[11px] font-semibold uppercase tracking-wider border border-[var(--panel-border)] rounded-full px-3 py-1.5 text-[var(--paper)]"
            >
              Back to today
            </button>
          </div>
        )}

        <div className="font-label text-[11px] font-semibold uppercase tracking-wide text-[var(--line-teal)] mb-3">
          {viewing ? new Date(viewing.createdAt).toLocaleDateString() : 'Today'}
        </div>

        {viewing ? (
          <p className="flex-1 text-[16px] leading-[1.75] text-[var(--mist)] whitespace-pre-wrap mb-6">{viewing.content}</p>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start wherever feels easiest — there's no wrong way in."
            className="flex-1 min-h-[200px] bg-transparent outline-none resize-none text-[16px] leading-[1.75] text-[var(--paper)] placeholder:text-[var(--mist)] mb-6"
          />
        )}

        <div className="flex items-center justify-between flex-wrap gap-5 pt-5 border-t border-[var(--divider)]">
          <MoodPicker value={displayMoodValue} onChange={setMood} locked={!!viewing} />

          {!viewing && (
            <div className="flex flex-col items-end gap-2.5">
              {error && <div className="font-label text-[11px] text-[var(--glow-amber)]">{error}</div>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="font-label text-xs font-semibold uppercase tracking-wider bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-6 py-3.5 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save entry'}
              </button>
            </div>
          )}
        </div>

        <div className="text-[11.5px] text-[var(--mist)] mt-4 opacity-85">
          Private by default. Entries are only ever reviewed by the safety layer, automatically, never browsed.
        </div>
      </section>
    </div>
  );
}
