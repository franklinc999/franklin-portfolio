"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GAMES } from "@/lib/games";
import { useMotionOff } from "@/lib/useReducedMotion";
import type { CastEngine, CastKind } from "./CastEngine";
import "./cast.css";

type Grip = { id: number; i: number; x: number; far: number; speed: number; at: number };

/**
 * One figure from each game, standing in a row above the cards. Drag one to spin it; follow the
 * link under it to play. The figures are 3D, but the row is four ordinary links: without WebGL
 * the names are still there and still work.
 */
export function Cast() {
  const rowRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CastEngine | null>(null);
  const grip = useRef<Grip | null>(null);
  const dragged = useRef(false);
  const [ready, setReady] = useState(false);
  const still = useMotionOff();
  const stillRef = useRef(still);

  useEffect(() => {
    stillRef.current = still;
    engineRef.current?.setStill(still);
  }, [still]);

  useEffect(() => {
    const row = rowRef.current;
    const canvas = canvasRef.current;
    if (!row || !canvas) return;
    let engine: CastEngine | null = null;
    let gone = false;
    const slots = Array.from(row.querySelectorAll<HTMLElement>(".cast-slot"));
    const ro = new ResizeObserver(() => engine?.resize());
    const io = new IntersectionObserver(([entry]) => engine?.setVisible(entry.isIntersecting), { rootMargin: "120px" });

    // three.js is only fetched here, once the row is on the page.
    import("./CastEngine")
      .then(({ CastEngine }) => {
        if (gone) return;
        engine = new CastEngine(canvas, slots, GAMES.map((g) => g.slug as CastKind));
        engine.setStill(stillRef.current);
        engineRef.current = engine;
        ro.observe(row);
        io.observe(row);
        if (new URLSearchParams(window.location.search).has("debug")) {
          (window as unknown as { __cast?: unknown }).__cast = engine;
        }
        setReady(true);
      })
      .catch(() => {
        // No WebGL: the links carry on without their figures.
      });

    return () => {
      gone = true;
      ro.disconnect();
      io.disconnect();
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const down = (i: number) => (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    grip.current = { id: e.pointerId, i, x: e.clientX, far: 0, speed: 0, at: performance.now() };
    dragged.current = false;
  };

  const move = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const now = performance.now();
    g.far += Math.abs(dx);
    // A small wobble of the finger is still a tap. Past that, it is a hand on the figure.
    if (!dragged.current && g.far > 6) {
      dragged.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      engineRef.current?.hold(g.i);
    }
    if (dragged.current) {
      engineRef.current?.drag(g.i, dx);
      const dt = Math.max(1, now - g.at) / 1000;
      g.speed = g.speed * 0.6 + (dx / dt) * 0.4;
    }
    g.x = e.clientX;
    g.at = now;
  };

  const up = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    if (dragged.current) engineRef.current?.release(g.i, performance.now() - g.at > 90 ? 0 : g.speed);
  };

  return (
    <section className="cast wrap" aria-label="A figure from each game">
      <div ref={rowRef} className="cast-row" data-ready={ready ? "" : undefined}>
        <canvas ref={canvasRef} className="cast-canvas" aria-hidden="true" />
        {GAMES.map((game, i) => (
          <Link
            key={game.slug}
            href={`/play/${game.slug}`}
            className="cast-cell"
            draggable={false}
            onPointerDown={down(i)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") engineRef.current?.hop(i);
            }}
            onFocus={() => engineRef.current?.hop(i)}
            onClick={(e) => {
              // Letting go after a spin is not a click on the link.
              if (dragged.current) {
                e.preventDefault();
                dragged.current = false;
              }
            }}
          >
            <span className="cast-slot" />
            <span className="cast-name">{game.name}</span>
            <span className="cast-kind">{game.kind}</span>
          </Link>
        ))}
      </div>
      <p className="cast-hint note" aria-hidden="true">
        Drag one to spin it
      </p>
    </section>
  );
}
