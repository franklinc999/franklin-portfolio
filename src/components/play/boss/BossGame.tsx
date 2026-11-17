"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/components/play/sound";
import { BossEngine, type BossState } from "./BossEngine";

type Phase = "menu" | "playing" | "paused";
const BEST = "backlog-best";

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export default function BossGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BossEngine | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [game, setGame] = useState<BossState | null>(null);
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(0);
  const [knob, setKnob] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let engine: BossEngine;
    try {
      engine = new BossEngine(canvas, (s) => {
        setGame(s);
        if (s.phase === "won") {
          setBest((b) => {
            const next = b === 0 || s.time < b ? s.time : b;
            try {
              window.localStorage.setItem(BEST, String(next));
            } catch {
              // The best time is a nicety.
            }
            return next;
          });
        }
      });
    } catch {
      const id = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(id);
    }
    engineRef.current = engine;
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(stage);
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as { __boss?: unknown }).__boss = engine;
    }

    const held = new Set<string>();
    const steer = () => {
      const x = (held.has("d") || held.has("arrowright") ? 1 : 0) - (held.has("a") || held.has("arrowleft") ? 1 : 0);
      const y = (held.has("w") || held.has("arrowup") ? 1 : 0) - (held.has("s") || held.has("arrowdown") ? 1 : 0);
      engine.setMove(x, y);
    };
    const pause = () => {
      if (phaseRef.current !== "playing") return;
      held.clear();
      engine.setMove(0, 0);
      engine.setPaused(true);
      phaseRef.current = "paused";
      setPhase("paused");
    };
    const MOVE = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"];
    const onDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      const k = e.key.toLowerCase();
      if (MOVE.includes(k)) {
        held.add(k);
        steer();
      } else if (k === " " || k === "shift") engine.roll();
      else if (k === "j" || k === "k" || k === "enter") engine.attack();
      else if (k === "e" || k === "q" || k === "f") engine.heal();
      else if (k === "escape") pause();
      else return;
      // While the fight is on, these keys belong to the game, not the page.
      e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      if (phaseRef.current === "playing") steer();
    };
    const onHide = () => {
      if (document.hidden) pause();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", pause);
      document.removeEventListener("visibilitychange", onHide);
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const start = () => {
    let stored = 0;
    try {
      stored = Number(window.localStorage.getItem(BEST)) || 0;
    } catch {
      // No best yet.
    }
    setBest(stored);
    sound.setMuted(muted);
    engineRef.current?.setPaused(false);
    engineRef.current?.start();
    go("playing");
  };

  const resume = () => {
    engineRef.current?.setPaused(false);
    go("playing");
  };

  // The thumb stick: wherever the left thumb lands becomes the centre.
  const stickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setKnob({ x: e.clientX - r.left, y: e.clientY - r.top, dx: 0, dy: 0 });
  };
  const stickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = Math.max(-1, Math.min(1, (e.clientX - s.x) / 44));
    const dy = Math.max(-1, Math.min(1, (e.clientY - s.y) / 44));
    engineRef.current?.setMove(dx, -dy);
    setKnob((k) => (k ? { ...k, dx, dy } : k));
  };
  const stickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id !== e.pointerId) return;
    stick.current = null;
    engineRef.current?.setMove(0, 0);
    setKnob(null);
  };

  const over = phase === "playing" && game && (game.phase === "won" || game.phase === "lost") ? game.phase : null;
  const rank = game ? (game.hits === 0 ? "Untouched" : game.hits <= 2 ? "Clean" : game.hits <= 5 ? "Scrappy" : "Barely") : "";

  return (
    <div ref={stageRef} className="game-stage boss" data-phase={over ?? phase}>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        aria-label="The arena"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (phaseRef.current !== "playing" || e.pointerType !== "mouse") return;
          if (e.button === 2) engineRef.current?.roll();
          else if (e.button === 0) engineRef.current?.attack();
        }}
      />

      {phase === "playing" && game && !over && (
        <div className="game-hud">
          <div className="boss-top">
            <p className="boss-name">
              <b>The Backlog</b>
              {game.call ? <span key={game.call}>{game.call}</span> : null}
            </p>
            <span className="boss-bar" role="img" aria-label={`The Backlog has ${Math.round(game.boss * 100)}% left`}>
              <span style={{ width: `${game.boss * 100}%` }} />
              <i style={{ left: "60%" }} />
              <i style={{ left: "28%" }} />
            </span>
          </div>
          <div className="boss-you" aria-label={`You have ${game.hp} health, ${game.stamina} stamina and ${game.flasks} flasks`}>
            <span className="boss-hp">
              <span style={{ width: `${game.hp}%` }} />
            </span>
            <span className="boss-stamina">
              <span style={{ width: `${game.stamina}%` }} />
            </span>
            <span className="boss-flasks" aria-hidden="true">
              {[0, 1].map((i) => (
                <i key={i} data-full={i < game.flasks ? "" : undefined} />
              ))}
            </span>
          </div>
          <button type="button" className="btn btn-glass pickle-pause" onClick={() => { engineRef.current?.setPaused(true); go("paused"); }}>
            Pause
          </button>

          <div className="boss-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
            {knob && (
              <span className="boss-knob" style={{ left: knob.x, top: knob.y }}>
                <i style={{ translate: `${knob.dx * 26}px ${knob.dy * 26}px` }} />
              </span>
            )}
          </div>
          <div className="boss-pad">
            <button type="button" onPointerDown={() => engineRef.current?.heal()} disabled={game.flasks === 0}>
              Flask
            </button>
            <button type="button" onPointerDown={() => engineRef.current?.roll()}>
              Roll
            </button>
            <button type="button" className="boss-pad-main" onPointerDown={() => engineRef.current?.attack()}>
              Hit
            </button>
          </div>
        </div>
      )}

      {failed && (
        <div className="game-panel">
          <h2 className="h-pixel game-title">No 3D here</h2>
          <p>This browser would not start WebGL, so the arena cannot draw. It works in current Chrome, Edge, Safari and Firefox.</p>
        </div>
      )}

      {phase === "menu" && !failed && (
        <div className="game-panel boss-menu">
          <h2 className="h-pixel game-title">The Backlog</h2>
          <p className="range-note">
            It is seven blocks tall and it never gets shorter on its own. Every attack is drawn on the floor before it
            lands. Get in, hit it while it recovers, and roll through what you cannot outrun.
          </p>
          <dl className="boss-keys">
            <div>
              <dt>Move</dt>
              <dd>W A S D or the arrows</dd>
            </div>
            <div>
              <dt>Hit</dt>
              <dd>Click or J</dd>
            </div>
            <div>
              <dt>Roll</dt>
              <dd>Space or right click</dd>
            </div>
            <div>
              <dt>Flask</dt>
              <dd>E, two per fight</dd>
            </div>
          </dl>
          <div className="game-actions">
            <button type="button" className="btn btn-solid" onClick={start}>
              Walk in
            </button>
            <button type="button" className="btn btn-glass" aria-pressed={muted} onClick={() => setMuted(!muted)}>
              {muted ? "Sound off" : "Sound on"}
            </button>
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
            <button type="button" className="btn btn-glass" onClick={start}>
              Start over
            </button>
          </div>
        </div>
      )}

      {over && game && (
        <div className="game-panel game-panel-small" role="status">
          <h2 className="h-pixel game-title">{over === "won" ? "Cleared" : "Buried"}</h2>
          <p className="range-note">
            {over === "won"
              ? `${rank}. The Backlog is empty, for now.${best > 0 && game.time <= best ? " That is your fastest." : ""}`
              : `It had ${Math.max(1, Math.round(game.boss * 100))}% left. It telegraphs everything, so watch the floor.`}
          </p>
          <dl className="game-result">
            <div>
              <dt>Time</dt>
              <dd>{clock(game.time)}</dd>
            </div>
            <div>
              <dt>Hits taken</dt>
              <dd>{game.hits}</dd>
            </div>
          </dl>
          <div className="game-actions">
            <button type="button" className="btn btn-solid" onClick={start}>
              {over === "won" ? "Again" : "Try again"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
