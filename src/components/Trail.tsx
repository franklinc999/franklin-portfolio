"use client";

import { useEffect } from "react";
import { field } from "@/lib/field/engine";

/**
 * Switches on the footpath for the page it is rendered on. The path itself
 * is drawn by the field, as part of the ground.
 */
export function Trail() {
  useEffect(() => {
    field.setTrail(true);
    return () => field.setTrail(false);
  }, []);
  return null;
}
