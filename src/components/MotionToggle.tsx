"use client";

import { useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { field } from "@/lib/field/engine";
import { useMotionPaused } from "@/lib/useReducedMotion";
import { useToneUnder } from "@/lib/useToneUnder";

const KEY = "motion";

/**
 * Pause button for everything that moves on its own: the drifting ground,
 * the marquee, the rolling phrase, the pipeline toy. The choice is remembered.
 */
export function MotionToggle() {
  const paused = useMotionPaused();
  const ref = useRef<HTMLButtonElement>(null);
  useToneUnder(ref);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "off") field.setPaused(true);
    } catch {
      // Storage can be unavailable; the button still works for this visit.
    }
  }, []);

  const toggle = () => {
    const next = !paused;
    field.setPaused(next);
    try {
      window.localStorage.setItem(KEY, next ? "off" : "on");
    } catch {
      // Not remembered, which is fine.
    }
  };

  const label = paused ? "Play motion" : "Pause motion";
  const Icon = paused ? Play : Pause;
  return (
    <button ref={ref} type="button" className="motion-toggle" onClick={toggle} aria-label={label} title={label}>
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
