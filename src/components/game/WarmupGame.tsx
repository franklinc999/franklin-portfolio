"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================
// SENS CONVERSION
// Yaw values (degrees per mouse count at sens 1.0)
// ============================================================
const YAW = {
  valorant: 0.07,
  cod: 0.0066,
  apex: 0.022, // also CS2, Source engine
} as const;

type GameName = keyof typeof YAW;

function cmPer360(dpi: number, sens: number, game: GameName): number {
  // (360 deg * 2.54 cm/inch) / (DPI * sens * yaw_deg_per_count)
  const denom = dpi * sens * YAW[game];
  if (denom <= 0) return 0;
  return (360 * 2.54) / denom;
}

// Translate cm/360 -> in-game pixel sensitivity for our canvas.
// At a given cm/360, we want a 360-deg horizontal sweep to equal that cm
// of physical mouse travel. The browser doesn't know cm directly, but
// movementX comes in mouse counts when pointer is locked. We treat
// movementX as approx mouse counts (browser-dependent, good enough as a feel).
// Map: dx_pixels_in_canvas = dx_mouse_counts * sensFactor
// where sensFactor scales so 360 deg ~= canvasWidth horizontal sweep.
function pixelsPerCount(dpi: number, sens: number, game: GameName, canvasWidth: number): number {
  // pixels per degree:
  const pxPerDeg = canvasWidth / 90; // 90deg FOV horizontally
  // degrees per mouse count:
  const degPerCount = sens * YAW[game];
  return degPerCount * pxPerDeg;
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
      <SettingsScreen
        settings={settings}
        setSettings={setSettings}
        onContinue={() => setScreen("modeSelect")}
      />
    );
  }
  if (screen === "modeSelect") {
    return (
      <ModeSelect
        onPick={(m) => {
          setMode(m);
          setScreen("playing");
        }}
        onBack={() => setScreen("settings")}
        settings={settings}
      />
    );
  }
  return (
    <GameCanvas
      mode={mode}
      settings={settings}
      onExit={() => setScreen("modeSelect")}
    />
  );
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function SettingsScreen({
  settings,
  setSettings,
  onContinue,
}: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  onContinue: () => void;
}) {
  const cm360 = cmPer360(settings.dpi, settings.sens, settings.game);
  const edpi = settings.dpi * settings.sens;

  return (
    <div className="w-full max-w-[960px] mx-auto liquid-glass liquid-glass-border rounded-xl p-8" style={{ minHeight: 600 }}>
      <div className="max-w-md mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2 text-center">
          Step 1 of 2
        </p>
        <h2 className="font-serif text-3xl text-white text-center mb-1">
          Match your <span className="italic text-[var(--color-accent-2)]">sens</span>
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] text-center mb-8">
          So muscle memory carries over to your real games.
        </p>

        {/* Game selector */}
        <label className="block mb-6">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] block mb-2">
            Game profile
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(["valorant", "cod", "apex"] as GameName[]).map((g) => (
              <button
                key={g}
                onClick={() => setSettings({ ...settings, game: g })}
                className={`px-3 py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all border ${
                  settings.game === g
                    ? "bg-[var(--color-accent-2)]/10 border-[var(--color-accent-2)]/40 text-[var(--color-accent-2)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-glow)]"
                }`}
              >
                {g === "valorant" && "Valorant"}
                {g === "cod" && "CoD/MW"}
                {g === "apex" && "Apex/CS"}
              </button>
            ))}
          </div>
        </label>

        {/* DPI */}
        <label className="block mb-5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] block mb-2">
            Mouse DPI
          </span>
          <input
            type="number"
            value={settings.dpi}
            onChange={(e) => setSettings({ ...settings, dpi: Math.max(100, Math.min(20000, Number(e.target.value) || 800)) })}
            className="w-full bg-black/40 border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent-2)] transition-colors"
            min={100}
            max={20000}
            step={50}
          />
        </label>

        {/* In-game sens */}
        <label className="block mb-8">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)] block mb-2">
            In-game sensitivity
          </span>
          <input
            type="number"
            value={settings.sens}
            onChange={(e) => setSettings({ ...settings, sens: Math.max(0.01, Math.min(20, Number(e.target.value) || 0.5)) })}
            className="w-full bg-black/40 border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-[var(--color-accent-2)] transition-colors"
            step={0.01}
            min={0.01}
          />
        </label>

        {/* Calculated readouts */}
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

        <button
          onClick={onContinue}
          className="w-full liquid-glass-border rounded-full px-6 py-3 text-sm font-medium text-white hover:border-[var(--color-border-glow)] hover:bg-white/5 transition-all"
        >
          Continue
        </button>

        <p className="text-[10px] font-mono text-center text-[var(--color-text-faint)] mt-4 leading-relaxed">
          Yaw values: Valorant {YAW.valorant} · CoD {YAW.cod} · Apex/CS {YAW.apex}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// MODE SELECT
// ============================================================
function ModeSelect({
  onPick,
  onBack,
  settings,
}: {
  onPick: (m: Mode) => void;
  onBack: () => void;
  settings: Settings;
}) {
  const cm360 = cmPer360(settings.dpi, settings.sens, settings.game);

  const modes: { id: Mode; title: string; sub: string; body: string }[] = [
    {
      id: "reaction",
      title: "Reaction",
      sub: "Click on flash",
      body: "Targets appear in random spots. Click as fast as you can. Score = average reaction time.",
    },
    {
      id: "tracking",
      title: "Tracking",
      sub: "Stay on target",
      body: "A target moves unpredictably. Keep the crosshair on it. Score = % of time you were locked.",
    },
    {
      id: "peek",
      title: "Peek",
      sub: "Lean and shoot",
      body: "Hold A or D to peek out of cover. Targets cross the lane briefly. Kill before they're gone.",
    },
  ];

  return (
    <div className="w-full max-w-[960px] mx-auto liquid-glass liquid-glass-border rounded-xl p-8" style={{ minHeight: 600 }}>
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          ← Settings
        </button>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--color-text-faint)]">Locked at</p>
          <p className="font-mono text-xs text-[var(--color-text)]">{cm360.toFixed(1)} cm / 360 · {settings.game.toUpperCase()}</p>
        </div>
      </div>

      <div className="text-center mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
          Step 2 of 2
        </p>
        <h2 className="font-serif text-3xl text-white">
          Pick a <span className="italic text-[var(--color-accent-2)]">drill</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            className="liquid-glass-border rounded-xl p-5 text-left hover:bg-white/5 hover:border-[var(--color-border-glow)] transition-all group"
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-accent-2)] mb-1">{m.sub}</p>
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
const ROUND_DURATION_MS = 30000; // 30s rounds

interface Target {
  x: number;
  y: number;
  r: number;
  vx?: number;
  vy?: number;
  spawnAt: number;
  hp?: number;
  lifeMs?: number;
}

function GameCanvas({
  mode,
  settings,
  onExit,
}: {
  mode: Mode;
  settings: Settings;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState<{ value: number; label: string; subtitle: string } | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Crosshair position (canvas-local)
  const crossRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  // Recoil offset for crosshair (returns to zero)
  const recoilRef = useRef({ x: 0, y: 0 });
  // Camera shake
  const shakeRef = useRef(0);
  // Muzzle flash timer
  const flashRef = useRef(0);

  // Targets currently alive
  const targetsRef = useRef<Target[]>([]);

  // Stats
  const statsRef = useRef({
    hits: 0,
    misses: 0,
    reactionTimes: [] as number[], // ms from spawn to hit
    onTargetMs: 0,
    totalMs: 0,
    spawned: 0,
  });

  // Round timer
  const startedAtRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Peek state
  const peekRef = useRef({ offset: 0, target: 0 }); // -1 = left peek, 0 = covered, +1 = right peek

  const pxPerCountRef = useRef(pixelsPerCount(settings.dpi, settings.sens, settings.game, CANVAS_W));
  useEffect(() => {
    pxPerCountRef.current = pixelsPerCount(settings.dpi, settings.sens, settings.game, CANVAS_W);
  }, [settings]);

  // Keys
  const keysRef = useRef<{ [k: string]: boolean }>({});

  // High scores
  const [highScores, setHighScores] = useState<{ [k in Mode]?: number }>({});
  useEffect(() => {
    try {
      const stored = localStorage.getItem("warmup-highscores");
      if (stored) setHighScores(JSON.parse(stored));
    } catch {}
  }, []);

  const saveHighScore = useCallback((m: Mode, value: number, betterIsLower: boolean) => {
    setHighScores((prev) => {
      const current = prev[m];
      let next = prev;
      if (current === undefined || (betterIsLower ? value < current : value > current)) {
        next = { ...prev, [m]: value };
        try {
          localStorage.setItem("warmup-highscores", JSON.stringify(next));
        } catch {}
      }
      return next;
    });
  }, []);

  // ===== Start round =====
  const startRound = useCallback(() => {
    statsRef.current = { hits: 0, misses: 0, reactionTimes: [], onTargetMs: 0, totalMs: 0, spawned: 0 };
    targetsRef.current = [];
    crossRef.current = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    recoilRef.current = { x: 0, y: 0 };
    shakeRef.current = 0;
    flashRef.current = 0;
    peekRef.current = { offset: 0, target: 0 };
    startedAtRef.current = performance.now();
    lastFrameRef.current = performance.now();
    setScore(null);
    setShowResults(false);
    setRunning(true);

    // Lock pointer for FPS feel
    const canvas = canvasRef.current;
    if (canvas) canvas.requestPointerLock();
  }, []);

  // ===== End round =====
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
      subtitle = `${s.hits} hit · ${s.misses} miss`;
      betterIsLower = true;
    } else if (mode === "tracking") {
      const pct = s.totalMs > 0 ? (s.onTargetMs / s.totalMs) * 100 : 0;
      value = Math.round(pct);
      label = "% on target";
      subtitle = `${(s.totalMs / 1000).toFixed(1)}s tracked`;
      betterIsLower = false;
    } else {
      // peek: composite score = hits * 100 - misses * 20 + speed bonus
      const speedBonus = s.reactionTimes.length
        ? Math.max(0, 800 - s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length)
        : 0;
      value = Math.round(s.hits * 100 - s.misses * 20 + speedBonus);
      label = "peek score";
      subtitle = `${s.hits} kills · ${s.misses} miss · ${s.reactionTimes.length ? Math.round(s.reactionTimes.reduce((a, b) => a + b, 0) / s.reactionTimes.length) : 0}ms avg`;
    }
    saveHighScore(mode, value, betterIsLower);
    setScore({ value, label, subtitle });
    setShowResults(true);
  }, [mode, saveHighScore]);

  // ===== Input handlers =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!running) return;
      const pxFactor = pxPerCountRef.current;
      // movementX is in mouse counts (approx). Scale by our sens factor.
      crossRef.current.x += e.movementX * pxFactor;
      crossRef.current.y += e.movementY * pxFactor;
      // Clamp inside canvas
      crossRef.current.x = Math.max(0, Math.min(CANVAS_W, crossRef.current.x));
      crossRef.current.y = Math.max(0, Math.min(CANVAS_H, crossRef.current.y));
    };

    const handleClick = (e: MouseEvent) => {
      if (!running) return;
      if (e.button !== 0) return;
      // Fire
      flashRef.current = 100; // 100ms flash
      shakeRef.current = 6;
      // Recoil kick: random small upward + side
      recoilRef.current.y -= 6 + Math.random() * 3;
      recoilRef.current.x += (Math.random() - 0.5) * 4;

      const cross = crossRef.current;
      // Test hits
      const targets = targetsRef.current;
      let hit = false;
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        // For peek mode, only count if target visible (we draw based on offset)
        const dx = cross.x - t.x;
        const dy = cross.y - t.y;
        if (dx * dx + dy * dy <= t.r * t.r) {
          hit = true;
          // record reaction time
          statsRef.current.reactionTimes.push(performance.now() - t.spawnAt);
          statsRef.current.hits++;
          targets.splice(i, 1);
          break;
        }
      }
      if (!hit) statsRef.current.misses++;
    };

    const handleKey = (e: KeyboardEvent, down: boolean) => {
      keysRef.current[e.key.toLowerCase()] = down;
      if (down && e.key === "Escape" && running) {
        endRound();
      }
    };

    const keyDown = (e: KeyboardEvent) => handleKey(e, true);
    const keyUp = (e: KeyboardEvent) => handleKey(e, false);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    const handlePointerLockChange = () => {
      // If user escapes pointer lock during play, pause
      if (running && document.pointerLockElement !== canvas) {
        // give them a chance to re-engage by clicking
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [running, endRound]);

  // ===== Game loop =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const loop = (now: number) => {
      const dt = Math.min(50, now - lastFrameRef.current);
      lastFrameRef.current = now;

      if (running) {
        // Update
        const elapsed = now - startedAtRef.current;
        if (elapsed >= ROUND_DURATION_MS) {
          endRound();
        } else {
          updateMode(mode, dt, now);
        }

        // Decay recoil + shake + flash
        recoilRef.current.x *= Math.pow(0.001, dt / 1000);
        recoilRef.current.y *= Math.pow(0.001, dt / 1000);
        recoilRef.current.x += (0 - recoilRef.current.x) * 0.15;
        recoilRef.current.y += (0 - recoilRef.current.y) * 0.15;
        shakeRef.current *= Math.pow(0.001, dt / 1000);
        flashRef.current = Math.max(0, flashRef.current - dt);

        // Track tracking-mode on-target time
        if (mode === "tracking") {
          statsRef.current.totalMs += dt;
          const t = targetsRef.current[0];
          if (t) {
            const cross = crossRef.current;
            const dx = cross.x - t.x;
            const dy = cross.y - t.y;
            if (dx * dx + dy * dy <= t.r * t.r) {
              statsRef.current.onTargetMs += dt;
            }
          }
        }
      }

      // Draw
      drawScene(ctx, mode, running, now);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode, endRound]);

  // ===== Mode-specific update =====
  function updateMode(m: Mode, dt: number, now: number) {
    const targets = targetsRef.current;
    const stats = statsRef.current;

    if (m === "reaction") {
      // Always 1 target on screen. If none, spawn after a small delay.
      if (targets.length === 0) {
        // 200-600ms delay between targets
        if (Math.random() < dt / 400) {
          targets.push({
            x: 80 + Math.random() * (CANVAS_W - 160),
            y: 100 + Math.random() * (CANVAS_H - 200),
            r: 22,
            spawnAt: now,
            lifeMs: 1500,
          });
          stats.spawned++;
        }
      } else {
        // expire stale
        const t = targets[0];
        if (now - t.spawnAt > (t.lifeMs ?? 1500)) {
          targets.shift();
          stats.misses++;
        }
      }
    } else if (m === "tracking") {
      if (targets.length === 0) {
        targets.push({
          x: CANVAS_W / 2,
          y: CANVAS_H / 2,
          r: 28,
          vx: 120 + Math.random() * 80,
          vy: 60 + Math.random() * 40,
          spawnAt: now,
        });
      }
      const t = targets[0];
      // Smooth random direction changes
      if (Math.random() < dt / 700) {
        t.vx = (Math.random() - 0.5) * 380;
      }
      if (Math.random() < dt / 700) {
        t.vy = (Math.random() - 0.5) * 220;
      }
      t.x += (t.vx ?? 0) * dt / 1000;
      t.y += (t.vy ?? 0) * dt / 1000;
      // Bounce
      if (t.x < t.r + 40) { t.x = t.r + 40; t.vx = Math.abs(t.vx ?? 0); }
      if (t.x > CANVAS_W - t.r - 40) { t.x = CANVAS_W - t.r - 40; t.vx = -Math.abs(t.vx ?? 0); }
      if (t.y < t.r + 60) { t.y = t.r + 60; t.vy = Math.abs(t.vy ?? 0); }
      if (t.y > CANVAS_H - t.r - 60) { t.y = CANVAS_H - t.r - 60; t.vy = -Math.abs(t.vy ?? 0); }
    } else if (m === "peek") {
      // Smoothly approach the peek target based on A / D
      const keys = keysRef.current;
      let target = 0;
      if (keys["a"]) target = -1;
      if (keys["d"]) target = 1;
      peekRef.current.target = target;
      // ease offset toward target
      const speed = 0.012; // peek speed
      peekRef.current.offset += (target - peekRef.current.offset) * speed * dt;

      // Spawn targets that cross the lane
      if (targets.length === 0 && Math.random() < dt / 500) {
        const fromLeft = Math.random() > 0.5;
        targets.push({
          x: fromLeft ? -30 : CANVAS_W + 30,
          y: CANVAS_H / 2 + (Math.random() - 0.5) * 200,
          r: 22,
          vx: (fromLeft ? 1 : -1) * (180 + Math.random() * 80),
          vy: 0,
          spawnAt: now,
          lifeMs: 4000,
        });
        stats.spawned++;
      }

      // Move targets
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        t.x += (t.vx ?? 0) * dt / 1000;
        if (t.x < -60 || t.x > CANVAS_W + 60 || now - t.spawnAt > (t.lifeMs ?? 4000)) {
          targets.splice(i, 1);
        }
      }
    }
  }

  // ===== Draw =====
  function drawScene(ctx: CanvasRenderingContext2D, m: Mode, isRunning: boolean, now: number) {
    // Camera shake offset
    const sh = shakeRef.current;
    const shakeX = (Math.random() - 0.5) * sh;
    const shakeY = (Math.random() - 0.5) * sh;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, "#0a0a0c");
    bgGrad.addColorStop(1, "#111118");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Floor grid
    ctx.strokeStyle = "rgba(91,184,212,0.05)";
    ctx.lineWidth = 1;
    const horizon = CANVAS_H * 0.62;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = (i / 16) * CANVAS_W;
      ctx.moveTo(x, horizon);
      // perspective: lines converge
      const fxOffset = (x - CANVAS_W / 2) * 0.4;
      ctx.lineTo(CANVAS_W / 2 + fxOffset * 3, CANVAS_H);
    }
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const y = horizon + (1 - t * t) * 0; // perspective ish
      const yPos = horizon + (CANVAS_H - horizon) * (t * t);
      ctx.moveTo(0, yPos);
      ctx.lineTo(CANVAS_W, yPos);
    }
    ctx.stroke();

    // Horizon line glow
    ctx.strokeStyle = "rgba(167,139,250,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(CANVAS_W, horizon);
    ctx.stroke();

    if (m === "peek") {
      drawPeekScene(ctx, now);
    } else {
      drawTargets(ctx, m, now);
    }

    // HUD overlay
    if (isRunning) {
      drawHUD(ctx, m, now);
      drawCrosshair(ctx);
      drawWeapon(ctx);
    }

    ctx.restore();

    // Muzzle flash (additive)
    if (flashRef.current > 0 && isRunning) {
      const alpha = flashRef.current / 100;
      const flashGrad = ctx.createRadialGradient(CANVAS_W / 2 + 40, CANVAS_H - 70, 0, CANVAS_W / 2 + 40, CANVAS_H - 70, 200);
      flashGrad.addColorStop(0, `rgba(255,220,120,${alpha * 0.8})`);
      flashGrad.addColorStop(0.3, `rgba(255,140,40,${alpha * 0.4})`);
      flashGrad.addColorStop(1, "rgba(255,100,40,0)");
      ctx.fillStyle = flashGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function drawTargets(ctx: CanvasRenderingContext2D, m: Mode, now: number) {
    const targets = targetsRef.current;
    for (const t of targets) {
      const age = now - t.spawnAt;
      const pulse = 1 + Math.sin(now / 150) * 0.05;

      // Outer ring
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = m === "reaction" ? "#a78bfa" : "#5bb8d4";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * 0.55, 0, Math.PI * 2);
      const fillGrad = ctx.createRadialGradient(t.x, t.y - t.r * 0.2, 0, t.x, t.y, t.r * 0.55);
      fillGrad.addColorStop(0, m === "reaction" ? "rgba(167,139,250,0.7)" : "rgba(91,184,212,0.7)");
      fillGrad.addColorStop(1, m === "reaction" ? "rgba(167,139,250,0.2)" : "rgba(91,184,212,0.2)");
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Fade-in flash on spawn (first 200ms)
      if (age < 200) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * (1 + (1 - age / 200) * 0.8), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${(1 - age / 200) * 0.6})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawPeekScene(ctx: CanvasRenderingContext2D, now: number) {
    const peek = peekRef.current.offset; // -1..1
    // Draw moving targets in the lane
    drawTargets(ctx, "peek", now);

    // Cover wall: two slabs left and right, with a gap that "opens" as you peek
    // The world is fixed; peeking shifts the WALL visually opposite direction to simulate body leaning.
    const wallY = 0;
    const wallH = CANVAS_H;
    const baseGap = 100; // visible slit when not peeking
    const peekGap = baseGap + Math.abs(peek) * 200;

    // The slit shifts opposite to peek direction (peek right -> slit reveals right side)
    const slitCenter = CANVAS_W / 2 - peek * 200;

    ctx.fillStyle = "#0c0c12";
    // Left slab
    const leftEnd = slitCenter - peekGap / 2;
    ctx.fillRect(0, wallY, leftEnd, wallH);
    // Right slab
    const rightStart = slitCenter + peekGap / 2;
    ctx.fillRect(rightStart, wallY, CANVAS_W - rightStart, wallH);

    // Wall edges (iridescent)
    ctx.fillStyle = "rgba(91,184,212,0.4)";
    ctx.fillRect(leftEnd - 1, wallY, 2, wallH);
    ctx.fillRect(rightStart - 1, wallY, 2, wallH);

    // Wall texture overlay
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let y = 0; y < CANVAS_H; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(leftEnd, y);
      ctx.moveTo(rightStart, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
  }

  function drawCrosshair(ctx: CanvasRenderingContext2D) {
    const cx = crossRef.current.x + recoilRef.current.x;
    const cy = crossRef.current.y + recoilRef.current.y;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy);
    ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4);
    ctx.lineTo(cx, cy + 12);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(cx - 1, cy - 1, 2, 2);
    ctx.restore();
  }

  function drawWeapon(ctx: CanvasRenderingContext2D) {
    // Stylized gun in lower right, kicks up with recoil
    const kx = recoilRef.current.x;
    const ky = recoilRef.current.y;
    const baseX = CANVAS_W - 240;
    const baseY = CANVAS_H - 60 + ky * 0.5;

    ctx.save();
    ctx.translate(kx * 0.3, ky * 0.6);

    // Barrel
    ctx.fillStyle = "#1c1c24";
    ctx.fillRect(baseX, baseY - 6, 200, 14);
    // Barrel highlight
    ctx.fillStyle = "rgba(91,184,212,0.15)";
    ctx.fillRect(baseX, baseY - 6, 200, 2);
    // Body
    ctx.fillStyle = "#15151d";
    ctx.fillRect(baseX + 40, baseY + 4, 130, 40);
    // Trigger guard
    ctx.fillStyle = "#0c0c12";
    ctx.fillRect(baseX + 90, baseY + 30, 18, 18);
    // Grip
    ctx.fillStyle = "#1c1c24";
    ctx.beginPath();
    ctx.moveTo(baseX + 110, baseY + 44);
    ctx.lineTo(baseX + 140, baseY + 80);
    ctx.lineTo(baseX + 165, baseY + 80);
    ctx.lineTo(baseX + 145, baseY + 44);
    ctx.closePath();
    ctx.fill();
    // Sight
    ctx.fillStyle = "#0c0c12";
    ctx.fillRect(baseX + 70, baseY - 18, 30, 12);
    ctx.fillStyle = "rgba(91,184,212,0.4)";
    ctx.fillRect(baseX + 80, baseY - 14, 10, 4);

    // Magazine
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(baseX + 70, baseY + 44, 20, 22);

    ctx.restore();
  }

  function drawHUD(ctx: CanvasRenderingContext2D, m: Mode, now: number) {
    const elapsed = now - startedAtRef.current;
    const remaining = Math.max(0, ROUND_DURATION_MS - elapsed);
    const stats = statsRef.current;

    ctx.save();
    ctx.font = "11px ui-monospace, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.6)";

    // Top-left: time
    ctx.fillText(`TIME ${(remaining / 1000).toFixed(1)}s`, 16, 22);

    // Top-right: mode + stats
    ctx.textAlign = "right";
    ctx.fillText(`MODE ${m.toUpperCase()}`, CANVAS_W - 16, 22);

    if (m === "reaction" || m === "peek") {
      const avg = stats.reactionTimes.length ? stats.reactionTimes.reduce((a, b) => a + b, 0) / stats.reactionTimes.length : 0;
      ctx.fillText(`${stats.hits} HIT · ${stats.misses} MISS · ${Math.round(avg)}ms`, CANVAS_W - 16, 40);
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

  // Initial draw before play
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
        <button
          onClick={onExit}
          className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          ← Pick another drill
        </button>
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
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full h-full block cursor-none"
        />

        {/* Overlays */}
        {!running && !showResults && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center max-w-md px-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--color-accent-2)] mb-2">
                {modeLabel}
              </p>
              <h3 className="font-serif text-3xl text-white mb-3">
                30-second drill
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                {mode === "reaction" && "Click each target as soon as you see it. Score = average ms."}
                {mode === "tracking" && "Keep your crosshair on the moving target. Score = % time locked."}
                {mode === "peek" && "Hold A or D to lean. Click targets crossing the lane."}
              </p>
              <button
                onClick={startRound}
                className="liquid-glass-border rounded-full px-8 py-3 text-sm font-medium text-white hover:border-[var(--color-border-glow)] hover:bg-white/5 transition-all"
              >
                Start
              </button>
              <p className="mt-4 text-[10px] font-mono text-[var(--color-text-faint)]">
                Click to lock mouse · ESC to abandon
              </p>
            </div>
          </div>
        )}

        {showResults && score && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center max-w-md px-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--color-text-faint)] mb-2">
                {modeLabel} · result
              </p>
              <p className="font-mono text-6xl text-white tabular-nums leading-none mb-1">{score.value}</p>
              <p className="text-xs font-mono uppercase tracking-widest text-[var(--color-accent-2)] mb-1">{score.label}</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-6">{score.subtitle}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={startRound}
                  className="liquid-glass-border rounded-full px-6 py-2.5 text-sm font-medium text-white hover:border-[var(--color-border-glow)] hover:bg-white/5 transition-all"
                >
                  Run again
                </button>
                <button
                  onClick={onExit}
                  className="px-6 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
                >
                  New drill
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls reference */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-faint)]">
        <span><span className="text-[var(--color-text-muted)]">Mouse</span> aim</span>
        <span><span className="text-[var(--color-text-muted)]">L-Click</span> fire</span>
        {mode === "peek" && <span><span className="text-[var(--color-text-muted)]">A · D</span> lean</span>}
        <span><span className="text-[var(--color-text-muted)]">ESC</span> abandon</span>
      </div>
    </div>
  );
}
