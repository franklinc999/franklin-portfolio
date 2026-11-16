"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { field } from "@/lib/field/engine";

/** The ground behind every page, and the canvas all glass is drawn on. */
export function Field() {
  const ref = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!ref.current) return;
    return field.mount(ref.current);
  }, []);

  // A new page brings new zones. Dip the canvas and let it fade back so the
  // ground changes like a scene change, not a jump cut.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      return;
    }
    el.classList.remove("field-dip");
    void el.offsetWidth;
    el.classList.add("field-dip");
    field.invalidate();
  }, [pathname]);

  return (
    <div className="field" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
