"use client";

import { useEffect, type RefObject } from "react";
import { field } from "@/lib/field/engine";

/**
 * Tells a floating control whether the ground under it is light or dark, the
 * way system glass picks its ink from what is behind it. Sets data-tone on
 * the element; the stylesheet does the rest.
 */
export function useToneUnder(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let lastY = -1;
    let tick = 0;
    return field.onFrame(() => {
      const el = ref.current;
      if (!el) return;
      tick++;
      const y = window.scrollY;
      // Scrolling is the usual cause; the slow tick catches route changes and resizes.
      if (y === lastY && tick % 20 !== 0) return;
      lastY = y;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      let tone = "dark";
      for (const zone of document.querySelectorAll<HTMLElement>("[data-zone]")) {
        const zr = zone.getBoundingClientRect();
        if (zr.top <= mid && zr.bottom > mid) tone = zone.dataset.zone === "paper" ? "light" : "dark";
      }
      if (el.dataset.tone !== tone) el.dataset.tone = tone;
    });
  }, [ref]);
}
