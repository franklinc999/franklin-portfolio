"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "../gift.module.css";

/** Animated 2000s film grain, vignette, drifting light leaks and an orange date stamp. */
export function FilmOverlay({ stamp }: { stamp: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // pre-bake a handful of noise frames at roughly screen resolution, then cycle them
    const W = Math.min(900, Math.ceil(window.innerWidth));
    const H = Math.min(900, Math.ceil(window.innerHeight));
    c.width = W;
    c.height = H;
    const frames = Array.from({ length: 6 }, () => {
      const img = ctx.createImageData(W, H);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      return img;
    });
    let raf = 0;
    let last = 0;
    let k = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 1000 / 12) return; // 12fps grain feels like film, not TV static
      last = t;
      ctx.putImageData(frames[k++ % frames.length], 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <canvas ref={ref} className={s.grain} aria-hidden />
      <div className={s.vignette} aria-hidden />
      <div className={`${s.leak} ${s.leakA}`} aria-hidden />
      <div className={`${s.leak} ${s.leakB}`} aria-hidden />
      <div className={s.stamp} aria-hidden>
        {stamp}
      </div>
    </>
  );
}

/** '26 11 12 style stamp from a Date */
export function dateStamp(d: Date) {
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, " ");
  const dd = String(d.getDate()).padStart(2, " ");
  return `'${yy} ${mm} ${dd}`;
}

export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [ref, on] = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className={`${s.reveal} ${on ? s.revealOn : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Checks whether a media file exists so placeholders can show until you drop the real file in. */
export function useAssetExists(src: string) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(src, { method: "HEAD" })
      .then((r) => alive && setOk(r.ok))
      .catch(() => alive && setOk(false));
    return () => {
      alive = false;
    };
  }, [src]);
  return ok;
}
