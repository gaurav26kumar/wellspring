import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { api } from '../lib/apiClient';
import { useTheme } from '../context/ThemeContext';
import { moodColor, moodWord, readMoodEndpoints, lerpMoodRgb } from '../lib/moodColor';

const GOLDEN_ANGLE = 2.399963;

function scoreToValue(score) {
  return score ? (score - 1) / 4 : 0.5;
}

/**
 * Tags each entry with themes by simple substring match against the theme
 * vocabulary already computed server-side (Insight.themes). This is the
 * same heuristic workers/taskNudges.js uses ("content includes theme name"),
 * kept consistent rather than inventing a separate client-side scheme —
 * there's no per-entry theme field on JournalEntry, so this is a reasonable
 * stand-in until/unless the model grows one.
 */
function tagThemes(entries, insights) {
  const vocab = Array.from(new Set(insights.flatMap((i) => i.themes.map((t) => t.theme))));
  return entries
    .slice()
    .reverse() // oldest first — the spiral should grow forward through time
    .map((e) => ({
      ...e,
      themes: vocab.filter((t) => e.content.toLowerCase().includes(t.toLowerCase())),
    }));
}

function makeGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export function GrowthPage() {
  const wrapRef = useRef(null);
  const selectedRef = useRef(-1); // mirrors `selected` for use inside the render loop closure
  const { theme } = useTheme();

  const [entries, setEntries] = useState([]);
  const [insights, setInsights] = useState([]);
  const [nudges, setNudges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([api.getJournal(), api.getInsights(), api.getNudges()])
      .then(([e, i, n]) => {
        setEntries(e);
        setInsights(i);
        setNudges(n);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const taggedEntries = tagThemes(entries, insights);
  const N = taggedEntries.length;

  async function respondNudge(id, status) {
    try {
      await api.updateNudge(id, status);
      setNudges((prev) => prev.map((n) => (n._id === id ? { ...n, status } : n)));
    } catch (e) {
      setError(e.message);
    }
  }

  // ---- three.js lifecycle — rebuilds fully on theme change rather than
  // patching materials live in place. For this node count (dozens, not
  // thousands) a full re-init is cheap and much simpler to reason about
  // than tracking every material that needs a blending-mode swap. ----
  useEffect(() => {
    if (loading || !wrapRef.current || N < 2) return;
    const wrap = wrapRef.current;

    const positions = taggedEntries.map((_, i) => {
      const r = 0.26 * Math.sqrt(i + 1);
      const a = i * GOLDEN_ANGLE;
      return new THREE.Vector3(r * Math.cos(a), -1.7 + (i / (N - 1)) * 3.4, r * Math.sin(a));
    });

    const threadPairs = [];
    for (let i = 0; i < N - 1; i++) threadPairs.push([i, i + 1]);

    const echoPairs = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (j - i < 2 || j - i > 9) continue;
        if (taggedEntries[i].themes.some((t) => taggedEntries[j].themes.includes(t))) echoPairs.push([i, j]);
      }
    }

    const isLight = theme === 'light';
    const blending = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;
    const endpoints = readMoodEndpoints();
    const colorFor = (mood) => lerpMoodRgb(endpoints, mood);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.display = 'block';
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.2, 6.4);

    const glowTex = makeGlowTexture();
    const group = new THREE.Group();
    scene.add(group);

    const nodePos = new Float32Array(N * 3);
    const nodeCol = new Float32Array(N * 3);
    positions.forEach((p, i) => {
      nodePos[i * 3] = p.x;
      nodePos[i * 3 + 1] = p.y;
      nodePos[i * 3 + 2] = p.z;
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeCol, 3));
    const nodeMat = new THREE.PointsMaterial({ size: 0.15, map: glowTex, transparent: true, depthWrite: false, vertexColors: true, blending });
    group.add(new THREE.Points(nodeGeo, nodeMat));

    const threadPos = new Float32Array(threadPairs.length * 2 * 3);
    threadPairs.forEach(([i, j], k) => {
      threadPos[k * 6] = positions[i].x; threadPos[k * 6 + 1] = positions[i].y; threadPos[k * 6 + 2] = positions[i].z;
      threadPos[k * 6 + 3] = positions[j].x; threadPos[k * 6 + 4] = positions[j].y; threadPos[k * 6 + 5] = positions[j].z;
    });
    const threadGeo = new THREE.BufferGeometry();
    threadGeo.setAttribute('position', new THREE.BufferAttribute(threadPos, 3));
    const threadMat = new THREE.LineBasicMaterial({ color: 0x8a96a3, transparent: true, opacity: 0.28 });
    group.add(new THREE.LineSegments(threadGeo, threadMat));

    const echoPos = new Float32Array(echoPairs.length * 2 * 3);
    const echoCol = new Float32Array(echoPairs.length * 2 * 3);
    echoPairs.forEach(([i, j], k) => {
      echoPos[k * 6] = positions[i].x; echoPos[k * 6 + 1] = positions[i].y; echoPos[k * 6 + 2] = positions[i].z;
      echoPos[k * 6 + 3] = positions[j].x; echoPos[k * 6 + 4] = positions[j].y; echoPos[k * 6 + 5] = positions[j].z;
    });
    const echoGeo = new THREE.BufferGeometry();
    echoGeo.setAttribute('position', new THREE.BufferAttribute(echoPos, 3));
    echoGeo.setAttribute('color', new THREE.BufferAttribute(echoCol, 3));
    const echoMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending });
    group.add(new THREE.LineSegments(echoGeo, echoMat));
    const echoPhase = echoPairs.map(() => Math.random() * Math.PI * 2);

    const selMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    const selSprite = new THREE.Sprite(selMat);
    selSprite.scale.set(0.55, 0.55, 0.55);
    group.add(selSprite);

    function refreshColors(now) {
      const sel = selectedRef.current;
      for (let i = 0; i < N; i++) {
        const c = colorFor(scoreToValue(taggedEntries[i].moodScore));
        const dim = sel >= 0 ? (i === sel ? 1 : 0.22) : 1;
        nodeCol[i * 3] = c[0] * dim; nodeCol[i * 3 + 1] = c[1] * dim; nodeCol[i * 3 + 2] = c[2] * dim;
      }
      nodeGeo.attributes.color.needsUpdate = true;

      echoPairs.forEach(([i, j], e) => {
        const involved = sel >= 0 && (i === sel || j === sel);
        const dim = sel < 0 ? 0.4 : involved ? 1 : 0.05;
        const flick = 0.55 + 0.45 * Math.abs(Math.sin(now * 0.0018 + echoPhase[e]));
        const ci = colorFor(scoreToValue(taggedEntries[i].moodScore));
        const cj = colorFor(scoreToValue(taggedEntries[j].moodScore));
        const inten = flick * dim;
        echoCol[e * 6] = ci[0] * inten; echoCol[e * 6 + 1] = ci[1] * inten; echoCol[e * 6 + 2] = ci[2] * inten;
        echoCol[e * 6 + 3] = cj[0] * inten; echoCol[e * 6 + 4] = cj[1] * inten; echoCol[e * 6 + 5] = cj[2] * inten;
      });
      echoGeo.attributes.color.needsUpdate = true;
    }

    function project(v) {
      const p = v.clone().applyMatrix4(group.matrixWorld).project(camera);
      return { x: ((p.x + 1) / 2) * wrap.clientWidth, y: ((1 - p.y) / 2) * wrap.clientHeight };
    }
    function nearestNode(mx, my) {
      let best = -1, bestD = 26 * 26;
      for (let i = 0; i < N; i++) {
        const s = project(positions[i]);
        const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    }
    function handleMove(e) {
      const rect = wrap.getBoundingClientRect();
      wrap.style.cursor = nearestNode(e.clientX - rect.left, e.clientY - rect.top) >= 0 ? 'pointer' : 'default';
    }
    function handleClick(e) {
      const rect = wrap.getBoundingClientRect();
      const n = nearestNode(e.clientX - rect.left, e.clientY - rect.top);
      const next = n === selectedRef.current ? -1 : n;
      selectedRef.current = next;
      setSelected(next >= 0 ? taggedEntries[next] : null);
    }
    renderer.domElement.addEventListener('mousemove', handleMove);
    renderer.domElement.addEventListener('click', handleClick);

    function sizeRenderer() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setClearColor(isLight ? 0xffffff : 0x111820, 1);
    }
    window.addEventListener('resize', sizeRenderer);
    sizeRenderer();

    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      group.rotation.y += 0.0011;
      const breathe = 1 + Math.sin(now * 0.0009) * 0.02;
      group.scale.set(breathe, breathe, breathe);
      refreshColors(now);

      const sel = selectedRef.current;
      if (sel >= 0) {
        selSprite.position.copy(positions[sel]);
        const pulse = 1 + Math.sin(now * 0.004) * 0.2;
        selSprite.scale.set(0.55 * pulse, 0.55 * pulse, 0.55 * pulse);
        selMat.color.setRGB(...colorFor(scoreToValue(taggedEntries[sel].moodScore)));
        selMat.opacity = 0.8;
      } else {
        selMat.opacity = 0;
      }
      camera.position.x = Math.sin(now * 0.00012) * 0.5;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', sizeRenderer);
      renderer.domElement.removeEventListener('mousemove', handleMove);
      renderer.domElement.removeEventListener('click', handleClick);
      nodeGeo.dispose(); nodeMat.dispose();
      threadGeo.dispose(); threadMat.dispose();
      echoGeo.dispose(); echoMat.dispose();
      glowTex.dispose();
      renderer.dispose();
      if (wrap.contains(renderer.domElement)) wrap.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, N, theme]);

  return (
    <div className="pt-4">
      <div className="font-label text-[11px] font-semibold uppercase tracking-wide text-[var(--line-teal)] mb-2">Growth</div>
      <p className="font-display italic text-[1.7rem] mb-6 max-w-2xl">
        Every entry is a node. This is what a season of noticing looks like.
      </p>

      {loading && <div className="text-[var(--mist)] text-sm">Loading…</div>}
      {error && <div className="text-[var(--glow-amber)] text-sm mb-4">{error}</div>}
      {!loading && N < 2 && (
        <div className="text-[var(--mist)] text-sm">Not enough entries yet to build a graph — write a few more and check back.</div>
      )}

      {!loading && N >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-[20px] overflow-hidden">
            <div className="px-6 pt-4 font-label text-[11px] text-[var(--mist)]">Hover a node to preview it, click to keep it selected</div>
            <div ref={wrapRef} className="w-full h-[520px]" />
            <div className="flex items-center gap-3 px-6 py-5">
              <span className="font-label text-[10.5px] text-[var(--mist)]">Still</span>
              <div className="flex-1 h-1.5 rounded" style={{ background: 'linear-gradient(90deg, var(--line-teal), var(--glow-amber))' }} />
              <span className="font-label text-[10.5px] text-[var(--mist)]">Sparkling</span>
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-2xl px-5 py-5">
              <div className="font-label text-[10.5px] font-semibold uppercase tracking-wide text-[var(--mist)] mb-2.5">
                This week's pattern
              </div>
              {insights[0] ? (
                <>
                  <p className="font-display italic text-[1.05rem] leading-snug mb-3.5">{insights[0].summaryText}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {insights[0].themes.map((t) => (
                      <span key={t.theme} className="font-label text-[10.5px] font-semibold bg-[var(--chip-bg)] text-[var(--mist)] px-2.5 py-1.5 rounded-full">
                        #{t.theme} · {t.count}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--mist)]">
                  No weekly summary yet — the first one appears after the Sunday worker run (see workers/taskInsights.js).
                </p>
              )}
            </div>

            {nudges.filter((n) => n.status === 'pending').map((n) => (
              <div key={n._id} className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-2xl px-5 py-5">
                <div className="font-label text-[10.5px] font-semibold uppercase tracking-wide text-[var(--mist)] mb-2.5">
                  Proactive check-in
                </div>
                <p className="text-sm leading-relaxed mb-3.5">{n.message}</p>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => respondNudge(n._id, 'sent')}
                    className="font-label text-[11px] font-semibold uppercase bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-4 py-2"
                  >
                    Add to prompts
                  </button>
                  <button
                    onClick={() => respondNudge(n._id, 'dismissed')}
                    className="font-label text-[11px] font-semibold uppercase border border-[var(--panel-border)] rounded-full px-4 py-2"
                  >
                    Not now
                  </button>
                </div>
              </div>
            ))}

            <div className="bg-[var(--surface)] border border-[var(--panel-border)] rounded-2xl px-5 py-5">
              <div className="font-label text-[10.5px] font-semibold uppercase tracking-wide text-[var(--mist)] mb-2.5">Selected entry</div>
              {!selected ? (
                <div className="text-sm text-[var(--mist)]">Click a node in the graph to revisit that entry.</div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: moodColor(scoreToValue(selected.moodScore)) }} />
                    <span className="font-label text-[11px] font-semibold text-[var(--mist)]">
                      {new Date(selected.createdAt).toLocaleDateString()}
                    </span>
                    <span className="font-label text-[11px] font-semibold ml-auto">{moodWord(scoreToValue(selected.moodScore))}</span>
                  </div>
                  {selected.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2.5">
                      {selected.themes.map((t) => (
                        <span key={t} className="font-label text-[10.5px] font-semibold bg-[var(--chip-bg)] text-[var(--mist)] px-2.5 py-1.5 rounded-full">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[13.5px] leading-relaxed">{selected.content}</p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
