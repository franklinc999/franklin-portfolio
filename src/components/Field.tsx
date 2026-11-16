"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field/engine";

/** The contour map behind every page, and the canvas all glass is drawn on. */
export function Field() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return field.mount(ref.current);
  }, []);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
