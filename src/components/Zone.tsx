"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { field } from "@/lib/field/engine";
import type { ThemeName } from "@/lib/field/shader";

type Props = {
  theme: ThemeName;
  as?: "section" | "div" | "header" | "footer";
  id?: string;
  className?: string;
  children: ReactNode;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

/**
 * A stretch of the page with its own ground. From the top of this element
 * down to the next zone, the field paints the named theme, and the CSS inside
 * it switches to that theme's ink.
 */
export function Zone({ theme, as: Tag = "section", className = "", children, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return field.registerZone(ref.current, theme);
  }, [theme]);

  return (
    <Tag ref={ref as never} data-zone={theme} className={`zone ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}
