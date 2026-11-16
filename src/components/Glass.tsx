"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { field } from "@/lib/field/engine";
import type { GlassKind } from "@/lib/field/engine";

type GlassProps = {
  as?: ElementType;
  kind?: GlassKind;
  /** Brighten the rim on hover and focus. Use on slabs that are links. */
  hover?: boolean;
  className?: string;
  children?: ReactNode;
  [prop: string]: unknown;
};

/**
 * A slab of glass. The element itself is transparent: the field canvas draws
 * the refraction, frost, rim light and shadow underneath it. Until the canvas
 * takes over (or if WebGL is missing) a frosted CSS surface stands in.
 */
export function Glass({ as = "div", kind = "panel", hover = false, className = "", children, ...rest }: GlassProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return field.register(ref.current, kind, { hover });
  }, [kind, hover]);

  const Tag = as;
  return (
    <Tag ref={ref} className={`glass glass-${kind} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

type GlassLinkProps = { href: string; kind?: GlassKind; className?: string; children?: ReactNode };

/** A glass slab that is a link. Internal paths route through Next, anything else opens in a new tab. */
export function GlassLink({ href, kind = "card", ...rest }: GlassLinkProps) {
  if (href.startsWith("/")) {
    return <Glass as={Link} href={href} kind={kind} hover {...rest} />;
  }
  return <Glass as="a" href={href} target="_blank" rel="noopener noreferrer" kind={kind} hover {...rest} />;
}
