"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field/engine";

const PER_PRESS = 8;
const POOL = 24;

/**
 * Pressing a control in the arcade zone knocks a few pixels loose. One small
 * pool of squares is reused for every press; nothing happens with reduced
 * motion on.
 */
export function Sparks() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const bits = Array.from(root.children) as HTMLElement[];
    let next = 0;

    const onDown = (e: PointerEvent) => {
      if (field.reducedMotion || !(e.target instanceof Element)) return;
      if (!e.target.closest('[data-zone="arcade"] :is(button, a, .seg-item)')) return;
      const spin = Math.random() * Math.PI;
      for (let i = 0; i < PER_PRESS; i++) {
        const bit = bits[next++ % bits.length];
        const angle = spin + (i / PER_PRESS) * Math.PI * 2;
        const far = 22 + Math.random() * 30;
        const dx = Math.cos(angle) * far;
        const dy = Math.sin(angle) * far - 8;
        bit.style.left = `${e.clientX}px`;
        bit.style.top = `${e.clientY}px`;
        bit.animate(
          [
            { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
            { transform: `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) scale(0.45)`, opacity: 0 },
          ],
          // Stepped, so the pixels hop the way sprites do.
          { duration: 340 + Math.random() * 140, easing: "steps(6, end)" },
        );
      }
    };

    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return (
    <div ref={ref} className="sparks" aria-hidden="true">
      {Array.from({ length: POOL }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
