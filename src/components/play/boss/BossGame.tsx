"use client";

import { useEffect, useRef, useState } from "react";
import { sound } from "@/components/play/sound";
import { BossEngine, type BossState } from "./BossEngine";
import "./backlog.css";

type Phase = "menu" | "playing" | "paused";
const BEST = "backlog-best";
const TICKETS = 440;
/** A brisk clear, in seconds. The dashed line on the chart runs to here. */
const PAR = 100;

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The boss's health as a burndown chart: tickets open against time, with the line you were supposed to follow. */
function Burndown({ trail, now }: { trail: { t: number; v: number }[]; now: number }) {
  const span = Math.max(PAR, now * 1.08);
  const x = (t: number) => 8 + (t / span) * 184;
  const y = (v: number) => 8 + (1 - v) * 72;
  const line = trail.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const last = trail[trail.length - 1];
  return (
    <figure className="bk-burn" aria-hidden="true">
      <svg viewBox="0 0 200 88">
        <path d={`M${x(0)} ${y(1)} L${x(PAR)} ${y(0)}`} className="bk-burn-ideal" />
        {line && <path d={line} className="bk-burn-line" />}
        {last && <circle cx={x(last.t)} cy={y(last.v)} r="3.5" className="bk-burn-dot" />}
      </svg>
      <figcaption>burndown</figcaption>
    </figure>
  );
}

export default function BossGame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BossEngine | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [game, setGame] = useState<BossState | null>(null);
  const [trail, setTrail] = useState<{ t: number; v: number }[]>([]);
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
        // One point on the chart for every second or so of the fight.
        setTrail((tr) => (tr.length && s.time - tr[tr.length - 1].t < 1 && s.phase === "fight" ? tr : [...tr, { t: s.time, v: s.boss }]));
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
    engine.ink(getComputedStyle(stage).getPropertyValue("--font-bk-marker") || "cursive");
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
    setTrail([]);
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
  const open = game ? Math.ceil(game.boss * TICKETS) : TICKETS;
  const rank = game ? (game.hits === 0 ? "Not a scratch." : game.hits <= 2 ? "Barely touched." : game.hits <= 5 ? "A few bruises." : "By a thread.") : "";

  return (
    <div ref={stageRef} className="bk" data-phase={over ?? phase}>
      <canvas
        ref={canvasRef}
        className="bk-canvas"
        aria-label="A desk, seen from above, with a cutting mat on it"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (phaseRef.current !== "playing" || e.pointerType !== "mouse") return;
          if (e.button === 2) engineRef.current?.roll();
          else if (e.button === 0) engineRef.current?.attack();
        }}
      />
      {/* Soft focus at the near and far edges, like a photo of something small. */}
      <div className="bk-lens" aria-hidden="true" />

      {phase === "playing" && game && !over && (
        <div className="bk-hud">
          <p className="bk-boss" aria-label={`The Backlog has ${open} tickets open`}>
            <span className="bk-tape">The Backlog</span>
            <span className="bk-count" data-stage={game.stage}>
              <b>{open}</b> open
            </span>
          </p>
          <Burndown trail={trail} now={game.time} />
          {game.call ? (
            <p className="bk-call" key={game.call}>
              {game.call}!
            </p>
          ) : null}

          <div className="bk-you" aria-label={`You have ${game.hp} health, ${game.stamina} stamina and ${game.flasks} coffees left`}>
            <span className="bk-cups" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <i key={i} style={{ "--fill": Math.max(0, Math.min(1, (game.hp - i * 20) / 20)) } as React.CSSProperties} />
              ))}
            </span>
            <span className="bk-pencil" aria-hidden="true">
              <i style={{ width: `${Math.max(6, game.stamina)}%` }} />
            </span>
            <span className="bk-refills" aria-hidden="true">
              {game.flasks === 2 ? "two refills" : game.flasks === 1 ? "one refill" : "no refills"}
            </span>
          </div>
          <button type="button" className="bk-tape bk-pause" onClick={() => { engineRef.current?.setPaused(true); go("paused"); }}>
            Pause
          </button>

          <div className="bk-stick" onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}>
            {knob && (
              <span className="bk-knob" style={{ left: knob.x, top: knob.y }}>
                <i style={{ translate: `${knob.dx * 26}px ${knob.dy * 26}px` }} />
              </span>
            )}
          </div>
          <div className="bk-pad">
            <button type="button" data-kind="coffee" onPointerDown={() => engineRef.current?.heal()} disabled={game.flasks === 0}>
              Coffee
            </button>
            <button type="button" data-kind="roll" onPointerDown={() => engineRef.current?.roll()}>
              Roll
            </button>
            <button type="button" data-kind="hit" onPointerDown={() => engineRef.current?.attack()}>
              Hit
            </button>
          </div>
        </div>
      )}

      {failed && (
        <div className="bk-memo">
          <h2>No 3D here</h2>
          <p>This browser would not start WebGL, so the desk cannot be drawn. It works in current Chrome, Edge, Safari and Firefox.</p>
        </div>
      )}

      {phase === "menu" && !failed && (
        <div className="bk-memo">
          <p className="bk-memo-head">Interoffice memo</p>
          <dl className="bk-memo-lines">
            <div>
              <dt>To</dt>
              <dd>You</dd>
            </div>
            <div>
              <dt>From</dt>
              <dd>The Backlog</dd>
            </div>
            <div>
              <dt>Re</dt>
              <dd>Everything</dd>
            </div>
          </dl>
          <p>
            It is seven pads tall and it never gets shorter on its own. Whatever it is about to do shows up on the mat
            first. Get in while it recovers, and roll through what you cannot outrun.
          </p>
          <dl className="bk-keys bk-keys-desk">
            <div>
              <dt>Move</dt>
              <dd>W A S D</dd>
            </div>
            <div>
              <dt>Hit</dt>
              <dd>Click, or J</dd>
            </div>
            <div>
              <dt>Roll</dt>
              <dd>Space</dd>
            </div>
            <div>
              <dt>Coffee</dt>
              <dd>E, two refills</dd>
            </div>
          </dl>
          <p className="bk-keys-thumb">Left thumb walks. The stickers on the right hit, roll and drink.</p>
          <div className="bk-memo-foot">
            <button type="button" className="bk-stamp" onClick={start}>
              Clock in
            </button>
            <label className="bk-check">
              <input type="checkbox" checked={!muted} onChange={() => setMuted(!muted)} />
              <span>Sound</span>
            </label>
          </div>
        </div>
      )}

      {phase === "paused" && (
        <div className="bk-sticky" role="dialog" aria-label="Paused">
          <h2>BRB</h2>
          <button type="button" className="bk-link" onClick={resume}>
            Back to it
          </button>
          <button type="button" className="bk-link" onClick={start}>
            Start over
          </button>
        </div>
      )}

      {over && game && (
        <div className="bk-ticket" data-won={over === "won" ? "" : undefined} role="status">
          <p className="bk-ticket-id">BKLG-{String(open).padStart(3, "0")}</p>
          <h2>Everything</h2>
          <span className="bk-verdict">{over === "won" ? "Done" : "Reopened"}</span>
          <p>
            {over === "won"
              ? `${rank} The Backlog is at zero, for now.${best > 0 && game.time <= best ? " That is your fastest." : ""}`
              : `${open} tickets still open. It shows you everything before it lands, so watch the mat.`}
          </p>
          <dl className="bk-memo-lines">
            <div>
              <dt>Time</dt>
              <dd>{clock(game.time)}</dd>
            </div>
            <div>
              <dt>Hits taken</dt>
              <dd>{game.hits}</dd>
            </div>
            <div>
              <dt>Refills left</dt>
              <dd>{game.flasks}</dd>
            </div>
          </dl>
          <button type="button" className="bk-stamp" onClick={start}>
            {over === "won" ? "Clock in again" : "Try again"}
          </button>
        </div>
      )}
    </div>
  );
}
