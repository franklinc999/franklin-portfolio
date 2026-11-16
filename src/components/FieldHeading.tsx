"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field/engine";

type Props = {
  as?: "h1" | "h2" | "h3" | "p";
  id?: string;
  className?: string;
  children: string;
};

/**
 * A heading drawn into the ground instead of on top of it. It takes its ink
 * from whichever zone it sits in, ripples into place the first time it is
 * scrolled to, and bends under any glass that passes over it. Each word is its
 * own box so the browser still does the wrapping.
 */
export function FieldHeading({ as: Tag = "h2", id, className = "", children }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const remove = field.addText(el);
    const ro = new ResizeObserver(() => field.refreshText());
    ro.observe(el);
    return () => {
      ro.disconnect();
      remove();
    };
  }, [children]);

  const words = children.split(" ");
  return (
    <Tag ref={ref} id={id} className={`field-text field-heading ${className}`.trim()}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          <span data-field-line>{word}</span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}
