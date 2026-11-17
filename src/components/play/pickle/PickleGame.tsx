"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/components/play/sound";
import { PickleEngine, type PickleState } from "./PickleEngine";

const LEVELS = [
  { name: "Rec", what: "Friendly. Gets to most balls, misses plenty." },
  { name: "Club", what: "Moves you around and waits for a mistake." },
  { name: "Open", what: "Quick, accurate, and likes a drop shot." },
] as const;

type Phase = "menu" | "playing" | "paused";

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

  const over = phase === "playing" && game?.phase === "over";
  const won = !!game && game.you > game.them;
  const clean = game && game.swings ? Math.round((game.clean / game.swings) * 100) : 0;
  const yourServe = game?.phase === "serve" && game.server === "you";

  return (
    <div ref={stageRef} className="game-stage pickle" data-phase={over ? "over" : phase}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="The pickleball court"
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
        <div className="game-hud">
          <div className="pickle-score" aria-live="polite" aria-label={`You ${game.you}, them ${game.them}`}>
            <span data-serving={game.server === "you" ? "" : undefined}>
              <small>You</small>
              <b>{game.you}</b>
            </span>
            <span data-serving={game.server === "them" ? "" : undefined}>
              <b>{game.them}</b>
              <small>Them</small>
            </span>
          </div>
          {game.phase === "point" && (
            <p className="pickle-call" data-won={game.won === "you" ? "" : undefined}>
              {game.note}
            </p>
          )}
          {game.phase === "rally" && game.timing && (
            <p className="pickle-timing" data-timing={game.timing} key={game.rally}>
              {game.timing}
            </p>
          )}
          <p className="game-hud-foot">{yourServe ? "Your serve. Pick a spot past the kitchen." : game.phase === "rally" && game.rally > 3 ? `Rally of ${game.rally}` : ""}</p>
          <button type="button" className="btn btn-glass pickle-pause" onClick={() => { engineRef.current?.setPaused(true); go("paused"); }}>
            Pause
          </button>
        </div>
      )}

      {failed && (
        <div className="game-panel">
          <h2 className="h-pixel game-title">No 3D here</h2>
          <p>This browser would not start WebGL, so the court cannot draw. It works in current Chrome, Edge, Safari and Firefox.</p>
        </div>
      )}

      {phase === "menu" && !failed && (
        <div className="game-panel pickle-menu">
          <fieldset className="range-drills">
            <legend className="meta">Who are you playing</legend>
            {LEVELS.map((l, i) => (
              <label key={l.name} className="range-drill">
                <input type="radio" name="pickle-level" checked={level === i} onChange={() => setLevel(i as 0 | 1 | 2)} />
                <span>
                  <b>{l.name}</b>
                  {l.what}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="range-settings">
            <fieldset className="seg" aria-label="Game length">
              {([5, 11] as const).map((n) => (
                <label key={n} className="seg-item">
                  <input type="radio" name="pickle-target" checked={target === n} onChange={() => setTarget(n)} />
                  <span>{n === 5 ? "Short game, to 5" : "Full game, to 11"}</span>
                </label>
              ))}
            </fieldset>
            <p className="range-note">
              You both run to the ball on your own. Your job is the shot: click or tap where you want it to land, just
              as the ring closes on the ball. Clean timing lands on the spot. Early or late sprays.
            </p>
            <div className="game-actions">
              <button type="button" className="btn btn-solid" onClick={start}>
                Play
              </button>
              <button type="button" className="btn btn-glass" aria-pressed={muted} onClick={() => setMuted(!muted)}>
                {muted ? "Sound off" : "Sound on"}
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
              Back to the point
            </button>
            <button type="button" className="btn btn-glass" onClick={toMenu}>
              Leave the game
            </button>
          </div>
        </div>
      )}

      {over && game && (
        <div className="game-panel game-panel-small" role="status">
          <h2 className="h-pixel game-title">
            {game.you} to {game.them}
          </h2>
          <p className="range-note">{won ? `You beat ${LEVELS[level].name}.` : `${LEVELS[level].name} got you this time.`}</p>
          <dl className="game-result">
            <div>
              <dt>Longest rally</dt>
              <dd>{game.longest}</dd>
            </div>
            <div>
              <dt>Clean timing</dt>
              <dd>{clean}%</dd>
            </div>
          </dl>
          <div className="game-actions">
            <button type="button" className="btn btn-solid" onClick={start}>
              Rematch
            </button>
            <button type="button" className="btn btn-glass" onClick={toMenu}>
              Change opponent
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
