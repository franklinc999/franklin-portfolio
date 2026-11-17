"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/components/play/sound";
import { RangeEngine, type Drill, type RangeStats } from "./RangeEngine";

/* Degrees turned per mouse count at sensitivity 1, as each game defines it. */
const GAMES = [
  { name: "Valorant", yaw: 0.07, sens: 0.5, hfov: 103 },
  { name: "Call of Duty", yaw: 0.0066, sens: 6, hfov: 100 },
  { name: "Apex", yaw: 0.022, sens: 1.6, hfov: 104 },
] as const;

const DRILLS: { id: Drill; name: string; what: string }[] = [
  { id: "pop", name: "Pop", what: "Three targets up at once. Flick, click, next." },
  { id: "pin", name: "Pin", what: "One small target, far away. Slow down and be exact." },
  { id: "ride", name: "Ride", what: "Hold fire and stay on a target that keeps changing its mind." },
  { id: "peek", name: "Peek", what: "Something leans out from cover for a second. Punish it." },
];

const ROUND = 30;
const KEY = "range-settings";

type Settings = { game: number; sens: string; dpi: string; hfov: number; drill: Drill; muted: boolean };
type Phase = "menu" | "playing" | "paused" | "done";

const DEFAULTS: Settings = { game: 0, sens: "0.5", dpi: "800", hfov: 103, drill: "pop", muted: false };

function load(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Fresh settings are fine.
  }
  return DEFAULTS;
}

export default function RangeGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RangeEngine | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const currentDrill = useRef<Drill>("pop");
  const wantsLock = useRef(false);

  const [phase, setPhase] = useState<Phase>("menu");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<RangeStats | null>(null);
  const [best, setBest] = useState(0);
  const [locked, setLocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const game = GAMES[settings.game];
  const sens = parseFloat(settings.sens);
  const dpi = parseFloat(settings.dpi);
  const valid = sens > 0 && dpi > 0;
  const degPerCount = valid ? game.yaw * sens : game.yaw * game.sens;
  const turn = valid ? (360 * 2.54) / (dpi * sens * game.yaw) : 0;

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Saved settings are read after mount, so the server and the first paint agree.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSettings(load());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Not remembered, which is fine.
    }
    sound.setMuted(settings.muted);
  }, [settings, ready]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let engine: RangeEngine;
    try {
      engine = new RangeEngine(
        canvas,
        (s) => setStats(s),
        (s) => {
          if (document.pointerLockElement) document.exitPointerLock();
          setStats(s);
          setBest((b) => {
            const key = `range-best-${currentDrill.current}`;
            let stored = 0;
            try {
              stored = Number(window.localStorage.getItem(key)) || 0;
              if (s.score > stored) window.localStorage.setItem(key, String(s.score));
            } catch {
              // Best scores are a nicety.
            }
            return Math.max(b, stored, s.score);
          });
          phaseRef.current = "done";
          setPhase("done");
        },
      );
    } catch {
      const id = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(id);
    }
    engineRef.current = engine;
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(stage);

    // The automated check plays through the cursor and needs to see the targets.
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __range?: unknown }).__range = engine;
    }

    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) engine.look(e.movementX, e.movementY);
    };
    const onLock = () => {
      const has = document.pointerLockElement === canvas;
      setLocked(has);
      // Escape releases the mouse; treat that as a pause.
      if (!has && phaseRef.current === "playing" && wantsLock.current) {
        engine.setPaused(true);
        phaseRef.current = "paused";
        setPhase("paused");
      }
    };
    const onUp = () => engine.fire(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("pointerlockchange", onLock);
    window.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onLock);
      window.removeEventListener("pointerup", onUp);
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    currentDrill.current = settings.drill;
    engineRef.current?.setOptions({ drill: settings.drill, degPerCount, hfov: settings.hfov, duration: ROUND });
  }, [settings.drill, settings.hfov, degPerCount]);

  const lock = async () => {
    const canvas = canvasRef.current;
    const cursorOnly = new URLSearchParams(window.location.search).get("aim") === "cursor";
    const fine = window.matchMedia("(pointer: fine)").matches;
    wantsLock.current = fine && !cursorOnly && !!canvas?.requestPointerLock;
    if (!canvas || !wantsLock.current) return;
    try {
      // Raw counts, without the system's pointer acceleration, where the browser offers them.
      await (canvas as HTMLCanvasElement & { requestPointerLock(o?: { unadjustedMovement: boolean }): Promise<void> | void }).requestPointerLock({
        unadjustedMovement: true,
      });
    } catch {
      try {
        await canvas.requestPointerLock();
      } catch {
        wantsLock.current = false;
      }
    }
  };

  const start = async () => {
    let stored = 0;
    try {
      stored = Number(window.localStorage.getItem(`range-best-${settings.drill}`)) || 0;
    } catch {
      // No best yet.
    }
    setBest(stored);
    await lock();
    engineRef.current?.setPaused(false);
    engineRef.current?.start();
    go("playing");
  };

  const resume = async () => {
    await lock();
    engineRef.current?.setPaused(false);
    go("playing");
  };

  const toMenu = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    engineRef.current?.stop();
    engineRef.current?.setPaused(false);
    go("menu");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine || phaseRef.current !== "playing") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (document.pointerLockElement === e.currentTarget) {
      engine.fire(true);
      return;
    }
    // No pointer lock (touch, or the browser said no): shoot where the pointer is.
    const r = e.currentTarget.getBoundingClientRect();
    engine.fire(true, { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) });
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const accuracy = stats && stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  const drill = DRILLS.find((d) => d.id === settings.drill) ?? DRILLS[0];

  return (
    <div ref={stageRef} className="game-stage range" data-phase={phase} data-locked={locked ? "" : undefined}>
      <canvas ref={canvasRef} className="game-canvas" onPointerDown={onPointerDown} aria-label="The firing range" />

      {phase === "playing" && stats && (
        <div className="game-hud" aria-hidden="true">
          <p className="game-hud-main">{Math.ceil(stats.left)}</p>
          <dl className="game-hud-side">
            <div>
              <dt>Score</dt>
              <dd>{stats.score}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{accuracy}%</dd>
            </div>
            <div>
              <dt>Streak</dt>
              <dd>{stats.streak}</dd>
            </div>
          </dl>
          {locked && <span className="range-cross" />}
          <p className="game-hud-foot">
            {drill.name}
            {locked ? ". Esc to pause." : ""}
          </p>
        </div>
      )}

      {failed && (
        <div className="game-panel">
          <h2 className="h-pixel game-title">No 3D here</h2>
          <p>This browser would not start WebGL, so the range cannot draw. It works in current Chrome, Edge, Safari and Firefox.</p>
        </div>
      )}

      {phase === "menu" && !failed && (
        <div className="game-panel range-menu">
          <fieldset className="range-drills">
            <legend className="meta">Pick a drill</legend>
            {DRILLS.map((d) => (
              <label key={d.id} className="range-drill">
                <input type="radio" name="drill" checked={settings.drill === d.id} onChange={() => set("drill", d.id)} />
                <span>
                  <b>{d.name}</b>
                  {d.what}
                </span>
              </label>
            ))}
          </fieldset>

          <div className="range-settings">
            <fieldset className="seg range-mouse-only" aria-label="Match the sensitivity of">
              {GAMES.map((g, i) => (
                <label key={g.name} className="seg-item">
                  <input
                    type="radio"
                    name="range-game"
                    checked={settings.game === i}
                    onChange={() => setSettings((s) => ({ ...s, game: i, sens: String(g.sens), hfov: g.hfov }))}
                  />
                  <span>{g.name}</span>
                </label>
              ))}
            </fieldset>
            <div className="range-fields range-mouse-only">
              <label className="field-row">
                <span>Sensitivity in {game.name}</span>
                <input inputMode="decimal" value={settings.sens} onChange={(e) => set("sens", e.target.value)} aria-invalid={!(sens > 0)} />
              </label>
              <label className="field-row">
                <span>Mouse DPI</span>
                <input inputMode="numeric" value={settings.dpi} onChange={(e) => set("dpi", e.target.value)} aria-invalid={!(dpi > 0)} />
              </label>
            </div>
            <label className="dial">
              <span>Field of view</span>
              <output>{settings.hfov}°</output>
              <input type="range" min={70} max={120} step={1} value={settings.hfov} onChange={(e) => set("hfov", Number(e.target.value))} />
            </label>
            <p className="range-note range-touch-only">Tap a target to shoot it. With a mouse, the range matches your sensitivity from the game you play.</p>
            <p className="range-note range-mouse-only">{valid ? `One full turn takes ${turn.toFixed(1)} cm of mouse, the same as in ${game.name}.` : "Enter a sensitivity and DPI above zero."}</p>
            <div className="game-actions">
              <button type="button" className="btn btn-solid" onClick={start} disabled={!valid}>
                Start, 30 seconds
              </button>
              <button type="button" className="btn btn-glass" aria-pressed={settings.muted} onClick={() => set("muted", !settings.muted)}>
                {settings.muted ? "Sound off" : "Sound on"}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "paused" && (
        <div className="game-panel game-panel-small">
          <h2 className="h-pixel game-title">Paused</h2>
          <div className="game-actions">
            <button type="button" className="btn btn-solid" onClick={resume}>
              Back in
            </button>
            <button type="button" className="btn btn-glass" onClick={toMenu}>
              Change drill
            </button>
          </div>
        </div>
      )}

      {phase === "done" && stats && (
        <div className="game-panel game-panel-small" role="status">
          <h2 className="h-pixel game-title">{stats.score}</h2>
          <p className="range-note">{stats.score >= best && stats.score > 0 ? `New best on ${drill.name}.` : `Your best on ${drill.name} is ${best}.`}</p>
          <dl className="game-result">
            <div>
              <dt>Accuracy</dt>
              <dd>{accuracy}%</dd>
            </div>
            <div>
              <dt>Hits</dt>
              <dd>{stats.hits}</dd>
            </div>
            <div>
              <dt>Best streak</dt>
              <dd>{stats.bestStreak}</dd>
            </div>
            <div>
              <dt>Between hits</dt>
              <dd>{stats.pace ? `${stats.pace} ms` : "n/a"}</dd>
            </div>
          </dl>
          <div className="game-actions">
            <button type="button" className="btn btn-solid" onClick={start}>
              Again
            </button>
            <button type="button" className="btn btn-glass" onClick={toMenu}>
              Change drill
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
