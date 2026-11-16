"use client";

import { useSyncExternalStore } from "react";
import { field } from "@/lib/field/engine";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  const off = field.onMotionChange(onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    off();
  };
}

/**
 * True when things should not move on their own: the visitor's system asks
 * for less motion, the page was opened with ?still, or they pressed pause.
 */
export function useMotionOff() {
  return useSyncExternalStore(
    subscribe,
    () => field.motionOff,
    () => false,
  );
}

/** True while the pause button is on. */
export function useMotionPaused() {
  return useSyncExternalStore(
    subscribe,
    () => field.paused,
    () => false,
  );
}
