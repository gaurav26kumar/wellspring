import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { makeGlowTexture } from '../lib/glowTexture';

const STATUS_STEPS = [
  { t: 0, msg: 'Waking the safety layer' },
  { t: 900, msg: 'Listening for context' },
  { t: 2200, msg: 'Retrieving what matters' },
  { t: 3400, msg: 'Reflecting' },
  { t: 4300, msg: 'Opening the spring' },
];
const T_MORPH_START = 2200;
const T_MORPH_END = 4200;
const T_RIPPLE_START = 4200;
const T_REVEAL = 5100;
const NODE_COUNT = 380;
const K = 3;
const STAR_COUNT = 160;

// Hardcoded per theme rather than read from CSS variables — this can be
// the very first thing that mounts on a fresh page load, before
// ThemeProvider's effect has necessarily written `data-theme` onto <html>,
// so a getComputedStyle() read at that exact moment could race and come
// back empty. Same defensive choice as the rest of the three.js scenes
// in this app (see GrowthPage.jsx).
const PALETTE = {
  dark: { clear: 0x0a0e14, from: [0.31, 0.82, 0.71], to: [0.95, 0.72, 0.45], amber: 0xf2b872, star: [0.93, 0.92, 0.89], blending: THREE.AdditiveBlending, coreMax: 0.85, starMax: 0.9 },
  light: { clear: 0xf1f4f2, from: [0.12, 0.56, 0.47], to: [0.73, 0.46, 0.16], amber: 0xb9762a, star: [0.12, 0.56, 0.47], blending: THREE.NormalBlending, coreMax: 0.4, starMax: 0.55 },
};

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function randInSphere(radius) {
  let x, y, z, d;
  do {
    x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; z = Math.random() * 2 - 1;
    d = x * x + y * y + z * z;
  } while (d > 1);
  return new THREE.Vector3(x * radius, y * radius, z * radius);
}
function dropletPoint(u, v) {
  const radius = Math.sin(Math.PI * Math.pow(u, 0.72)) * (1 - 0.55 * u) * 1.55;
  const y = u * 2.6 - 1.3;
  return new THREE.Vector3(Math.cos(v) * radius, y, Math.sin(v) * radius);
}

export function LandingPage() {
  const { user, ready } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [status, setStatus] = useState(STATUS_STEPS[0].msg);
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setRevealed(true);
      return;
    }
    if (!canvasRef.current) return;

    const palette = PALETTE[theme] || PALETTE.dark;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(palette.clear, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    const glowTex = makeGlowTexture();

    // ---- neural network -> droplet ----
    const nodePositions = [];
    const targetPositions = [];
    const currentPositions = new Float32Array(NODE_COUNT * 3);
    for (let i = 0; i < NODE_COUNT; i++) nodePositions.push(randInSphere(2.6));
    for (let i = 0; i < NODE_COUNT; i++) {
      const p = dropletPoint(Math.random(), Math.random() * Math.PI * 2);
      p.x += (Math.random() - 0.5) * 0.05; p.y += (Math.random() - 0.5) * 0.05; p.z += (Math.random() - 0.5) * 0.05;
      targetPositions.push(p);
    }
    nodePositions.forEach((p, i) => { currentPositions[i * 3] = p.x; currentPositions[i * 3 + 1] = p.y; currentPositions[i * 3 + 2] = p.z; });

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    const nodeColors = new Float32Array(NODE_COUNT * 3);
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));
    const nodeMat = new THREE.PointsMaterial({ size: 0.09, map: glowTex, transparent: true, depthWrite: false, blending: palette.blending, vertexColors: true });
    const nodesMesh = new THREE.Points(nodeGeo, nodeMat);

    const edges = [];
    const seen = new Set();
    for (let i = 0; i < NODE_COUNT; i++) {
      const dists = [];
      for (let j = 0; j < NODE_COUNT; j++) { if (i === j) continue; dists.push([nodePositions[i].distanceToSquared(nodePositions[j]), j]); }
      dists.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < K; k++) {
        const j = dists[k][1];
        const key = i < j ? i + '_' + j : j + '_' + i;
        if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
      }
    }
    const edgeCount = edges.length;
    const edgePositions = new Float32Array(edgeCount * 2 * 3);
    const edgeColors = new Float32Array(edgeCount * 2 * 3);
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
    const edgeMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: palette.blending, depthWrite: false });
    const edgesMesh = new THREE.LineSegments(edgeGeo, edgeMat);
    const edgePhase = new Float32Array(edgeCount);
    for (let i = 0; i < edgeCount; i++) edgePhase[i] = Math.random() * Math.PI * 2;

    const SIGNAL_COUNT = 16;
    const signalGeo = new THREE.BufferGeometry();
    const signalPos = new Float32Array(SIGNAL_COUNT * 3);
    signalGeo.setAttribute('position', new THREE.BufferAttribute(signalPos, 3));
    const signalMat = new THREE.PointsMaterial({ size: 0.16, map: glowTex, color: palette.amber, transparent: true, depthWrite: false, blending: palette.blending });
    const signalMesh = new THREE.Points(signalGeo, signalMat);
    const signals = Array.from({ length: SIGNAL_COUNT }, () => ({ edge: edges[Math.floor(Math.random() * edgeCount)], t: Math.random(), speed: 0.4 + Math.random() * 0.5 }));

    const coreMat = new THREE.SpriteMaterial({ map: glowTex, color: palette.amber, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    const coreSprite = new THREE.Sprite(coreMat);
    coreSprite.scale.set(1.6, 1.6, 1.6);

    const dropletGroup = new THREE.Group();
    dropletGroup.add(nodesMesh, edgesMesh, signalMesh, coreSprite);
    scene.add(dropletGroup);

    // ---- ambient starfield — keeps the page feeling alive if a visitor lingers ----
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(STAR_COUNT * 3);
    const starCol = new Float32Array(STAR_COUNT * 3);
    const starPhase = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      const p = randInSphere(1);
      const r = 6 + Math.random() * 7;
      starPos[i * 3] = p.x * r; starPos[i * 3 + 1] = p.y * r * 0.6; starPos[i * 3 + 2] = p.z * r - 2;
      starPhase[i] = Math.random() * Math.PI * 2;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({ size: 0.045, transparent: true, depthWrite: false, blending: palette.blending, vertexColors: true });
    const starMesh = new THREE.Points(starGeo, starMat);
    scene.add(starMesh);

    // ---- ripples, including slow ambient ones that continue forever ----
    let ripples = [];
    function spawnRipple(nowElapsed, opts = {}) {
      const geo = new THREE.RingGeometry(0.02, 0.05, 64);
      const mat = new THREE.MeshBasicMaterial({ color: palette.amber, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: palette.blending, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      ripples.push({ mesh, spawnElapsed: nowElapsed + (opts.delay || 0), life: opts.life || 1.4, maxOpacity: opts.maxOpacity ?? 0.8, maxScale: opts.maxScale || 4.5 });
    }

    const startTime = performance.now();
    let ripplesSpawned = false;
    let ambientRippleAt = Infinity;
    let rafId;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      const elapsed = now - startTime;

      starMesh.rotation.y += 0.00015;
      const sCol = starGeo.attributes.color.array;
      for (let i = 0; i < STAR_COUNT; i++) {
        const tw = (0.3 + 0.7 * Math.abs(Math.sin(now * 0.0006 + starPhase[i]))) * palette.starMax;
        sCol[i * 3] = palette.star[0] * tw; sCol[i * 3 + 1] = palette.star[1] * tw; sCol[i * 3 + 2] = palette.star[2] * tw;
      }
      starGeo.attributes.color.needsUpdate = true;

      let msg = STATUS_STEPS[0].msg;
      for (const s of STATUS_STEPS) if (elapsed >= s.t) msg = s.msg;
      setStatus(msg);
      setProgress(Math.min(100, (elapsed / T_REVEAL) * 100));

      const breathe = 1 + Math.sin(now * 0.0011) * 0.025;
      dropletGroup.scale.set(breathe, breathe, breathe);
      dropletGroup.position.y = Math.sin(now * 0.0006) * 0.09;
      dropletGroup.rotation.y += 0.0009;

      let morphT = 0;
      if (elapsed > T_MORPH_START) morphT = Math.min(1, (elapsed - T_MORPH_START) / (T_MORPH_END - T_MORPH_START));
      const eased = easeInOutCubic(morphT);

      const posAttr = nodeGeo.attributes.position.array;
      for (let i = 0; i < NODE_COUNT; i++) {
        const from = nodePositions[i], to = targetPositions[i];
        posAttr[i * 3] = from.x + (to.x - from.x) * eased;
        posAttr[i * 3 + 1] = from.y + (to.y - from.y) * eased;
        posAttr[i * 3 + 2] = from.z + (to.z - from.z) * eased;
      }
      nodeGeo.attributes.position.needsUpdate = true;

      const edgeFade = 1 - eased;
      const ePos = edgeGeo.attributes.position.array;
      const eCol = edgeGeo.attributes.color.array;
      for (let e = 0; e < edgeCount; e++) {
        const [i, j] = edges[e];
        ePos[e * 6] = posAttr[i * 3]; ePos[e * 6 + 1] = posAttr[i * 3 + 1]; ePos[e * 6 + 2] = posAttr[i * 3 + 2];
        ePos[e * 6 + 3] = posAttr[j * 3]; ePos[e * 6 + 4] = posAttr[j * 3 + 1]; ePos[e * 6 + 5] = posAttr[j * 3 + 2];
        const flick = 0.35 + 0.65 * Math.abs(Math.sin(now * 0.002 + edgePhase[e]));
        const intensity = flick * edgeFade;
        eCol[e * 6] = palette.from[0] * intensity; eCol[e * 6 + 1] = palette.from[1] * intensity; eCol[e * 6 + 2] = palette.from[2] * intensity;
        eCol[e * 6 + 3] = palette.from[0] * intensity; eCol[e * 6 + 4] = palette.from[1] * intensity; eCol[e * 6 + 5] = palette.from[2] * intensity;
      }
      edgeGeo.attributes.position.needsUpdate = true;
      edgeGeo.attributes.color.needsUpdate = true;
      edgesMesh.visible = edgeFade > 0.01;

      const nCol = nodeGeo.attributes.color.array;
      for (let i = 0; i < NODE_COUNT; i++) {
        nCol[i * 3] = palette.from[0] + (palette.to[0] - palette.from[0]) * eased;
        nCol[i * 3 + 1] = palette.from[1] + (palette.to[1] - palette.from[1]) * eased;
        nCol[i * 3 + 2] = palette.from[2] + (palette.to[2] - palette.from[2]) * eased;
      }
      nodeGeo.attributes.color.needsUpdate = true;

      const pulse = 1 + Math.sin(now * 0.003) * 0.16;
      coreSprite.scale.set(1.6 * pulse, 1.6 * pulse, 1.6 * pulse);
      coreMat.opacity = eased * palette.coreMax;

      if (edgeFade > 0.05) {
        signalMesh.visible = true;
        const sPos = signalGeo.attributes.position.array;
        signals.forEach((s, idx) => {
          s.t += 0.006 * s.speed;
          if (s.t > 1) { s.t = 0; s.edge = edges[Math.floor(Math.random() * edgeCount)]; }
          const a = nodePositions[s.edge[0]], b = nodePositions[s.edge[1]];
          sPos[idx * 3] = a.x + (b.x - a.x) * s.t; sPos[idx * 3 + 1] = a.y + (b.y - a.y) * s.t; sPos[idx * 3 + 2] = a.z + (b.z - a.z) * s.t;
        });
        signalGeo.attributes.position.needsUpdate = true;
        signalMat.opacity = edgeFade;
      } else {
        signalMesh.visible = false;
      }

      if (elapsed > T_RIPPLE_START && !ripplesSpawned) {
        ripplesSpawned = true;
        spawnRipple(elapsed, { delay: 0 }); spawnRipple(elapsed, { delay: 220 }); spawnRipple(elapsed, { delay: 440 });
        ambientRippleAt = T_REVEAL + 1400;
      }
      if (elapsed > ambientRippleAt) {
        spawnRipple(elapsed, { life: 2.0, maxOpacity: 0.4, maxScale: 3.4 });
        ambientRippleAt = elapsed + 3400 + Math.random() * 1600;
      }
      ripples.forEach((r) => {
        const rel = elapsed - r.spawnElapsed;
        if (rel < 0) { r.mesh.material.opacity = 0; return; }
        const p = Math.min(1, rel / r.life);
        const scale = 0.3 + p * r.maxScale;
        r.mesh.scale.set(scale, scale, scale);
        r.mesh.material.opacity = (1 - p) * r.maxOpacity;
      });
      ripples = ripples.filter((r) => {
        const done = (elapsed - r.spawnElapsed) / r.life >= 1;
        if (done) { scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
        return !done;
      });

      camera.position.x = Math.sin(now * 0.00015) * 0.4;
      camera.position.y = Math.cos(now * 0.0002) * 0.2;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);

      if (elapsed > T_REVEAL) setRevealed(true);
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      nodeGeo.dispose(); nodeMat.dispose();
      edgeGeo.dispose(); edgeMat.dispose();
      signalGeo.dispose(); signalMat.dispose();
      starGeo.dispose(); starMat.dispose();
      coreMat.dispose();
      glowTex.dispose();
      ripples.forEach((r) => { r.mesh.geometry.dispose(); r.mesh.material.dispose(); });
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  // Already signed in — skip the marketing page entirely, straight into the app.
  if (ready && user) return <Navigate to="/journal" replace />;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: theme === 'light' ? '#f1f4f2' : '#0a0e14' }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-[1100ms]"
        style={{
          opacity: revealed ? 1 : 0,
          background:
            theme === 'light'
              ? 'radial-gradient(ellipse at center, rgba(241,244,242,0.92) 0%, rgba(241,244,242,0.74) 34%, rgba(241,244,242,0.16) 66%, rgba(241,244,242,0) 100%)'
              : 'radial-gradient(ellipse at center, rgba(10,14,20,0.92) 0%, rgba(10,14,20,0.74) 34%, rgba(10,14,20,0.16) 66%, rgba(10,14,20,0) 100%)',
        }}
      />

      <div className="fixed top-6 right-7 flex gap-2.5 z-10">
        <button
          onClick={toggle}
          className="font-label text-[11px] font-semibold uppercase tracking-wider text-[var(--mist)] hover:text-[var(--paper)] border border-[var(--panel-border)] rounded-full px-4 py-2 transition-colors"
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="font-label text-[11px] font-semibold uppercase tracking-wider text-[var(--mist)] hover:text-[var(--paper)] border border-[var(--panel-border)] rounded-full px-4 py-2 transition-colors"
          >
            Skip intro
          </button>
        )}
      </div>

      {!revealed && (
        <div className="fixed left-0 right-0 bottom-12 flex flex-col items-center gap-3.5 pointer-events-none">
          <div className="font-label text-[11px] uppercase tracking-widest text-[var(--mist)] min-h-[14px]">{status}</div>
          <div className="w-[220px] h-[1px] bg-[var(--panel-border)] relative">
            <div className="absolute left-0 top-0 h-full bg-[var(--glow-amber)] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 flex flex-col items-center justify-center text-center px-6 transition-opacity duration-[1100ms]"
        style={{ opacity: revealed ? 1 : 0, pointerEvents: revealed ? 'auto' : 'none' }}
      >
        <div className="font-label text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--line-teal)] mb-4">Wellspring</div>
        <h1 className="font-display italic font-semibold text-[clamp(2.2rem,7vw,4rem)] leading-[1.1] text-[var(--paper)] mb-4 max-w-xl">
          A quieter way to think things through
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--mist)] max-w-md mb-8">
          Journal, talk it out, and notice the patterns before they become problems — with a safety layer that never
          waits on the AI to behave.
        </p>
        <div className="flex gap-3.5 flex-wrap justify-center">
          <button
            onClick={() => navigate('/register')}
            className="font-label text-xs font-bold uppercase tracking-wider bg-[var(--glow-amber)] text-[var(--bg)] rounded-full px-7 py-3.5"
          >
            Enter Wellspring
          </button>
          <button
            onClick={() => navigate('/login')}
            className="font-label text-xs font-bold uppercase tracking-wider border border-[var(--panel-border)] text-[var(--paper)] rounded-full px-7 py-3.5"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
