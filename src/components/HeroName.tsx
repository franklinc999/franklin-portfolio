"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field/engine";

/**
 * The page's headline, drawn into the map itself. The real heading stays in
 * the document for readers, search and selection; once the field has painted
 * the letters, the DOM copy goes transparent so glass can bend them.
 */
export function HeroName({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    field.setText(el);
    const ro = new ResizeObserver(() => field.setText(el));
    ro.observe(el);
    return () => {
      ro.disconnect();
      field.setText(null);
    };
  }, []);

  return (
    <h1 ref={ref} className="display field-text">
      {lines.map((line) => (
        <span key={line} data-field-line>
          {line}
        </span>
      ))}
    </h1>
  );
}
