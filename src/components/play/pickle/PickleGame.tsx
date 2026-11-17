"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/components/play/sound";
import { PickleEngine, type PickleState } from "./PickleEngine";
import "./dink.css";

const RIVALS = [
  { name: "Onion", level: "Rec", line: "Friendly. Gets to most balls, misses plenty.", stats: [2, 2, 2] },
  { name: "Carrot", level: "Club", line: "Moves you around and waits for a mistake.", stats: [3, 3, 4] },
  { name: "Chili", level: "Open", line: "Quick, accurate, and loves a drop shot.", stats: [5, 4, 5] },
] as const;
const STATS = ["Speed", "Aim", "Nerve"];

type Phase = "menu" | "playing" | "paused";

/** The players, drawn flat for the flyer. */
function Veg({ who }: { who: "pickle" | "onion" | "carrot" | "chili" }) {
  const eyes = (y: number, mood: "plain" | "sleepy" | "set" | "mean") => (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          {mood === "sleepy" ? (
            <path d={`M${60 + s * 14 - 7} ${y} q7 6 14 0`} fill="none" stroke="#1d2a44" strokeWidth="4" strokeLinecap="round" />
          ) : (
            <>
              <circle cx={60 + s * 14} cy={y} r="8" fill="#fff" stroke="#1d2a44" strokeWidth="3" />
              <circle cx={60 + s * 14 + (mood === "mean" ? -s * 2 : 0)} cy={y + 1} r="3.5" fill="#1d2a44" />
              {mood !== "plain" && <path d={`M${60 + s * 24} ${y - (mood === "mean" ? 16 : 12)} L${60 + s * 5} ${y - (mood === "mean" ? 8 : 12)}`} stroke="#1d2a44" strokeWidth="4" strokeLinecap="round" />}
            </>
          )}
        </g>
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 120 140" className="dk-veg" aria-hidden="true">
      {who === "pickle" && (
        <>
          <rect x="34" y="14" width="52" height="112" rx="26" fill="#6aa84f" stroke="#1d2a44" strokeWidth="5" />
          {[[46, 78], [72, 92], [50, 108], [74, 62]].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="4" fill="#4f8a3a" />
          ))}
          <rect x="32" y="30" width="56" height="12" fill="#e4572e" stroke="#1d2a44" strokeWidth="4" />
          {eyes(58, "plain")}
          <path d="M50 76 q10 9 20 0" fill="none" stroke="#1d2a44" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {who === "onion" && (
        <>
          <path d="M52 22 q-6 -14 -14 -16 M60 22 q0 -14 4 -18 M68 22 q8 -10 16 -12" fill="none" stroke="#5a9e3f" strokeWidth="7" strokeLinecap="round" />
          <path d="M60 22 C104 40 112 108 60 126 C8 108 16 40 60 22 Z" fill="#c58bd6" stroke="#1d2a44" strokeWidth="5" />
          <path d="M60 30 C40 56 40 96 60 118 M60 30 C80 56 80 96 60 118" fill="none" stroke="#e3bdee" strokeWidth="4" />
          {eyes(74, "sleepy")}
          <circle cx="60" cy="94" r="5" fill="#1d2a44" />
        </>
      )}
      {who === "carrot" && (
        <>
          <path d="M44 26 l-8 -18 M60 24 v-20 M76 26 l8 -18 M52 24 l-2 -14 M68 24 l2 -14" stroke="#5a9e3f" strokeWidth="7" strokeLinecap="round" />
          <path d="M28 30 Q60 16 92 30 L66 130 Q60 136 54 130 Z" fill="#f2832b" stroke="#1d2a44" strokeWidth="5" strokeLinejoin="round" />
          <path d="M40 52 h14 M70 78 h10 M52 100 h10" stroke="#c9641a" strokeWidth="4" strokeLinecap="round" />
          {eyes(54, "set")}
          <path d="M52 74 h16" stroke="#1d2a44" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
      {who === "chili" && (
        <>
          <path d="M58 22 q2 -14 14 -16" fill="none" stroke="#3f7d3a" strokeWidth="8" strokeLinecap="round" />
          <path d="M40 30 C36 18 84 18 82 32 C96 70 86 112 52 132 C44 136 40 130 46 124 C62 104 52 66 40 30 Z" fill="#d7263d" stroke="#1d2a44" strokeWidth="5" strokeLinejoin="round" />
          <path d="M38 30 q22 -12 46 0" fill="none" stroke="#3f7d3a" strokeWidth="8" strokeLinecap="round" />
          {eyes(58, "mean")}
          <path d="M50 78 q12 8 22 -2" fill="none" stroke="#1d2a44" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export default function PickleGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PickleEngine | null>(null);
  const phaseRef = useRef<Phase>("menu");

  const [phase, setPhase] = useState<Phase>("menu");
  const [level, setLevel] = useState<0 | 1 | 2>(1);
  const [target, setTarget] = useState<5 | 11>(5);
  const [muted, setMuted] = useState(false);
  const [game, setGame] = useState<PickleState | null>(null);
  const [failed, setFailed] = useState(false);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let engine: PickleEngine;
    try {
      engine = new PickleEngine(canvas, (s) => setGame(s));
    } catch {
      const id = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(id);
    }
    engineRef.current = engine;
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(stage);
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __pickle?: unknown }).__pickle = engine;
    }

    const pause = () => {
      if (phaseRef.current !== "playing") return;
      engine.setPaused(true);
      phaseRef.current = "paused";
      setPhase("paused");
    };
    const onKey = (e: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      const step = 0.5;
      if (e.key === "Escape") pause();
      else if (e.key === " " || e.key === "Enter") engine.swing();
      else if (e.key === "ArrowLeft") engine.nudge(-step, 0);
      else if (e.key === "ArrowRight") engine.nudge(step, 0);
      else if (e.key === "ArrowUp") engine.nudge(0, -step);
      else if (e.key === "ArrowDown") engine.nudge(0, step);
      else return;
      // While a point is on, these keys belong to the game, not the page.
      e.preventDefault();
    };
    const onHide = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Whoever is picked on the flyer walks onto the court behind it.
  useEffect(() => {
    if (phase === "menu") engineRef.current?.setOptions({ level, target });
  }, [level, target, phase]);

  const start = () => {
    const engine = engineRef.current;
    if (!engine) return;
    sound.setMuted(muted);
    engine.setOptions({ level, target });
    engine.setPaused(false);
    engine.start();
    go("playing");
  };

  const resume = () => {
    engineRef.current?.setPaused(false);
    go("playing");
  };

  const toMenu = () => {
    engineRef.current?.setPaused(false);
    engineRef.current?.stop();
    go("menu");
  };

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1) };
  };

  const rival = RIVALS[level];
  const over = phase === "playing" && game?.phase === "over";
  const won = !!game && game.you > game.them;
  const clean = game && game.swings ? Math.round((game.clean / game.swings) * 100) : 0;
  const yourServe = game?.phase === "serve" && game.server === "you";

  return (
    <div ref={stageRef} className="dk" data-phase={over ? "over" : phase}>
      <canvas
        ref={canvasRef}
        className="dk-canvas"
        aria-label="A pickleball court"
        onPointerMove={(e) => {
          if (phaseRef.current === "playing" && e.pointerType === "mouse") engineRef.current?.aimAt(at(e));
        }}
        onPointerDown={(e) => {
          if (phaseRef.current !== "playing") return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          engineRef.current?.swing(at(e));
        }}
      />

      {phase === "playing" && game && !over && (
        <div className="dk-hud">
          <div className="dk-board" aria-live="polite" aria-label={`You ${game.you}, ${rival.name} ${game.them}`}>
            <span className="dk-side" data-serving={game.server === "you" ? "" : undefined}>
              <small>Dill</small>
              <b className="dk-flip">{game.you}</b>
            </span>
            <span className="dk-side" data-serving={game.server === "them" ? "" : undefined}>
              <b className="dk-flip">{game.them}</b>
              <small>{rival.name}</small>
            </span>
          </div>
          {game.phase === "point" && (
            <p className="dk-call" data-won={game.won === "you" ? "" : undefined}>
              <span>{game.note}!</span>
            </p>
          )}
          {game.phase === "rally" && game.timing && (
            <p className="dk-timing" data-timing={game.timing} key={game.rally}>
              {game.timing}
            </p>
          )}
          {(yourServe || (game.phase === "rally" && game.rally > 3)) && <p className="dk-hint">{yourServe ? "Your serve. Pick a spot past the yellow." : `Rally of ${game.rally}`}</p>}
          <button type="button" className="dk-pause" onClick={() => { engineRef.current?.setPaused(true); go("paused"); }}>
            Pause
          </button>
        </div>
      )}

      {failed && (
        <div className="dk-card">
          <h2 className="dk-shout">No 3D here</h2>
          <p>This browser would not start WebGL, so the court cannot be drawn. It works in current Chrome, Edge, Safari and Firefox.</p>
        </div>
      )}

      {phase === "menu" && !failed && (
        <div className="dk-flyer">
          <div className="dk-flyer-head">
            <p className="dk-kicker">Sunday rec league, singles</p>
            <h2 className="dk-logo">Dink!</h2>
            <p className="dk-how">
              You are the pickle. Everyone runs on their own. Your job is the shot: tap where you want it to land,
              right as the ring closes on the ball.
            </p>
          </div>

          <fieldset className="dk-rivals">
            <legend>Pick who you are playing</legend>
            {RIVALS.map((r, i) => (
              <label key={r.name} className="dk-rival">
                <input type="radio" name="dk-rival" checked={level === i} onChange={() => setLevel(i as 0 | 1 | 2)} />
                <span className="dk-rival-card">
                  <Veg who={r.name.toLowerCase() as "onion" | "carrot" | "chili"} />
                  <b>{r.name}</b>
                  <small>{r.level}</small>
                  <span className="dk-rival-line">{r.line}</span>
                  <span className="dk-stats">
                    {STATS.map((label, k) => (
                      <span key={label}>
                        {label}
                        <i style={{ "--n": r.stats[k] } as React.CSSProperties} />
                      </span>
                    ))}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="dk-flyer-foot">
            <fieldset className="dk-stubs">
              <legend>Play to</legend>
              {([5, 11] as const).map((n) => (
                <label key={n}>
                  <input type="radio" name="dk-target" checked={target === n} onChange={() => setTarget(n)} />
                  <span>{n}</span>
                </label>
              ))}
            </fieldset>
            <button type="button" className="dk-btn dk-btn-quiet" aria-pressed={!muted} onClick={() => setMuted(!muted)}>
              Sound {muted ? "off" : "on"}
            </button>
            <button type="button" className="dk-btn" onClick={start}>
              Serve it up
            </button>
          </div>
        </div>
      )}

      {phase === "paused" && (
        <div className="dk-card" role="dialog" aria-label="Paused">
          <h2 className="dk-shout">Time out</h2>
          <div className="dk-row">
            <button type="button" className="dk-btn" onClick={resume}>
              Back to the point
            </button>
            <button type="button" className="dk-btn dk-btn-quiet" onClick={toMenu}>
              Leave
            </button>
          </div>
        </div>
      )}

      {over && game && (
        <div className="dk-card" role="status">
          <h2 className="dk-shout">{won ? "Game!" : "So close"}</h2>
          <p className="dk-final">
            <b className="dk-flip">{game.you}</b>
            <span>to</span>
            <b className="dk-flip">{game.them}</b>
          </p>
          <p>{won ? `You beat ${rival.name}.` : `${rival.name} got you this time.`}</p>
          <dl className="dk-tally">
            <div>
              <dt>Longest rally</dt>
              <dd>{game.longest}</dd>
            </div>
            <div>
              <dt>Clean timing</dt>
              <dd>{clean}%</dd>
            </div>
          </dl>
          <div className="dk-row">
            <button type="button" className="dk-btn" onClick={start}>
              Rematch
            </button>
            <button type="button" className="dk-btn dk-btn-quiet" onClick={toMenu}>
              Someone else
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
