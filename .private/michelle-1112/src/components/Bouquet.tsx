
import { useEffect, useRef, useState } from "react";
import type { FlowerKind } from "../content";
import s from "../gift.module.css";
import { useInView } from "./film";

type StemCfg = { kind: FlowerKind; color: string; count: number; note: string };
type Stem = {
  kind: FlowerKind;
  color: string;
  note: string;
  angle: number; // radians from vertical
  len: number; // 0..1 of canvas height
  delay: number; // seconds
  size: number;
  phase: number;
  seed: number;
  head: { x: number; y: number };
};

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * Procedural bouquet that blooms when scrolled into view.
 * Edit `gift.bouquet.stems` to match the real one you buy. Tap a flower to read its note.
 */
export function Bouquet({ stems, wrap, ribbon }: { stems: StemCfg[]; wrap: string; ribbon: string }) {
  const [ref, inView] = useInView<HTMLCanvasElement>(0.35);
  const [note, setNote] = useState<string>("");
  const flowers = useRef<Stem[]>([]);

  // lay out stems once: fillers at the back, focal flowers in front, fanned from the binding point
  useEffect(() => {
    const order: FlowerKind[] = ["eucalyptus", "babysbreath", "daisy", "lily", "tulip", "ranunculus", "peony", "rose"];
    const all: Omit<Stem, "angle" | "len" | "delay" | "head">[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    stems.forEach((c) => {
      for (let i = 0; i < c.count; i++)
        all.push({ kind: c.kind, color: c.color, note: c.note, size: 1, phase: rnd() * Math.PI * 2, seed: rnd() });
    });
    all.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    const n = all.length;
    flowers.current = all.map((f, i) => {
      const back = f.kind === "eucalyptus" || f.kind === "babysbreath";
      const spread = back ? 1.25 : 0.95;
      const t = n === 1 ? 0.5 : ((i * 0.618) % 1);
      const angle = (t - 0.5) * spread;
      return {
        ...f,
        angle,
        len: (back ? 0.36 : 0.26) + rnd() * 0.08 - Math.abs(angle) * 0.06,
        delay: (i / n) * 1.8 + rnd() * 0.3,
        size: back ? 1 : 0.85 + rnd() * 0.35,
        head: { x: 0, y: 0 },
      };
    });
  }, [stems]);

  useEffect(() => {
    const c = ref.current;
    if (!c || !inView) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const W = c.width;
    const H = c.height;
    const U = W / 100; // unit
    const base = { x: W / 2, y: H * 0.74 };
    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);

      // back paper
      drawPaper(ctx, base, U, wrap, true);

      for (const f of flowers.current) {
        const grow = ease((t - f.delay) / 1.4);
        const bloom = ease((t - f.delay - 0.9) / 1.6);
        if (grow <= 0) continue;
        const sway = Math.sin(t * 0.9 + f.phase) * 0.025 * grow;
        const a = f.angle + sway;
        const L = f.len * H * grow;
        const tip = { x: base.x + Math.sin(a) * L, y: base.y - Math.cos(a) * L };
        const ctrl = { x: base.x + Math.sin(a * 0.4) * L * 0.5, y: base.y - L * 0.55 };
        f.head = tip;
        ctx.strokeStyle = "#3f5e3a";
        ctx.lineWidth = U * 0.55;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(base.x, base.y + U * 6);
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, tip.x, tip.y);
        ctx.stroke();
        drawFlower(ctx, f, tip, a, U * 8.5 * f.size, bloom, t);
      }

      // front paper + ribbon
      drawPaper(ctx, base, U, wrap, false);
      drawRibbon(ctx, base, U, ribbon, t);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [inView, ref, wrap, ribbon]);

  const pick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * c.width;
    const y = ((e.clientY - r.top) / r.height) * c.height;
    let best: Stem | null = null;
    let bd = Infinity;
    for (const f of flowers.current) {
      const d = Math.hypot(f.head.x - x, f.head.y - y);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    if (best && bd < c.width * 0.09) setNote(best.note);
  };

  return (
    <>
      <canvas ref={ref} className={s.bouquetCanvas} onPointerDown={pick} />
      <p className={s.flowerNote}>{note || "tap a flower"}</p>
    </>
  );
}

function drawPaper(ctx: CanvasRenderingContext2D, b: { x: number; y: number }, U: number, color: string, back: boolean) {
  ctx.save();
  if (back) {
    ctx.fillStyle = shade(color, -18);
    ctx.beginPath();
    ctx.moveTo(b.x - U * 4, b.y + U * 22);
    ctx.lineTo(b.x - U * 34, b.y - U * 22);
    ctx.quadraticCurveTo(b.x, b.y - U * 32, b.x + U * 34, b.y - U * 22);
    ctx.lineTo(b.x + U * 4, b.y + U * 22);
    ctx.closePath();
    ctx.fill();
  } else {
    const g = ctx.createLinearGradient(b.x - U * 30, 0, b.x + U * 30, 0);
    g.addColorStop(0, shade(color, -10));
    g.addColorStop(0.5, color);
    g.addColorStop(1, shade(color, -14));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(b.x - U * 4, b.y + U * 22);
    ctx.lineTo(b.x - U * 28, b.y - U * 6);
    ctx.lineTo(b.x - U * 10, b.y - U * 2);
    ctx.lineTo(b.x, b.y - U * 9);
    ctx.lineTo(b.x + U * 10, b.y - U * 2);
    ctx.lineTo(b.x + U * 28, b.y - U * 6);
    ctx.lineTo(b.x + U * 4, b.y + U * 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = U * 0.3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y - U * 9);
    ctx.lineTo(b.x, b.y + U * 20);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRibbon(ctx: CanvasRenderingContext2D, b: { x: number; y: number }, U: number, color: string, t: number) {
  const y = b.y + U * 10;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(b.x - U * 7, y - U * 1.6, U * 14, U * 3.2);
  const flutter = Math.sin(t * 1.3) * U * 0.8;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(b.x, y);
    ctx.quadraticCurveTo(b.x + dir * U * 8, y - U * 6, b.x + dir * U * 9, y);
    ctx.quadraticCurveTo(b.x + dir * U * 8, y + U * 3, b.x, y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x, y);
    ctx.lineTo(b.x + dir * U * 4 + flutter, y + U * 13);
    ctx.lineTo(b.x + dir * U * 6.5 + flutter, y + U * 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(b.x, y, U * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = shade(color, -20);
  ctx.fill();
  ctx.restore();
}

function petal(ctx: CanvasRenderingContext2D, len: number, wid: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(wid, -len * 0.3, wid * 0.8, -len, 0, -len);
  ctx.bezierCurveTo(-wid * 0.8, -len, -wid, -len * 0.3, 0, 0);
  ctx.fill();
}

function drawFlower(
  ctx: CanvasRenderingContext2D,
  f: Stem,
  p: { x: number; y: number },
  a: number,
  R: number,
  bloom: number,
  t: number,
) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(a * 0.6);
  const b = Math.max(0.15, bloom);
  const c = f.color;

  switch (f.kind) {
    case "rose": {
      const layers = 5;
      for (let L = layers; L >= 1; L--) {
        const k = L / layers;
        const n = 5;
        ctx.fillStyle = shade(c, (1 - k) * -35 + (L % 2 ? 0 : 8));
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.rotate((i / n) * Math.PI * 2 + L * 0.7 + f.seed * 6);
          ctx.beginPath();
          ctx.ellipse(0, -R * 0.32 * k * b, R * 0.48 * k * (0.5 + b * 0.5), R * 0.38 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.strokeStyle = shade(c, -45);
      ctx.lineWidth = R * 0.05;
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const th = i * 0.75;
        const rr = (R * 0.03 + i * R * 0.018) * b;
        ctx.lineTo(Math.cos(th) * rr, Math.sin(th) * rr);
      }
      ctx.stroke();
      break;
    }
    case "peony":
    case "ranunculus": {
      const layers = f.kind === "peony" ? 7 : 9;
      const scale = f.kind === "peony" ? 1.15 : 0.85;
      for (let L = layers; L >= 1; L--) {
        const k = L / layers;
        const n = f.kind === "peony" ? 8 : 10;
        ctx.fillStyle = shade(c, (1 - k) * 22 - 10 + (L % 2) * 6);
        for (let i = 0; i < n; i++) {
          ctx.save();
          ctx.rotate((i / n) * Math.PI * 2 + L * 0.45);
          ctx.beginPath();
          ctx.ellipse(0, -R * 0.42 * k * scale * b, R * 0.3 * k * scale, R * 0.26 * k * scale, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      if (f.kind === "ranunculus") {
        ctx.fillStyle = "#5d6b3a";
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "tulip": {
      ctx.fillStyle = shade(c, -20);
      for (const s2 of [-1, 1]) {
        ctx.save();
        ctx.rotate(s2 * 0.35 * b);
        petal(ctx, R * 1.2, R * 0.55);
        ctx.restore();
      }
      ctx.fillStyle = c;
      petal(ctx, R * 1.25, R * 0.6);
      break;
    }
    case "lily": {
      ctx.fillStyle = c;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i / 6) * Math.PI * 2);
        petal(ctx, R * 1.25 * b, R * 0.3);
        ctx.restore();
      }
      ctx.strokeStyle = "#a8742a";
      ctx.lineWidth = R * 0.04;
      for (let i = 0; i < 6; i++) {
        const th = (i / 6) * Math.PI * 2 + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(th) * R * 0.55 * b, Math.sin(th) * R * 0.55 * b);
        ctx.stroke();
      }
      break;
    }
    case "daisy": {
      ctx.fillStyle = c;
      for (let i = 0; i < 16; i++) {
        ctx.save();
        ctx.rotate((i / 16) * Math.PI * 2);
        petal(ctx, R * 0.85 * b, R * 0.14);
        ctx.restore();
      }
      ctx.fillStyle = "#e3b23c";
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "babysbreath": {
      let sd = f.seed * 1000;
      const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
      ctx.strokeStyle = "#6f8a63";
      ctx.lineWidth = R * 0.04;
      for (let i = 0; i < 22; i++) {
        const th = rnd() * Math.PI * 2;
        const rr = rnd() * R * 1.3 * b;
        const x = Math.cos(th) * rr;
        const y = Math.sin(th) * rr * 0.8 - R * 0.3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, R * (0.07 + rnd() * 0.05) * (0.4 + b * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "eucalyptus": {
      ctx.fillStyle = c;
      for (let i = 0; i < 7; i++) {
        const y = -i * R * 0.38;
        const sway = Math.sin(t + i) * R * 0.03;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(side * R * 0.22 * b + sway, y + R * 0.6, R * 0.2 * b, R * 0.17 * b, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
  }
  ctx.restore();
}

function shade(hex: string, amt: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  const cl = (v: number) => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + amt);
  const g = cl(((n >> 8) & 255) + amt);
  const b = cl((n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}
