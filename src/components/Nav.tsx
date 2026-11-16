"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, BriefcaseBusiness, Gamepad2, House, Mail } from "lucide-react";
import { buildLensMap, supportsBackdropLens } from "@/lib/field/lens";
import type { LensMap } from "@/lib/field/lens";

const ITEMS = [
  { label: "Home", href: "/", icon: House },
  { label: "Work", href: "/work", icon: BriefcaseBusiness },
  { label: "Projects", href: "/projects", icon: Blocks },
  { label: "Play", href: "/play", icon: Gamepad2 },
  { label: "Contact", href: "/contact", icon: Mail },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Floating glass navigation: a capsule at the top on wide screens, a tab bar
 * at the bottom on phones. In Chromium it is a real lens, so page content
 * bends as it scrolls underneath. A second, smaller lens marks the current
 * page and slides to the next one on navigation.
 */
export function Nav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [lens, setLens] = useState<LensMap | null>(null);
  const [mark, setMark] = useState<{ x: number; w: number } | null>(null);

  const active = ITEMS.findIndex((item) =>
    item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  useEffect(() => {
    const el = navRef.current;
    if (!el || !supportsBackdropLens()) return;
    const build = () => {
      const r = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      setLens(buildLensMap(r.width, r.height, radius, 20, 1.3));
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useIsoLayoutEffect(() => {
    const place = () => {
      const link = linkRefs.current[active];
      setMark(link ? { x: link.offsetLeft, w: link.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place).catch(() => {});
    return () => window.removeEventListener("resize", place);
  }, [active]);

  const lensStyle = lens
    ? {
        backdropFilter: "url(#lens-nav) saturate(1.5) brightness(1.08)",
        WebkitBackdropFilter: "url(#lens-nav) saturate(1.5) brightness(1.08)",
      }
    : undefined;

  return (
    <>
      {lens && (
        <svg className="lens-defs" width="0" height="0" aria-hidden="true" focusable="false">
          <filter
            id="lens-nav"
            x="0"
            y="0"
            width={lens.width}
            height={lens.height}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={lens.url}
              x="0"
              y="0"
              width={lens.width}
              height={lens.height}
              preserveAspectRatio="none"
              result="map"
            />
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="soft" />
            <feDisplacementMap in="soft" in2="map" scale={lens.scale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
      <nav ref={navRef} className="nav" aria-label="Primary" style={lensStyle}>
        {mark && (
          <span
            className="nav-mark"
            aria-hidden="true"
            style={{ transform: `translate3d(${mark.x}px,0,0)`, width: mark.w }}
          />
        )}
        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                linkRefs.current[i] = el;
              }}
              className="nav-link"
              aria-current={i === active ? "page" : undefined}
            >
              <Icon className="nav-icon" size={20} strokeWidth={1.6} aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
