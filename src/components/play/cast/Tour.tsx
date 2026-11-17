"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GameCards } from "@/components/GameCards";
import { field } from "@/lib/field/engine";
import { GAMES } from "@/lib/games";
import { useMotionOff } from "@/lib/useReducedMotion";
import type { CastKind } from "./figures";
import type { TourEngine } from "./TourEngine";
import "./tour.css";

/**
 * The games as places. A camera travels past four small islands, one for each game, as the page
 * scrolls, and each game's words scroll by in front of it. The words and links are ordinary page
 * content; the 3D is drawn behind them. Visitors who asked for less motion, and browsers without
 * WebGL, get the plain cards instead.
 */
export function Tour() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TourEngine | null>(null);
  const [plain, setPlain] = useState(false);
  const [ready, setReady] = useState(false);
  const still = useMotionOff();
  const stillRef = useRef(still);

  useEffect(() => {
    stillRef.current = still;
    engineRef.current?.setStill(still);
  }, [still]);

  useEffect(() => {
    // A pinned, scroll-driven scene is exactly what "reduce motion" asks a site not to do.
    if (field.reducedMotion) {
      const id = window.setTimeout(() => setPlain(true), 0);
      return () => window.clearTimeout(id);
    }
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    let engine: TourEngine | null = null;
    let gone = false;

    const measure = () => {
      const r = section.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      engine?.setProgress(span > 0 ? -r.top / span : 0);
    };
    const onResize = () => {
      engine?.resize();
      measure();
    };
    const io = new IntersectionObserver(([entry]) => engine?.setVisible(entry.isIntersecting), { rootMargin: "200px" });

    // three.js is fetched when the section is getting close, not with the page.
    const near = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        near.disconnect();
        import("./TourEngine")
          .then(({ TourEngine }) => {
            if (gone) return;
            engine = new TourEngine(canvas, GAMES.map((g) => g.slug as CastKind));
            engine.setStill(stillRef.current);
            engineRef.current = engine;
            io.observe(section);
            window.addEventListener("scroll", measure, { passive: true });
            window.addEventListener("resize", onResize);
            measure();
            if (new URLSearchParams(window.location.search).has("debug")) {
              (window as unknown as { __tour?: unknown }).__tour = engine;
            }
            setReady(true);
          })
          .catch(() => setPlain(true));
      },
      { rootMargin: "1200px" },
    );
    near.observe(section);

    return () => {
      gone = true;
      near.disconnect();
      io.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", onResize);
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  if (plain) {
    return (
      <div className="wrap">
        <GameCards lazy />
      </div>
    );
  }

  return (
    <section ref={sectionRef} className="tour" data-ready={ready ? "" : undefined} aria-label="The games">
      <div className="tour-stage" aria-hidden="true">
        <canvas ref={canvasRef} className="tour-canvas" />
      </div>
      <ol className="tour-steps">
        {GAMES.map((game) => (
          <li key={game.slug} className="tour-step">
            <div className="wrap">
              <div className="tour-words on-map">
                <p className="tour-kind">{game.kind}</p>
                <h3 className="tour-name h-pixel">{game.name}</h3>
                <p className="tour-blurb">{game.blurb}</p>
                <Link href={`/play/${game.slug}`} className="btn btn-solid">
                  Play {game.name}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
