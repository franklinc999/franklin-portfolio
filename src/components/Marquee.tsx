"use client";

import { useEffect, useRef } from "react";
import { Glass } from "@/components/Glass";
import { field } from "@/lib/field/engine";

/**
 * A ribbon of glass with words running through it. It drifts on its own and
 * picks up speed, in either direction, from how the page is being scrolled.
 */
export function Marquee({ words }: { words: string[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let offset = 0;
    let lastY = window.scrollY;
    let push = 0;
    let dir = -1;
    return field.onFrame((dt) => {
      const half = track.scrollWidth / 2;
      if (!half || field.motionOff) {
        lastY = window.scrollY;
        return;
      }
      const y = window.scrollY;
      const v = (y - lastY) / dt;
      lastY = y;
      if (Math.abs(v) > 40) dir = v > 0 ? -1 : 1;
      push += (Math.min(1400, Math.abs(v)) * 0.55 - push) * Math.min(1, dt * 6);
      offset += dir * (46 + push) * dt;
      if (offset <= -half) offset += half;
      if (offset > 0) offset -= half;
      track.style.transform = `translate3d(${offset.toFixed(2)}px,0,0)`;
    });
  }, []);

  const run = (hidden: boolean) => (
    <span className="marquee-run" aria-hidden={hidden || undefined}>
      {words.map((word) => (
        <span key={word} className="marquee-word">
          {word}
        </span>
      ))}
    </span>
  );

  return (
    <Glass kind="pill" className="marquee" role="presentation">
      <div ref={trackRef} className="marquee-track">
        {run(true)}
        {run(true)}
      </div>
    </Glass>
  );
}
