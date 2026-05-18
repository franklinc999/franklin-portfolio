"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================
// SENS CONVERSION
// ============================================================
const YAW = {
  valorant: 0.07,
  cod: 0.0066,
  apex: 0.022,
} as const;

type GameName = keyof typeof YAW;

function cmPer360(dpi: number, sens: number, game: GameName): number {
  const denom = dpi * sens * YAW[game];
  if (denom <= 0) return 0;
  return (360 * 2.54) / denom;
}

// degrees per pixel of mouse movement (movementX from pointer lock)
function degPerCount(sens: number, game: GameName): number {
  return sens * YAW[game];
}

// ============================================================
// TYPES
// ============================================================
type Screen = "settings" | "modeSelect" | "playing";
type Mode = "reaction" | "tracking" | "peek";

interface Settings {
  game: GameName;
  dpi: number;
  sens: number;
}

// 3D vector for world-space target positions
interface Vec3 { x: number; y: number; z: number; }

interface Target3D {
  pos: Vec3;
  vel?: Vec3;
  r: number;
  spawnAt: number;
  hp?: number;
  lifeMs?: number;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function WarmupGame() {
  const [screen, setScreen] = useState<Screen>("settings");
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window === "undefined") return { game: "valorant", dpi: 800, sens: 0.5 };
    try {
      const stored = localStorage.getItem("warmup-settings");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { game: "valorant", dpi: 800, sens: 0.5 };
  });
  const [mode, setMode] = useState<Mode>("reaction");

  useEffect(() => {
    try {
      localStorage.setItem("warmup-settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  if (screen === "settings") {
    return (
      <SettingsScreen settings={settings} setSettings={setSettings} onContinue={() => setScreen("modeSelect")} />
    );
  }
  if (screen === "modeSelect") {
    return (
      <ModeSelect onPick={(m) => { setMode(m); setScreen("playing"); }} onBack={() => setScreen("settings")} settings={settings} />
    );
  }
  return <GameCanvas mode={mode} settings={settings} onExit={() => setScreen("modeSelect")} />;
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function SettingsScreen({ settings, setSettings, onContinue }: { settings: Settings; setSettings: (s: Settings) => void; onContinue: () => void; }) {
  // Use string-backed input state so the user can clear the field freely.
  // Commit to settings only when they blur or type a valid number.
  const [dpiStr, setDpiStr] = useState(String(settings.dpi));
  const [sensStr, setSensStr] = useState(String(settings.sens));

  // If parent settings change (e.g. on mount with localStorage), sync
  useEffect(() => { setDpiStr(String(settings.dpi)); }, [settings.dpi]);
  useEffect(() => { setSensStr(String(settings.sens)); }, [settings.sens]);

  const commitDpi = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setDpiStr(String(settings.dpi)); // revert
      return;
    }
    const clamped = Math.max(100, Math.min(20000, n));
    setSettings({ ...settings, dpi: clamped });
    setDpiStr(String(clamped));
  };
  const commitSens = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setSensStr(String(settings.sens));
      return;
    }
    const clamped = Math.max(0.01, Math.min(20, n));
    setSettings({ ...settings, sens: clamped });
    setSensStr(String(clamped));
  };

  const cm360 = cmPer360(settings.dpi, settings.sens, settings.game);
  const edpi = settings.dpi * settings.sens;
  return (
    <div className="w-full max-w-[960px] mx-auto liquid-glass liquid-glass-border rounded-xl p-8" style={{ minHeight: 600 }}>
      <div className="max-w-md mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 text-center">Step 1 of 2</p>
        <h2 className="font-serif text-3xl text-white text-center mb-1">Match your <span className="italic text-[var(--color-accent-2)]">sens</span></h2>
        <p className="text-xs text-[var(--color-text-muted)] text-center mb-8">So muscle memory carries over to your real games.</p>

        <label className="block mb-6">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] block mb-2">Game profile</span>
          <div className="grid grid-cols-3 gap-2">
            {(["valorant", "cod", "apex"] as GameName[]).map((g) => (
              <button key={g} onClick={() => setSettings({ ...settings, game: g })}
                className={`px-3 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border ${settings.game === g ? "bg-[var(--color-accent-2)]/10 border-[var(--color-accent-2)]/40 text-[var(--color-accent-2)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-glow)]"}`}>
                {g === "valorant" && "Valorant"}
                {g === "cod" && "CoD/MW"}
                {g === "apex" && "Apex/CS"}
              </button>
            ))}
          </div>
        </label>

        <label className="block mb-5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] block mb-2">Mouse DPI</span>
          <input
            type="text"
            inputMode="numeric"
            value={dpiStr}
            onChange={(e) => {
              const v = e.target.value;
              setDpiStr(v);
              // Live-commit only if the value is a complete valid number; otherwise just hold the string
              const n = parseFloat(v);
              if (Number.isFinite(n) && n >= 100 && n <= 20000) {
                setSettings({ ...settings, dpi: n });
              }
            }}
            onBlur={(e) => commitDpi(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-full bg-black/40 border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent-2)] transition-colors"
          />
          <span className="text-[10px] font-mono text-[var(--color-text-faint)] mt-1 block">Range 100, 20000</span>
        </label>

        <label className="block mb-8">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] block mb-2">In-game sensitivity</span>
          <input
            type="text"
            inputMode="decimal"
            value={sensStr}
            onChange={(e) => {
              const v = e.target.value;
              setSensStr(v);
              const n = parseFloat(v);
              if (Number.isFinite(n) && n >= 0.01 && n <= 20) {
                setSettings({ ...settings, sens: n });
              }
            }}
            onBlur={(e) => commitSens(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-full bg-black/40 border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent-2)] transition-colors"
          />
        </label>

        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="liquid-glass-border rounded-lg p-4 bg-white/[0.02]">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] mb-1">eDPI</p>
            <p className="font-mono text-2xl text-white tabular-nums">{Math.round(edpi)}</p>
          </div>
          <div className="liquid-glass-border rounded-lg p-4 bg-white/[0.02]">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] mb-1">cm / 360</p>
            <p className="font-mono text-2xl text-white tabular-nums">{cm360.toFixed(1)}<span className="text-xs text-[var(--color-text-faint)] ml-1">cm</span></p>
          </div>
        </div>

        <button onClick={onContinue} className="w-full liquid-glass-border rounded-full px-6 py-3 text-sm font-medium text-white hover:border-[var(--color-border-glow)] hover:bg-white/5 transition-all">Continue</button>
        <p className="text-[10px] font-mono text-center text-[var(--color-text-faint)] mt-4 leading-relaxed">Yaw values: Valorant {YAW.valorant}, CoD {YAW.cod}, Apex/CS {YAW.apex}</p>
      </div>
    </div>
  );
}

// ============================================================
// MODE SELECT
// ============================================================
function ModeSelect({ onPick, onBack, settings }: { onPick: (m: Mode) => void; onBack: () => void; settings: Settings; }) {
  const cm360 = cmPer360(settings.dpi, settings.sens, settings.game);
  const modes: { id: Mode; title: string; sub: string; body: string; view: string }[] = [
    { id: "reaction", title: "Reaction", sub: "Click on flash", view: "First-person", body: "Targets pop in a 3D range, click as fast as you can. Score = average reaction time." },
    { id: "tracking", title: "Tracking", sub: "Stay on target", view: "First-person", body: "A target strafes through the range. Keep the crosshair on it. Score = % of time locked." },
    { id: "peek", title: "Peek", sub: "Lean and shoot", view: "Third-person", body: "Your character is behind cover. Hold A or D to lean. Targets cross the lane briefly." },
  ];
  return (
    <div className="w-full max-w-[960px] mx-auto liquid-glass liquid-glass-border rounded-xl p-8" style={{ minHeight: 600 }}>
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-white transition-colors">← Settings</button>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-text-faint)]">Locked at</p>
          <p className="font-mono text-xs text-[var(--color-text)]">{cm360.toFixed(1)} cm / 360, {settings.game.toUpperCase()}</p>
        </div>
      </div>
      <div className="text-center mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">Step 2 of 2</p>
        <h2 className="font-serif text-3xl text-white">Pick a <span className="italic text-[var(--color-accent-2)]">drill</span></h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {modes.map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)} className="liquid-glass-border rounded-xl p-5 text-left hover:bg-white/5 hover:border-[var(--color-border-glow)] transition-all group">
            <div className="flex items-start justify-between mb-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-accent-2)]">{m.sub}</p>
              <p className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-faint)]">{m.view}</p>
            </div>
            <h3 className="font-serif text-xl text-white mb-3 group-hover:text-[var(--color-accent-2)] transition-colors">{m.title}</h3>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{m.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GAME CANVAS
// ============================================================
const CANVAS_W = 960;
const CANVAS_H = 600;
const ROUND_DURATION_MS = 30000;

// Perspective projection
const FOV_H_DEG = 90; // horizontal FOV
const FOV_H_RAD = (FOV_H_DEG * Math.PI) / 180;
// camera "focal length" in canvas pixels
const FOCAL = CANVAS_W / (2 * Math.tan(FOV_H_RAD / 2));

function rotateY(v: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: v.x * c - v.z * s, y: v.y, z: v.x * s + v.z * c };
}
function rotateX(v: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c };
}

// Project a world-space point (relative to camera) into screen coords.
// Returns null if behind camera.
function project(p: Vec3): { sx: number; sy: number; scale: number } | null {
  if (p.z <= 0.1) return null;
  const sx = CANVAS_W / 2 + (p.x * FOCAL) / p.z;
  const sy = CANVAS_H / 2 - (p.y * FOCAL) / p.z;
  return { sx, sy, scale: FOCAL / p.z };
}

function GameCanvas({ mode, settings, onExit }: { mode: Mode; settings: Settings; onExit: () => void; }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<{ value: number; label: string; subtitle: string } | null>(null);
  const [showResults, setShowResults] = useState(false);

  // First-person camera: yaw (left/right) and pitch (up/down) in radians
  const camRef = useRef({ yaw: 0, pitch: 0 });
  // Audio context for shoot/hit sounds
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Recoil applied to view (pulls camera up + slight horiz spread)
  const recoilRef = useRef({ yaw: 0, pitch: 0 });
  // Camera shake amplitude
  const shakeRef = useRef(0);
  // Muzzle flash
  const flashRef = useRef(0);
  // Peek lean (-1..1)
  const peekRef = useRef({ offset: 0, target: 0 });

  // Targets in world space
  const targetsRef = useRef<Target3D[]>([]);

  // Stats
  const statsRef = useRef({
    hits: 0,
    misses: 0,
    reactionTimes: [] as number[],
    onTargetMs: 0,
    totalMs: 0,
    spawned: 0,
  });

  const startedAtRef = useRef(0);
  const lastFrameRef = useRef(0);
  const keysRef = useRef<{ [k: string]: boolean }>({});

  const degPerCountRef = useRef(degPerCount(settings.sens, settings.game));
  useEffect(() => { degPerCountRef.current = degPerCount(settings.sens, settings.game); }, [settings]);

  const [highScores, setHighScores] = useState<{ [k in Mode]?: number }>({});
  useEffect(() => {
    try {
      const stored = localStorage.getItem("warmup-highscores");
      if (stored) setHighScores(JSON.parse(stored));
    } catch {}
  }, []);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
    };
  }, []);

  const saveHighScore = useCallback((m: Mode, value: number, betterIsLower: boolean) => {
    setHighScores((prev) => {
      const current = prev[m];
      let next = prev;
      if (current === undefined || (betterIsLower ? value < current : value > current)) {
        next = { ...prev, [m]: value };
        try { localStorage.setItem("warmup-highscores", JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }, []);

  // ===== Audio =====
  function ensureAudio() {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      try { audioCtxRef.current = new Ctor(); } catch { return null; }
    }
    return audioCtxRef.current;
  }

  function playShoot() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Punchy gunshot: noise burst through lowpass with steep envelope, plus low thump
    const bufLen = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, now);
    lp.frequency.exponentialRampToValueAtTime(400, now + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    noise.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    noise.start(now); noise.stop(now + 0.15);

    // Sub thump
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.35, now);
    og.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.12);
  }

  function playHit() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Crisp metallic ping
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.2);

    // Second harmonic for sparkle
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(2800, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    o2.connect(g2); g2.connect(ctx.destination);
    o2.start(now); o2.stop(now + 0.14);
  }

  const startRound = useCallback(() => {
    statsRef.current = { hits: 0, misses: 0, reactionTimes: [], onTargetMs: 0, totalMs: 0, spawned: 0 };
    targetsRef.current = [];
    camRef.current = { yaw: 0, pitch: 0 };
    recoilRef.current = { yaw: 0, pitch: 0 };
    shakeRef.current = 0;
    flashRef.current = 0;
    peekRef.current = { offset: 0, target: 0 };
    startedAtRef.current = performance.now();
    lastFrameRef.current = performance.now();
    setScore(null);
    setShowResults(false);
    setRunning(true);
    const canvas = canvasRef.current;
    if (canvas) canvas.requestPointerLock();
  }, []);

  const endRound = useCallback(() => {
    const s = statsRef.current;
    setRunning(false);
    document.exitPointerLock?.();

    let value = 0;
    let label = "";
    let subtitle = "";
    let betterIsLower = false;
    if (mode === "reaction") {
      const avg = s.reactionTimes.length ? s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length : 0;
      value = Math.round(avg);
      label = "ms avg reaction";
      subtitle = `${s.hits} hit, ${s.misses} miss`;
      betterIsLower = true;
    } else if (mode === "tracking") {
      const pct = s.totalMs > 0 ? (s.onTargetMs / s.totalMs) * 100 : 0;
      value = Math.round(pct);
      label = "% on target";
      subtitle = `${(s.totalMs / 1000).toFixed(1)}s tracked`;
      betterIsLower = false;
    } else {
      const speedBonus = s.reactionTimes.length ? Math.max(0, 800 - s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length) : 0;
      value = Math.round(s.hits * 100 - s.misses * 20 + speedBonus);
      label = "peek score";
      subtitle = `${s.hits} kills, ${s.misses} miss, ${s.reactionTimes.length ? Math.round(s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length) : 0}ms avg`;
    }
    saveHighScore(mode, value, betterIsLower);
    setScore({ value, label, subtitle });
    setShowResults(true);
  }, [mode, saveHighScore]);

  // ===== Input =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMove = (e: MouseEvent) => {
      if (!running) return;
      const deg = degPerCountRef.current;
      // Mouse right = view turns right (yaw decreases in our convention so world rotates left)
      camRef.current.yaw -= (e.movementX * deg * Math.PI) / 180;
      camRef.current.pitch += (e.movementY * deg * Math.PI) / 180;
      camRef.current.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camRef.current.pitch));
    };

    const onDown = (e: MouseEvent) => {
      if (!running) return;
      if (e.button !== 0) return;
      flashRef.current = 100;
      shakeRef.current = 8;
      recoilRef.current.pitch -= 0.02 + Math.random() * 0.015;
      recoilRef.current.yaw += (Math.random() - 0.5) * 0.012;
      playShoot();

      // Hit test: project all targets, check distance from center
      const cam = camRef.current;
      const recoil = recoilRef.current;
      const totalYaw = cam.yaw + recoil.yaw;
      const totalPitch = cam.pitch + recoil.pitch;

      const targets = targetsRef.current;
      let hit = false;
      let bestIdx = -1, bestZ = Infinity;
      // For peek mode, camera is at (peek * 1.6, 0.5, -2.5). For FP modes, camera is at origin.
      const camPos: Vec3 = mode === "peek"
        ? { x: peekRef.current.offset * 1.6, y: 0.5, z: -2.5 }
        : { x: 0, y: 0, z: 0 };

      // Cover-block occlusion: if peek mode and the ray to target passes through the cover block, skip.
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const rel: Vec3 = { x: t.pos.x - camPos.x, y: t.pos.y - camPos.y, z: t.pos.z - camPos.z };
        const r1 = rotateY(rel, -totalYaw);
        const r2 = rotateX(r1, -totalPitch);
        const proj = project(r2);
        if (!proj) continue;
        const dx = proj.sx - CANVAS_W / 2;
        const dy = proj.sy - CANVAS_H / 2;
        const screenR = t.r * proj.scale;
        // Use a generous minimum hitbox so distant/small targets are still clickable.
        const hitRadius = Math.max(screenR, 18);
        if (dx * dx + dy * dy <= hitRadius * hitRadius && r2.z < bestZ) {
          // For peek, check if the cover block is between camera and target
          if (mode === "peek") {
            // Cover block: x in [-1.6, 1.6], y in [-3, 2.5], z = 1.5
            const dirX = t.pos.x - camPos.x;
            const dirY = t.pos.y - camPos.y;
            const dirZ = t.pos.z - camPos.z;
            const blockZ = 1.5;
            const blockHalfW = 1.6;
            // Parametric t at which ray hits z=blockZ plane
            if (dirZ > 0) {
              const tHit = (blockZ - camPos.z) / dirZ;
              if (tHit > 0 && tHit < 1) {
                const hitX = camPos.x + dirX * tHit;
                const hitY = camPos.y + dirY * tHit;
                if (hitX > -blockHalfW && hitX < blockHalfW && hitY > -3 && hitY < 2.5) {
                  // Blocked by cover
                  continue;
                }
              }
            }
          }
          bestZ = r2.z;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        hit = true;
        statsRef.current.reactionTimes.push(performance.now() - targets[bestIdx].spawnAt);
        statsRef.current.hits++;
        targets.splice(bestIdx, 1);
        playHit();
      }
      if (!hit) statsRef.current.misses++;
    };

    const onKey = (e: KeyboardEvent, down: boolean) => {
      keysRef.current[e.key.toLowerCase()] = down;
      if (down && e.key === "Escape" && running) endRound();
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [running, mode, endRound]);

  // ===== Loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const loop = (now: number) => {
      const dt = Math.min(50, now - lastFrameRef.current);
      lastFrameRef.current = now;

      if (running) {
        const elapsed = now - startedAtRef.current;
        if (elapsed >= ROUND_DURATION_MS) {
          endRound();
        } else {
          updateMode(mode, dt, now);
        }
        // Decay recoil
        recoilRef.current.yaw += (0 - recoilRef.current.yaw) * Math.min(1, dt / 100);
        recoilRef.current.pitch += (0 - recoilRef.current.pitch) * Math.min(1, dt / 100);
        // Decay shake/flash
        shakeRef.current *= Math.pow(0.001, dt / 1000);
        flashRef.current = Math.max(0, flashRef.current - dt);

        // Tracking: measure on-target time
        if (mode === "tracking") {
          statsRef.current.totalMs += dt;
          const t = targetsRef.current[0];
          if (t) {
            const cam = camRef.current;
            const totalYaw = cam.yaw + recoilRef.current.yaw;
            const totalPitch = cam.pitch + recoilRef.current.pitch;
            const rel = { x: t.pos.x, y: t.pos.y, z: t.pos.z };
            const r1 = rotateY(rel, -totalYaw);
            const r2 = rotateX(r1, -totalPitch);
            const proj = project(r2);
            if (proj) {
              const dx = proj.sx - CANVAS_W / 2;
              const dy = proj.sy - CANVAS_H / 2;
              const screenR = t.r * proj.scale;
              if (dx * dx + dy * dy <= screenR * screenR) {
                statsRef.current.onTargetMs += dt;
              }
            }
          }
        }
      }

      drawScene(ctx, mode, running, now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, endRound]);

  function updateMode(m: Mode, dt: number, now: number) {
    const targets = targetsRef.current;
    const stats = statsRef.current;

    if (m === "reaction") {
      if (targets.length === 0) {
        if (Math.random() < dt / 400) {
          // Spawn in front of camera, random horizontal angle, random height, random distance
          const angle = (Math.random() - 0.5) * 1.0; // ~ +-30deg from center
          const dist = 8 + Math.random() * 6;
          const height = -0.5 + Math.random() * 1.8;
          targets.push({
            pos: { x: Math.sin(angle) * dist, y: height, z: Math.cos(angle) * dist },
            r: 0.35,
            spawnAt: now,
            lifeMs: 1800,
          });
          stats.spawned++;
        }
      } else {
        const t = targets[0];
        if (now - t.spawnAt > (t.lifeMs ?? 1800)) {
          targets.shift();
          stats.misses++;
        }
      }
    } else if (m === "tracking") {
      if (targets.length === 0) {
        targets.push({
          pos: { x: -3, y: 0.5, z: 9 },
          vel: { x: 2.5, y: 0, z: 0 },
          r: 0.45,
          spawnAt: now,
        });
      }
      const t = targets[0];
      // Smooth random direction changes
      if (Math.random() < dt / 500) {
        t.vel!.x = (Math.random() - 0.5) * 4.5;
      }
      if (Math.random() < dt / 900) {
        t.vel!.y = (Math.random() - 0.5) * 1.2;
      }
      t.pos.x += t.vel!.x * dt / 1000;
      t.pos.y += t.vel!.y * dt / 1000;
      // Constrain in box
      if (t.pos.x < -5) { t.pos.x = -5; t.vel!.x = Math.abs(t.vel!.x); }
      if (t.pos.x > 5) { t.pos.x = 5; t.vel!.x = -Math.abs(t.vel!.x); }
      if (t.pos.y < -1) { t.pos.y = -1; t.vel!.y = Math.abs(t.vel!.y); }
      if (t.pos.y > 2.2) { t.pos.y = 2.2; t.vel!.y = -Math.abs(t.vel!.y); }
    } else if (m === "peek") {
      // Lean
      const keys = keysRef.current;
      let target = 0;
      if (keys["a"]) target = -1;
      if (keys["d"]) target = 1;
      peekRef.current.target = target;
      peekRef.current.offset += (target - peekRef.current.offset) * Math.min(1, dt * 0.008);

      // Spawn targets behind the cover at moderate depth.
      // Cover is at z=1.5 in world space (close to player). Targets at z=5-7.
      // Targets must stay close to the cover line of sight - if you don't peek, you can't see them.
      if (targets.length === 0 && Math.random() < dt / 500) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const z = 5 + Math.random() * 2.5;
        // Spawn close to the cover edge so peeking is required
        const startX = side * (1.6 + Math.random() * 0.8);
        const speed = (1.2 + Math.random() * 0.8) * side;
        targets.push({
          pos: { x: startX, y: 0.2 + (Math.random() - 0.5) * 0.6, z },
          vel: { x: speed, y: 0, z: 0 },
          r: 0.5,
          spawnAt: now,
          lifeMs: 3500,
        });
        stats.spawned++;
      }
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.pos.x += (t.vel?.x ?? 0) * dt / 1000;
        if (Math.abs(t.pos.x) > 6 || now - t.spawnAt > (t.lifeMs ?? 3500)) {
          targets.splice(i, 1);
        }
      }
    }
  }

  // ===== Drawing =====
  function drawScene(ctx: CanvasRenderingContext2D, m: Mode, isRunning: boolean, now: number) {
    const sh = shakeRef.current;
    const shakeX = (Math.random() - 0.5) * sh;
    const shakeY = (Math.random() - 0.5) * sh;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (m === "peek") {
      drawPeekScene(ctx, isRunning, now);
    } else {
      drawFPScene(ctx, m, isRunning, now);
    }

    ctx.restore();

    // Muzzle flash
    if (flashRef.current > 0 && isRunning) {
      const alpha = flashRef.current / 100;
      const fx = CANVAS_W / 2 + 60;
      const fy = CANVAS_H - (m === "peek" ? 130 : 100);
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 220);
      g.addColorStop(0, `rgba(255,220,120,${alpha * 0.85})`);
      g.addColorStop(0.3, `rgba(255,140,40,${alpha * 0.45})`);
      g.addColorStop(1, "rgba(255,100,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  // ----- First-person scene (Reaction, Tracking) -----
  function drawFPScene(ctx: CanvasRenderingContext2D, m: Mode, isRunning: boolean, now: number) {
    const cam = camRef.current;
    const totalYaw = cam.yaw + recoilRef.current.yaw;
    const totalPitch = cam.pitch + recoilRef.current.pitch;

    // Sky/floor
    drawSkyAndFloor(ctx, totalPitch);

    // Range walls (3D box around camera)
    drawRangeWalls(ctx, totalYaw, totalPitch);

    // Targets
    const targets = targetsRef.current;
    // Sort by depth (far first)
    const projected = targets.map((t) => {
      const rel = { x: t.pos.x, y: t.pos.y, z: t.pos.z };
      const r1 = rotateY(rel, -totalYaw);
      const r2 = rotateX(r1, -totalPitch);
      const p = project(r2);
      return { t, p, z: r2.z };
    }).filter(o => o.p !== null).sort((a, b) => (b.z) - (a.z));

    for (const { t, p } of projected) {
      if (!p) continue;
      const screenR = t.r * p.scale;
      drawTargetSphere(ctx, p.sx, p.sy, screenR, m, now, now - t.spawnAt);
    }

    if (isRunning) {
      drawHUD(ctx, m, now);
      drawCrosshair(ctx, CANVAS_W / 2, CANVAS_H / 2);
      drawFPWeapon(ctx);
    }
  }

  function drawSkyAndFloor(ctx: CanvasRenderingContext2D, pitch: number) {
    // Horizon line moves up/down with pitch
    const horizon = CANVAS_H / 2 + Math.tan(pitch) * FOCAL;

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, Math.max(0, horizon));
    skyGrad.addColorStop(0, "#0a0a12");
    skyGrad.addColorStop(1, "#15151f");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, Math.max(0, horizon));

    // Floor
    const floorGrad = ctx.createLinearGradient(0, horizon, 0, CANVAS_H);
    floorGrad.addColorStop(0, "#15151f");
    floorGrad.addColorStop(1, "#08080c");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, Math.max(0, horizon), CANVAS_W, CANVAS_H - Math.max(0, horizon));

    // Horizon glow line
    if (horizon > 0 && horizon < CANVAS_H) {
      ctx.strokeStyle = "rgba(167,139,250,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(CANVAS_W, horizon);
      ctx.stroke();
    }
  }

  function drawRangeWalls(ctx: CanvasRenderingContext2D, yaw: number, pitch: number) {
    // Draw a back wall at z=20 and side stripes via projected lines
    const corners = [
      { x: -12, y: -3, z: 20 },
      { x: 12, y: -3, z: 20 },
      { x: 12, y: 4, z: 20 },
      { x: -12, y: 4, z: 20 },
    ];
    const proj = corners.map((c) => {
      const r1 = rotateY(c, -yaw);
      const r2 = rotateX(r1, -pitch);
      return project(r2);
    });

    if (proj.every((p) => p)) {
      ctx.beginPath();
      ctx.moveTo(proj[0]!.sx, proj[0]!.sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(proj[i]!.sx, proj[i]!.sy);
      ctx.closePath();
      ctx.fillStyle = "rgba(20,20,28,0.6)";
      ctx.fill();
      ctx.strokeStyle = "rgba(91,184,212,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Floor grid lines: draw lines parallel to camera direction at fixed Z intervals
    ctx.strokeStyle = "rgba(91,184,212,0.08)";
    ctx.lineWidth = 1;
    for (let z = 3; z <= 18; z += 1.5) {
      const a = { x: -12, y: -1.5, z };
      const b = { x: 12, y: -1.5, z };
      const pa = project(rotateX(rotateY(a, -yaw), -pitch));
      const pb = project(rotateX(rotateY(b, -yaw), -pitch));
      if (pa && pb) {
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
    }
    // Perpendicular grid
    for (let x = -8; x <= 8; x += 2) {
      const a = { x, y: -1.5, z: 3 };
      const b = { x, y: -1.5, z: 18 };
      const pa = project(rotateX(rotateY(a, -yaw), -pitch));
      const pb = project(rotateX(rotateY(b, -yaw), -pitch));
      if (pa && pb) {
        ctx.beginPath();
        ctx.moveTo(pa.sx, pa.sy);
        ctx.lineTo(pb.sx, pb.sy);
        ctx.stroke();
      }
    }
  }

  // Aim-Labs-style 3D sphere: strong directional shading, specular highlight, contact shadow.
  function drawTargetSphere(ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, m: Mode, now: number, age: number) {
    if (r < 1) return;
    const color = m === "reaction" ? "167,139,250" : "91,184,212";

    // Contact shadow on ground (simple ellipse below)
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx, sy + r * 0.95, r * 0.85, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Main sphere body with strong radial shading (light from upper-left)
    const lx = sx - r * 0.4;
    const ly = sy - r * 0.4;
    const body = ctx.createRadialGradient(lx, ly, r * 0.05, sx, sy, r * 1.05);
    body.addColorStop(0, `rgba(${color},1)`);
    body.addColorStop(0.35, `rgba(${color},0.85)`);
    body.addColorStop(0.75, `rgba(${color},0.35)`);
    body.addColorStop(1, `rgba(20,20,28,0.95)`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Dark rim (terminator)
    ctx.strokeStyle = `rgba(10,10,16,0.6)`;
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.stroke();

    // Specular highlight (small bright spot)
    const spec = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.35);
    spec.addColorStop(0, "rgba(255,255,255,0.9)");
    spec.addColorStop(0.5, "rgba(255,255,255,0.25)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(lx, ly, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Subtle pulse outer ring (only when fresh)
    if (age < 400) {
      const t = 1 - age / 400;
      ctx.strokeStyle = `rgba(${color},${t * 0.8})`;
      ctx.lineWidth = Math.max(1, r * 0.06) * (1 + t * 0.5);
      ctx.beginPath();
      ctx.arc(sx, sy, r * (1.02 + t * 0.15), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Center marker (very subtle, helps you read center)
    void now;
  }

  function drawCrosshair(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 11, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 11, cy);
    ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 11);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    ctx.restore();
  }

  // First-person weapon viewmodel (bottom-right, bobs slightly)
  function drawFPWeapon(ctx: CanvasRenderingContext2D) {
    const kx = recoilRef.current.yaw * 200;
    const ky = recoilRef.current.pitch * 200;
    ctx.save();
    ctx.translate(kx * 0.5, ky * -0.5);

    const baseX = CANVAS_W - 380;
    const baseY = CANVAS_H - 50;

    // Stock
    ctx.fillStyle = "#13131a";
    ctx.beginPath();
    ctx.moveTo(baseX + 220, baseY + 10);
    ctx.lineTo(baseX + 280, baseY + 35);
    ctx.lineTo(baseX + 280, baseY + 80);
    ctx.lineTo(baseX + 220, baseY + 80);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(baseX + 70, baseY - 5, 180, 45);
    // Top rail
    ctx.fillStyle = "#0e0e15";
    ctx.fillRect(baseX + 80, baseY - 12, 160, 6);
    // Optic
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(baseX + 130, baseY - 30, 50, 20);
    ctx.fillStyle = "rgba(91,184,212,0.5)";
    ctx.fillRect(baseX + 142, baseY - 24, 26, 8);
    // Trigger guard
    ctx.fillStyle = "#0c0c12";
    ctx.beginPath();
    ctx.arc(baseX + 175, baseY + 50, 16, 0, Math.PI);
    ctx.fill();
    // Grip
    ctx.fillStyle = "#15151d";
    ctx.beginPath();
    ctx.moveTo(baseX + 180, baseY + 40);
    ctx.lineTo(baseX + 215, baseY + 90);
    ctx.lineTo(baseX + 240, baseY + 90);
    ctx.lineTo(baseX + 205, baseY + 40);
    ctx.closePath();
    ctx.fill();
    // Magazine
    ctx.fillStyle = "#0c0c14";
    ctx.fillRect(baseX + 130, baseY + 40, 28, 35);
    // Barrel
    ctx.fillStyle = "#1c1c24";
    ctx.fillRect(baseX, baseY + 4, 70, 12);
    // Muzzle
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(baseX - 8, baseY + 1, 12, 18);
    // Highlights
    ctx.fillStyle = "rgba(91,184,212,0.12)";
    ctx.fillRect(baseX + 70, baseY - 5, 180, 1);

    ctx.restore();
  }

  // ----- Third-person scene (Peek) -----
  // Mental model: there's a single cover block centered at world (0, 0, 3.5).
  // The PLAYER+camera sits at (camX, 0.5, -2.5) where camX = peek * 1.6 (shifts L/R).
  // When A is held, camera shifts left; the cover block's right edge is now to your right,
  // and you can see PAST the LEFT edge of the cover into the lane. Targets spawn beyond.
  function drawPeekScene(ctx: CanvasRenderingContext2D, isRunning: boolean, now: number) {
    const peek = peekRef.current.offset;
    const cam = camRef.current;
    const totalYaw = cam.yaw + recoilRef.current.yaw;
    const totalPitch = cam.pitch + recoilRef.current.pitch;

    drawSkyAndFloor(ctx, totalPitch);

    const camYOffset = 0.5;
    const camZOffset = -2.5;
    const camXOffset = peek * 1.6;

    // Range floor + back wall (relative to camera position, applying yaw rotation)
    drawRangeWallsPeek3D(ctx, camXOffset, camYOffset, camZOffset, totalYaw, totalPitch);

    // Project targets considering camera position AND camera rotation
    const targets = targetsRef.current;
    const projected = targets.map((t) => {
      const rel: Vec3 = { x: t.pos.x - camXOffset, y: t.pos.y - camYOffset, z: t.pos.z - camZOffset };
      const r1 = rotateY(rel, -totalYaw);
      const r2 = rotateX(r1, -totalPitch);
      const p = project(r2);
      return { t, p, z: r2.z };
    }).filter(o => o.p !== null).sort((a, b) => b.z - a.z);

    for (const { t, p } of projected) {
      if (!p) continue;
      const screenR = t.r * p.scale;
      drawTargetHumanoid(ctx, p.sx, p.sy, screenR, now - t.spawnAt);
    }

    // Cover block (foreground, occludes targets behind it)
    drawCoverBlock3D(ctx, camXOffset, camYOffset, camZOffset, totalYaw, totalPitch);

    // Character viewmodel (over the shoulder, leans with peek)
    drawCharacter(ctx, peek);

    if (isRunning) {
      drawHUD(ctx, "peek", now);
      drawCrosshair(ctx, CANVAS_W / 2, CANVAS_H / 2);
    }
  }

  function drawRangeWallsPeek3D(
    ctx: CanvasRenderingContext2D,
    camX: number, camY: number, camZ: number,
    yaw: number, pitch: number
  ) {
    const transform = (p: Vec3) => {
      const rel = { x: p.x - camX, y: p.y - camY, z: p.z - camZ };
      return project(rotateX(rotateY(rel, -yaw), -pitch));
    };

    // Floor grid
    ctx.strokeStyle = "rgba(91,184,212,0.08)";
    ctx.lineWidth = 1;
    for (let z = 3; z <= 28; z += 2) {
      const a = transform({ x: -14, y: -1.5, z });
      const b = transform({ x: 14, y: -1.5, z });
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
    }
    for (let x = -12; x <= 12; x += 2) {
      const a = transform({ x, y: -1.5, z: 3 });
      const b = transform({ x, y: -1.5, z: 28 });
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
    }
    // Back wall
    const back = [
      { x: -14, y: -3, z: 28 }, { x: 14, y: -3, z: 28 },
      { x: 14, y: 4, z: 28 }, { x: -14, y: 4, z: 28 },
    ].map(transform);
    if (back.every((p) => p)) {
      ctx.beginPath();
      ctx.moveTo(back[0]!.sx, back[0]!.sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(back[i]!.sx, back[i]!.sy);
      ctx.closePath();
      ctx.fillStyle = "rgba(20,20,28,0.45)";
      ctx.fill();
      ctx.strokeStyle = "rgba(91,184,212,0.2)";
      ctx.stroke();
    }
  }

  // Single cover block in world space at (0, ..., 3.5), fully camera-rotated
  function drawCoverBlock3D(
    ctx: CanvasRenderingContext2D,
    camX: number, camY: number, camZ: number,
    yaw: number, pitch: number
  ) {
    const transform = (p: Vec3) => {
      const rel = { x: p.x - camX, y: p.y - camY, z: p.z - camZ };
      return project(rotateX(rotateY(rel, -yaw), -pitch));
    };
    const blockHalfW = 1.6;
    const blockZ = 1.5;
    // Front face
    const front = [
      { x: -blockHalfW, y: -3, z: blockZ },
      { x: blockHalfW, y: -3, z: blockZ },
      { x: blockHalfW, y: 2.5, z: blockZ },
      { x: -blockHalfW, y: 2.5, z: blockZ },
    ].map(transform);
    if (front.every((p) => p)) {
      ctx.beginPath();
      ctx.moveTo(front[0]!.sx, front[0]!.sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(front[i]!.sx, front[i]!.sy);
      ctx.closePath();
      ctx.fillStyle = "#0c0c14";
      ctx.fill();
      ctx.strokeStyle = "rgba(91,184,212,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Horizontal stripes for texture
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let y = -3; y <= 2.5; y += 0.4) {
        const a = transform({ x: -blockHalfW, y, z: blockZ });
        const b = transform({ x: blockHalfW, y, z: blockZ });
        if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
      }
    }
    // Top edge highlight
    const topEdge = [
      { x: -blockHalfW, y: 2.5, z: blockZ },
      { x: blockHalfW, y: 2.5, z: blockZ },
    ].map(transform);
    if (topEdge.every((p) => p)) {
      ctx.strokeStyle = "rgba(167,139,250,0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(topEdge[0]!.sx, topEdge[0]!.sy);
      ctx.lineTo(topEdge[1]!.sx, topEdge[1]!.sy);
      ctx.stroke();
    }
  }

  function drawRangeWallsPeek(ctx: CanvasRenderingContext2D, camZ: number, camY: number) {
    // Floor grid lines in world space
    ctx.strokeStyle = "rgba(91,184,212,0.08)";
    ctx.lineWidth = 1;
    for (let z = 3; z <= 25; z += 2) {
      const a = project({ x: -12, y: -1.5 - camY, z: z - camZ });
      const b = project({ x: 12, y: -1.5 - camY, z: z - camZ });
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }
    for (let x = -10; x <= 10; x += 2) {
      const a = project({ x, y: -1.5 - camY, z: 3 - camZ });
      const b = project({ x, y: -1.5 - camY, z: 25 - camZ });
      if (a && b) {
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }
    // Back wall
    const backCorners = [
      { x: -12, y: -3 - camY, z: 25 - camZ },
      { x: 12, y: -3 - camY, z: 25 - camZ },
      { x: 12, y: 4 - camY, z: 25 - camZ },
      { x: -12, y: 4 - camY, z: 25 - camZ },
    ];
    const bp = backCorners.map(project);
    if (bp.every((p) => p)) {
      ctx.beginPath();
      ctx.moveTo(bp[0]!.sx, bp[0]!.sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(bp[i]!.sx, bp[i]!.sy);
      ctx.closePath();
      ctx.fillStyle = "rgba(20,20,28,0.45)";
      ctx.fill();
      ctx.strokeStyle = "rgba(91,184,212,0.2)";
      ctx.stroke();
    }
  }

  // Background cover (the wall in front of the player)
  function drawCoverWall(ctx: CanvasRenderingContext2D, peek: number, camZ: number, camY: number) {
    // Cover wall at z = 2.5 (in world), full height
    // We draw it later in foreground for occlusion
    void peek; void camZ; void camY;
  }

  // Single center cover block. Player peeks AROUND the corner.
  // When peek=+1 (D), player's body shifts right so they can see past the right edge.
  // When peek=-1 (A), player shifts left, sees past left edge.
  function drawCoverWallForeground(ctx: CanvasRenderingContext2D, peek: number) {
    // Cover block in world space, centered at x=0 (NOT shifted by peek).
    // The PLAYER shifts left/right via camera offset, so peeking around the edge happens naturally.
    // We compute the camera's x position from peek (handled in drawPeekScene + hit tests).
    const camXOffset = peek * 1.6; // camera shifts horizontally
    const camZ = -2.5, camY = 0.5;
    const wallZ = 3.5 - camZ; // 6.0

    // Single cover block: 2.4 units wide, full height
    const blockHalfW = 1.2;
    const corners = [
      { x: -blockHalfW - camXOffset, y: -3 - camY, z: wallZ },
      { x: blockHalfW - camXOffset, y: -3 - camY, z: wallZ },
      { x: blockHalfW - camXOffset, y: 4 - camY, z: wallZ },
      { x: -blockHalfW - camXOffset, y: 4 - camY, z: wallZ },
    ];
    const p = corners.map(project);
    if (p.every((x) => x)) {
      ctx.beginPath();
      ctx.moveTo(p[0]!.sx, p[0]!.sy);
      for (let i = 1; i < 4; i++) ctx.lineTo(p[i]!.sx, p[i]!.sy);
      ctx.closePath();
      ctx.fillStyle = "#0c0c14";
      ctx.fill();
      ctx.strokeStyle = "rgba(91,184,212,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Wall texture lines (horizontal stripes for concrete feel)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let y = -3; y < 4; y += 0.35) {
      const a = project({ x: -blockHalfW - camXOffset, y: y - camY, z: wallZ });
      const b = project({ x: blockHalfW - camXOffset, y: y - camY, z: wallZ });
      if (a && b) { ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke(); }
    }
  }

  // Humanoid target for peek mode
  function drawTargetHumanoid(ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, age: number) {
    if (r < 2) return;
    const color = "239,68,68"; // red
    const accent = "167,139,250"; // purple outline
    // Body
    const bodyW = r * 1.2;
    const bodyH = r * 2.2;
    const bodyX = sx - bodyW / 2;
    const bodyY = sy - r * 0.3;

    // Head
    ctx.beginPath();
    ctx.arc(sx, sy - r * 0.6, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${color})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${accent}, 0.6)`;
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.stroke();

    // Torso
    ctx.fillStyle = `rgb(${color})`;
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH * 0.6);
    ctx.strokeStyle = `rgba(${accent}, 0.6)`;
    ctx.strokeRect(bodyX, bodyY, bodyW, bodyH * 0.6);

    // Legs
    ctx.fillRect(bodyX + bodyW * 0.1, bodyY + bodyH * 0.6, bodyW * 0.35, bodyH * 0.5);
    ctx.fillRect(bodyX + bodyW * 0.55, bodyY + bodyH * 0.6, bodyW * 0.35, bodyH * 0.5);

    // Center hitmarker dot
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(1.5, r * 0.1), 0, Math.PI * 2);
    ctx.fill();

    // Spawn flash
    if (age < 250) {
      ctx.beginPath();
      ctx.arc(sx, sy - r * 0.2, r * 1.4 * (1 + (1 - age / 250) * 0.5), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${(1 - age / 250) * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Third-person character (over the shoulder)
  function drawCharacter(ctx: CanvasRenderingContext2D, peek: number) {
    // Character sits at bottom-center, leans with peek
    const cx = CANVAS_W / 2 + peek * 80;
    const cy = CANVAS_H - 80;
    const tilt = peek * 0.15; // body tilt

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);

    // Back (we see from behind)
    // Torso/jacket
    ctx.fillStyle = "#16161e";
    ctx.beginPath();
    ctx.moveTo(-60, 60);
    ctx.lineTo(60, 60);
    ctx.lineTo(50, -50);
    ctx.lineTo(-50, -50);
    ctx.closePath();
    ctx.fill();
    // Jacket seam
    ctx.strokeStyle = "rgba(91,184,212,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -50); ctx.lineTo(0, 60);
    ctx.stroke();

    // Head/helmet back
    ctx.fillStyle = "#1c1c24";
    ctx.beginPath();
    ctx.arc(0, -75, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(91,184,212,0.3)";
    ctx.stroke();

    // Helmet detail
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(-22, -85, 44, 6);

    // Right shoulder/arm holding rifle
    ctx.fillStyle = "#16161e";
    ctx.fillRect(40, -40, 30, 70);

    // Rifle held forward toward right side
    ctx.save();
    ctx.translate(70, -20);
    ctx.rotate(-0.2);
    // Stock
    ctx.fillStyle = "#13131a";
    ctx.fillRect(-25, -8, 25, 16);
    // Body
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(0, -8, 90, 12);
    // Optic
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(20, -16, 28, 10);
    // Barrel
    ctx.fillStyle = "#1c1c24";
    ctx.fillRect(90, -5, 40, 6);
    // Mag
    ctx.fillStyle = "#0c0c14";
    ctx.fillRect(30, 4, 16, 18);
    ctx.restore();

    ctx.restore();
  }

  function drawHUD(ctx: CanvasRenderingContext2D, m: Mode, now: number) {
    const elapsed = now - startedAtRef.current;
    const remaining = Math.max(0, ROUND_DURATION_MS - elapsed);
    const stats = statsRef.current;

    ctx.save();
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "left";
    ctx.fillText(`TIME ${(remaining / 1000).toFixed(1)}s`, 16, 22);

    ctx.textAlign = "right";
    ctx.fillText(`MODE ${m.toUpperCase()}`, CANVAS_W - 16, 22);

    if (m === "reaction" || m === "peek") {
      const avg = stats.reactionTimes.length ? stats.reactionTimes.reduce((a, b) => a + b, 0) / stats.reactionTimes.length : 0;
      ctx.fillText(`${stats.hits} HIT  ${stats.misses} MISS  ${Math.round(avg)}ms`, CANVAS_W - 16, 40);
    } else if (m === "tracking") {
      const pct = stats.totalMs > 0 ? (stats.onTargetMs / stats.totalMs) * 100 : 0;
      ctx.fillText(`${pct.toFixed(0)}% ON TARGET`, CANVAS_W - 16, 40);
    }

    // Timer bar
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0, 0, CANVAS_W, 3);
    ctx.fillStyle = "rgba(167,139,250,0.7)";
    ctx.fillRect(0, 0, CANVAS_W * (1 - remaining / ROUND_DURATION_MS), 3);
    ctx.restore();
  }

  // Initial idle draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    drawScene(ctx, mode, false, performance.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const modeLabel = mode === "reaction" ? "Reaction" : mode === "tracking" ? "Tracking" : "Peek";

  return (
    <div className="w-full max-w-[960px] mx-auto">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onExit} className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-white transition-colors">← Pick another drill</button>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-text-faint)]">{modeLabel} best</p>
          <p className="font-mono text-xs text-[var(--color-text)]">
            {highScores[mode] !== undefined ? highScores[mode] : "—"}
            <span className="text-[var(--color-text-faint)] ml-1">
              {mode === "reaction" ? "ms" : mode === "tracking" ? "%" : "pts"}
            </span>
          </p>
        </div>
      </div>

      <div className="relative liquid-glass-border rounded-xl overflow-hidden" style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="w-full h-full block cursor-none" />

        {!running && !showResults && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center max-w-md px-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--color-accent-2)] mb-2">
                {modeLabel}, {mode === "peek" ? "Third-Person" : "First-Person"}
              </p>
              <h3 className="font-serif text-3xl text-white mb-3">30-second drill</h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                {mode === "reaction" && "Targets pop in the range. Click each one fast. Score is average reaction time."}
                {mode === "tracking" && "A target strafes through the range. Keep crosshair locked on. Score is % time on target."}
                {mode === "peek" && "Hold A or D to lean from cover. Drop targets crossing the lane."}
              </p>
              <button onClick={startRound} className="liquid-glass-border rounded-full px-8 py-3 text-sm font-medium text-white hover:border-[var(--color-border-glow)] hover:bg-white/5 transition-all">Start</button>
              <p className="mt-4 text-[10px] font-mono text-[var(--color-text-faint)]">Click to lock mouse, ESC to abandon</p>
            </div>
          </div>
        )}

        {showResults && score && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center max-w-md px-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">{modeLabel} result</p>
              <p className="font-mono text-6xl text-white tabular-nums leading-none mb-1">{score.value}</p>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-accent-2)] mb-1">{score.label}</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-6">{score.subtitle}</p>
              <div className="flex items-center justify-center gap-3">
                <button onClick={startRound} className="liquid-glass-border rounded-full px-6 py-2.5 text-sm font-medium text-white hover:border-[var(--color-border-glow)] hover:bg-white/5 transition-all">Run again</button>
                <button onClick={onExit} className="px-6 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors">New drill</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)]">
        <span><span className="text-[var(--color-text-muted)]">Mouse</span> aim</span>
        <span><span className="text-[var(--color-text-muted)]">L-Click</span> fire</span>
        {mode === "peek" && <span><span className="text-[var(--color-text-muted)]">A · D</span> lean</span>}
        <span><span className="text-[var(--color-text-muted)]">ESC</span> abandon</span>
      </div>
    </div>
  );
}
