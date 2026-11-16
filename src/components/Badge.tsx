"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field/engine";

const POINTS = 14;
const GRAVITY = 3200;
const CLIP = 16; // gap between the end of the lanyard and the top edge of the card

type Point = { x: number; y: number; px: number; py: number };

/**
 * A glass badge on a lanyard. The lanyard is a small verlet rope, the badge
 * hangs from its end, and you can pick it up and throw it. Because the badge
 * is registered with the field as a lens, whatever it passes over bends.
 */
export function Badge() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<SVGPathElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    const band = bandRef.current;
    const edge = edgeRef.current;
    if (!stage || !card || !band || !edge) return;

    const unregister = field.register(card, "badge", { explicit: true, order: 10, hover: true });
    const pts: Point[] = Array.from({ length: POINTS }, () => ({ x: 0, y: 0, px: 0, py: 0 }));
    const end = pts[POINTS - 1];

    let cw = 0;
    let ch = 0;
    let ax = 0;
    let ay = 0;
    let rope = 0;
    let seg = 0;
    let phi = 0;
    let spin = 0;
    let dragging = false;
    let grabX = 0;
    let grabY = 0;
    let targetX = 0;
    let targetY = 0;
    let throwX = 0;
    let throwY = 0;
    let calm = 0;
    let asleep = false;
    let ready = false;

    const layout = (swingIn: boolean) => {
      const cs = getComputedStyle(stage);
      cw = card.offsetWidth;
      ch = card.offsetHeight;
      // Hang beside the end of the name, overlapping it by a few px so the
      // bezel always has a letter to bend. --anchor-x is the fallback.
      const overlap = parseFloat(cs.getPropertyValue("--overlap"));
      const nameEnd = stage.parentElement?.querySelector<HTMLElement>("[data-field-line]");
      if (Number.isFinite(overlap) && nameEnd) {
        const range = document.createRange();
        range.selectNodeContents(nameEnd);
        const right = range.getBoundingClientRect().right - stage.getBoundingClientRect().left;
        ax = Math.min(right - overlap + cw / 2, stage.clientWidth - cw / 2 - 16);
      } else {
        ax = stage.clientWidth * (parseFloat(cs.getPropertyValue("--anchor-x")) || 0.74);
      }
      // The lanyard is anchored well above the page. A long pendulum swings
      // slowly and stays close to upright, and it gives the badge room to travel.
      ay = parseFloat(cs.getPropertyValue("--anchor-y")) || -520;
      const drop = parseFloat(cs.getPropertyValue("--drop")) || 164;
      rope = drop - CLIP - ay;
      // On narrow screens the badge hangs above the name instead of beside it:
      // size the lanyard so the bottom bezel just reaches the tops of the letters.
      const overlapY = parseFloat(cs.getPropertyValue("--overlap-y"));
      const nameBox = stage.parentElement?.querySelector<HTMLElement>(".field-text");
      const stacked = Number.isFinite(overlapY) && !!nameBox;
      if (stacked && nameBox) {
        const top = nameBox.getBoundingClientRect().top - stage.getBoundingClientRect().top;
        rope = Math.max(60, top + overlapY - ay - CLIP - ch);
      }
      seg = rope / (POINTS - 1);
      const hint = hintRef.current;
      if (hint) {
        if (stacked) {
          hint.style.left = `${Math.max(0, ax - cw / 2 - hint.offsetWidth - 14)}px`;
          hint.style.top = `${ay + rope + CLIP + ch / 2 - hint.offsetHeight / 2}px`;
        } else {
          hint.style.left = `${ax - hint.offsetWidth / 2}px`;
          hint.style.top = `${ay + rope + CLIP + ch + 20}px`;
        }
      }
      const start = swingIn ? parseFloat(cs.getPropertyValue("--swing")) || 0 : 0;
      const sx = Math.sin(start);
      const sy = Math.cos(start);
      pts.forEach((p, i) => {
        p.x = p.px = ax + sx * seg * i;
        p.y = p.py = ay + sy * seg * i;
      });
      phi = -start;
      spin = 0;
      calm = 0;
      asleep = false;
    };

    const aim = (mx: number, my: number) => {
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      let tx = mx - (c * grabX - s * grabY);
      let ty = my - (s * grabX + c * grabY);
      const dx = tx - ax;
      const dy = ty - ay;
      const d = Math.hypot(dx, dy);
      const reach = rope * 0.992;
      if (d > reach) {
        tx = ax + (dx / d) * reach;
        ty = ay + (dy / d) * reach;
      }
      throwX = tx - targetX;
      throwY = ty - targetY;
      targetX = tx;
      targetY = ty;
    };

    const simulate = (dt: number) => {
      const steps = 3;
      const h = dt / steps;
      // Damping is per second, not per step, so it feels the same at 60 and 120 Hz.
      const endDamp = Math.exp(-0.5 * h);
      const ropeDamp = Math.exp(-2.2 * h);
      for (let s = 0; s < steps; s++) {
        for (let i = 1; i < POINTS; i++) {
          const p = pts[i];
          if (dragging && p === end) continue;
          const damp = p === end ? endDamp : ropeDamp;
          const vx = (p.x - p.px) * damp;
          const vy = (p.y - p.py) * damp;
          p.px = p.x;
          p.py = p.y;
          p.x += vx;
          p.y += vy + GRAVITY * h * h;
        }
        if (dragging) {
          end.px = end.x;
          end.py = end.y;
          end.x = targetX;
          end.y = targetY;
        }
        for (let it = 0; it < 8; it++) {
          for (let i = 0; i < POINTS - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1e-6;
            const diff = (d - seg) / d;
            const wa = i === 0 ? 0 : 1;
            const wb = b === end ? (dragging ? 0 : 0.3) : 1;
            const sum = wa + wb;
            if (!sum) continue;
            a.x += dx * diff * (wa / sum);
            a.y += dy * diff * (wa / sum);
            b.x -= dx * diff * (wb / sum);
            b.y -= dy * diff * (wb / sum);
          }
        }
      }
    };

    const draw = () => {
      const lead = pts[POINTS - 3];
      let ux = end.x - lead.x;
      let uy = end.y - lead.y;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul;
      uy /= ul;
      return Math.max(-1.35, Math.min(1.35, Math.atan2(-ux, uy)));
    };

    const paint = () => {
      const cx = end.x - Math.sin(phi) * (CLIP + ch / 2);
      const cy = end.y + Math.cos(phi) * (CLIP + ch / 2);
      card.style.transform = `translate3d(${cx - cw / 2}px,${cy - ch / 2}px,0) rotate(${phi}rad)`;

      let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < POINTS - 1; i++) {
        const p = pts[i];
        const n = pts[i + 1];
        d += ` Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)} ${((p.y + n.y) / 2).toFixed(1)}`;
      }
      d += ` L${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
      band.setAttribute("d", d);
      edge.setAttribute("d", d);

      const sr = stage.getBoundingClientRect();
      field.setGeometry(card, { cx: sr.left + cx, cy: sr.top + window.scrollY + cy, w: cw, h: ch, angle: phi });
    };

    const tick = (dt: number) => {
      if (!ready) return;
      const sr = stage.getBoundingClientRect();
      if (sr.bottom < -200 || sr.top > window.innerHeight + 200) return;
      if (asleep && !dragging) return;

      simulate(dt);
      const want = draw();
      spin += ((want - phi) * 150 - spin * 16) * dt;
      phi += spin * dt;
      paint();

      const motion = Math.abs(end.x - end.px) + Math.abs(end.y - end.py) + Math.abs(spin) * 0.05;
      calm = motion < 0.02 ? calm + 1 : 0;
      if (calm > 45 && !dragging) asleep = true;
    };

    const local = (e: PointerEvent) => {
      const sr = stage.getBoundingClientRect();
      return { x: e.clientX - sr.left, y: e.clientY - sr.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      card.setPointerCapture(e.pointerId);
      const m = local(e);
      const dx = m.x - end.x;
      const dy = m.y - end.y;
      const c = Math.cos(-phi);
      const s = Math.sin(-phi);
      grabX = c * dx - s * dy;
      grabY = s * dx + c * dy;
      targetX = end.x;
      targetY = end.y;
      dragging = true;
      asleep = false;
      calm = 0;
      card.dataset.dragging = "";
      aim(m.x, m.y);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const m = local(e);
      aim(m.x, m.y);
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete card.dataset.dragging;
      if (card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId);
      end.px = end.x - throwX * 0.35;
      end.py = end.y - throwY * 0.35;
      calm = 0;
      asleep = false;
    };

    const onResize = () => {
      if (!ready) return;
      layout(false);
      paint();
    };

    card.addEventListener("pointerdown", onDown);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerup", onUp);
    card.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);

    // The anchor depends on the width of the name, so wait for the font.
    let mounted = true;
    const begin = () => {
      if (!mounted || ready) return;
      layout(!field.reducedMotion);
      paint();
      ready = true;
      card.dataset.ready = "";
      stage.dataset.ready = "";
    };
    if (document.fonts?.status === "loaded") begin();
    else (document.fonts?.ready ?? Promise.resolve()).then(begin, begin);
    const stop = field.onFrame(tick);

    return () => {
      mounted = false;
      stop();
      unregister();
      card.removeEventListener("pointerdown", onDown);
      card.removeEventListener("pointermove", onMove);
      card.removeEventListener("pointerup", onUp);
      card.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={stageRef} className="badge-stage">
      <svg className="lanyard" aria-hidden="true" focusable="false">
        <path ref={edgeRef} className="lanyard-edge" />
        <path ref={bandRef} className="lanyard-band" />
      </svg>
      <p ref={hintRef} className="badge-hint on-map" aria-hidden="true">
        The badge is glass. Drag it.
      </p>
      <div ref={cardRef} className="badge glass">
        <span className="badge-clip" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="badge-photo" src="/assets/badge.jpg" alt="Franklin Cheng on a cliff above the sea" width={720} height={540} draggable={false} />
        <p className="badge-name">Franklin Cheng</p>
        <p className="badge-role">Associate Product Manager</p>
        <p className="badge-role badge-team">Call of Duty at Activision</p>
        <dl className="badge-facts">
          <div>
            <dt>Team</dt>
            <dd>Call of Duty</dd>
          </div>
          <div>
            <dt>Company</dt>
            <dd>Activision</dd>
          </div>
          <div>
            <dt>Based</dt>
            <dd>Los Angeles</dd>
          </div>
          <div>
            <dt>School</dt>
            <dd>Penn PPE &rsquo;25</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
