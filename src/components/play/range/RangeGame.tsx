"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sound } from "@/components/play/sound";
import { RangeEngine, type Drill, type RangeStats } from "./RangeEngine";
import "./range.css";

/* Degrees turned per mouse count at sensitivity 1, as each game defines it. */
const GAMES = [
  { name: "Valorant", yaw: 0.07, sens: 0.5, hfov: 103 },
  { name: "Call of Duty", yaw: 0.0066, sens: 6, hfov: 100 },
  { name: "Apex", yaw: 0.022, sens: 1.6, hfov: 104 },
] as const;

const DRILLS: { id: Drill; name: string; what: string }[] = [
  { id: "pop", name: "Pop", what: "Three clays up at once. Flick, break, next." },
  { id: "pin", name: "Pin", what: "One small clay, a long way out. Slow down and be exact." },
  { id: "ride", name: "Ride", what: "Hold fire and stay on a clay that keeps changing its mind." },
  { id: "peek", name: "Peek", what: "A clay leans out from behind plywood for a second. Punish it." },
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
  const [holes, setHoles] = useState<{ x: number; y: number }[]>([]);

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
          setHoles(engine.holes());
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

  // Where the group sits on the target, in words.
  const group = (() => {
    if (holes.length < 4) return "";
    const mx = holes.reduce((a, h) => a + h.x, 0) / holes.length;
    const my = holes.reduce((a, h) => a + h.y, 0) / holes.length;
    const spread = Math.sqrt(holes.reduce((a, h) => a + (h.x - mx) ** 2 + (h.y - my) ** 2, 0) / holes.length);
    const where = [my > 0.1 ? "high" : my < -0.1 ? "low" : "", mx > 0.1 ? "right" : mx < -0.1 ? "left" : ""].filter(Boolean).join(" and ");
    return `${spread < 0.42 ? "A tight group" : spread < 0.6 ? "A fair group" : "A loose group"}, ${where ? `sitting ${where}` : "on centre"}.`;
  })();
  const stage = DRILLS.findIndex((d) => d.id === settings.drill) + 1;

  return (
    <div ref={stageRef} className="rg" data-phase={phase} data-locked={locked ? "" : undefined}>
      <canvas ref={canvasRef} className="rg-canvas" onPointerDown={onPointerDown} aria-label="A firing range in the desert" />

      {phase === "playing" && stats && (
        <div className="rg-hud" aria-hidden="true">
          <p className="rg-clock">{Math.ceil(stats.left)}</p>
          <dl className="rg-tag">
            <div>
              <dt>Score</dt>
              <dd>{stats.score}</dd>
            </div>
            <div>
              <dt>Hits</dt>
              <dd>{accuracy}%</dd>
            </div>
            <div>
              <dt>Streak</dt>
              <dd>{stats.streak}</dd>
            </div>
          </dl>
          {locked && <span className="rg-cross" />}
          <p className="rg-foot">
            Stage 0{stage}, {drill.name}
            {locked ? ". Esc to pause." : ""}
          </p>
        </div>
      )}

      {failed && (
        <div className="rg-card rg-card-small">
          <h2 className="rg-title">No 3D here</h2>
          <p>This browser would not start WebGL, so the range cannot be drawn. It works in current Chrome, Edge, Safari and Firefox.</p>
        </div>
      )}

      {phase === "menu" && !failed && (
        <div className="rg-card">
          <header className="rg-head">
            <p className="rg-lane">Lane 07</p>
            <h2 className="rg-title">The Range</h2>
            <p>Four stages. Thirty seconds each.</p>
          </header>

          <fieldset className="rg-stages">
            <legend>Course of fire</legend>
            {DRILLS.map((d, i) => (
              <label key={d.id}>
                <input type="radio" name="rg-stage" checked={settings.drill === d.id} onChange={() => set("drill", d.id)} />
                <span>
                  <i>0{i + 1}</i>
                  <b>{d.name}</b>
                  <em>{d.what}</em>
                </span>
              </label>
            ))}
          </fieldset>

          <section className="rg-zero">
            <h3>Zero your sights</h3>
            <fieldset className="rg-tabs rg-mouse" aria-label="Match the sensitivity of">
              {GAMES.map((g, i) => (
                <label key={g.name}>
                  <input type="radio" name="rg-game" checked={settings.game === i} onChange={() => setSettings((s) => ({ ...s, game: i, sens: String(g.sens), hfov: g.hfov }))} />
                  <span>{g.name}</span>
                </label>
              ))}
            </fieldset>
            <div className="rg-fields rg-mouse">
              <label>
                <span>Sensitivity</span>
                <input inputMode="decimal" value={settings.sens} onChange={(e) => set("sens", e.target.value)} aria-invalid={!(sens > 0)} />
              </label>
              <label>
                <span>Mouse DPI</span>
                <input inputMode="numeric" value={settings.dpi} onChange={(e) => set("dpi", e.target.value)} aria-invalid={!(dpi > 0)} />
              </label>
            </div>
            <label className="rg-fov">
              <span>Field of view</span>
              <input type="range" min={70} max={120} step={1} value={settings.hfov} onChange={(e) => set("hfov", Number(e.target.value))} />
              <output>{settings.hfov}°</output>
            </label>
            <p className="rg-note rg-touch">Tap a clay to shoot it. With a mouse, the range matches your sensitivity from the game you play.</p>
            <p className="rg-note rg-mouse">{valid ? `One full turn is ${turn.toFixed(1)} cm of mouse, same as ${game.name}.` : "Enter a sensitivity and DPI above zero."}</p>
          </section>

          <footer className="rg-foot-row">
            <button type="button" className="rg-go" onClick={start} disabled={!valid}>
              Shooter ready
            </button>
            <button type="button" className="rg-plain" aria-pressed={!settings.muted} onClick={() => set("muted", !settings.muted)}>
              Sound {settings.muted ? "off" : "on"}
            </button>
          </footer>
        </div>
      )}

      {phase === "paused" && (
        <div className="rg-card rg-card-small rg-cease" role="dialog" aria-label="Paused">
          <h2 className="rg-title">Cease fire</h2>
          <footer className="rg-foot-row">
            <button type="button" className="rg-go" onClick={resume}>
              Range is hot
            </button>
            <button type="button" className="rg-plain" onClick={toMenu}>
              Change stage
            </button>
          </footer>
        </div>
      )}

      {phase === "done" && stats && (
        <div className="rg-card rg-result" role="status">
          <figure className="rg-paper">
            <svg viewBox="-1.25 -1.25 2.5 2.5" aria-hidden="true">
              <rect x="-1.25" y="-1.25" width="2.5" height="2.5" className="rg-paper-sheet" />
              <circle r="1" className="rg-paper-ring" />
              <circle r="0.75" className="rg-paper-ring" />
              <circle r="0.5" className="rg-paper-black" />
              <circle r="0.25" className="rg-paper-inner" />
              <path d="M-1.15 0 H-1.02 M1.02 0 H1.15 M0 -1.15 V-1.02 M0 1.02 V1.15" className="rg-paper-ring" />
              {holes.map((h, i) => (
                <circle key={i} cx={h.x} cy={-h.y} r="0.04" className="rg-paper-hole" />
              ))}
            </svg>
            <figcaption>{group || "Every hit, plotted on one target."}</figcaption>
          </figure>
          <div className="rg-sheet">
            <p className="rg-lane">
              Stage 0{stage}, {drill.name}
            </p>
            <h2 className="rg-score">{stats.score}</h2>
            <p>{stats.score >= best && stats.score > 0 ? "A new best on this stage." : `Your best on this stage is ${best}.`}</p>
            <dl className="rg-lines">
              <div>
                <dt>Hits</dt>
                <dd>
                  {stats.hits} of {stats.shots}, {accuracy}%
                </dd>
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
            <footer className="rg-foot-row">
              <button type="button" className="rg-go" onClick={start}>
                Shoot it again
              </button>
              <button type="button" className="rg-plain" onClick={toMenu}>
                Change stage
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
