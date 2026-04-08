"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Handles:
 * 1. Re-initializing GSAP scroll-reveal animations on every route change
 * 2. Playing a subtle page-enter animation (fade + slide up)
 * 3. Cleaning up ScrollTrigger instances between routes
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;

    const runAnimations = () => {
      const gsap = w.gsap;
      const ScrollTrigger = w.ScrollTrigger;
      if (!gsap || !ScrollTrigger) {
        setTimeout(runAnimations, 100);
        return;
      }
      gsap.registerPlugin(ScrollTrigger);

      // Kill all previous ScrollTriggers to prevent stale triggers
      ScrollTrigger.getAll().forEach((t: { kill: () => void }) => t.kill());

      const container = containerRef.current;
      if (!container) return;

      // Page enter animation (skip on first mount for hero -- hero has its own)
      if (!isFirstMount.current) {
        gsap.fromTo(
          container,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
        );
      }
      isFirstMount.current = false;

      // Hero reveals (only on home page, animate on load)
      const heroElements = container.querySelectorAll(".hero-reveal");
      if (heroElements.length > 0) {
        gsap.fromTo(
          heroElements,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.12, delay: 0.3 }
        );
      }

      // Scroll-triggered reveals
      container.querySelectorAll(".scroll-reveal").forEach((el: Element) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      });

      // Bento items stagger
      container.querySelectorAll(".bento-section").forEach((section: Element) => {
        const items = section.querySelectorAll(".bento-item");
        gsap.fromTo(
          items,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            stagger: 0.08,
            scrollTrigger: {
              trigger: section,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    };

    // Scroll to top on route change
    window.scrollTo(0, 0);

    // Small delay to let React finish rendering the new page
    const timer = setTimeout(runAnimations, 50);

    return () => {
      clearTimeout(timer);
      // Clean up ScrollTrigger on unmount
      const ST = w.ScrollTrigger;
      if (ST) {
        ST.getAll().forEach((t: { kill: () => void }) => t.kill());
      }
    };
  }, [pathname]);

  return (
    <div ref={containerRef}>
      {children}
    </div>
  );
}
