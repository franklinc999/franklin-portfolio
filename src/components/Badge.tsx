"use client";

import { useEffect, useRef } from "react";
import { field } from "@/lib/field/engine";
import { stickerStore } from "@/lib/stickerStore";
import dynamic from "next/dynamic";

// The foil stamp is a small WebGL shader, so it arrives after the card itself.
const Seal = dynamic(() => import("@/components/Seal"), { ssr: false });

const POINTS = 10;
const GRAVITY = 3400;
const CLIP = 16; // gap between the end of the lanyard and the top edge of the card

type Point = { x: number; y: number; px: number; py: number };

/**
 * A glass badge on a lanyard. The lanyard is a small verlet rope and the
 * badge hangs from its end. Grab the badge and it follows the cursor
 * anywhere: past the lanyard's length the band stretches, and on release it
 * snaps back and the badge swings and twists until it settles. Because the
 * badge is registered with the field as a lens, whatever it passes over bends.
 */
export function Badge() {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<SVGPathElement>(null);
  const edgeRef = useRef<SVGPathElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

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
    // How far past its length the band is pulled (1 = at rest), and how fast that is changing.
    let stretch = 1;
    let stretchVel = 0;
    // In-plane swing, and the twist and nod that make it read as a real object.
    let phi = 0;
    let phiVel = 0;
    let twist = 0;
    let twistVel = 0;
    let nod = 0;
    let nodVel = 0;
    let lastCx = 0;
    let lastCy = 0;
    let dragging = false;
    let grabX = 0;
    let grabY = 0;
    let targetX = 0;
    let targetY = 0;
    let throwX = 0;
    let throwY = 0;
    let lastMove = 0;
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
      ay = parseFloat(cs.getPropertyValue("--anchor-y")) || -40;
      const dropTo = parseFloat(cs.getPropertyValue("--drop")) || 164;
      rope = dropTo - CLIP - ay;
      // On narrow screens the badge hangs above the name instead of beside it:
      // size the lanyard so the bottom bezel just reaches the tops of the letters.
      const overlapY = parseFloat(cs.getPropertyValue("--overlap-y"));
      const nameBox = stage.parentElement?.querySelector<HTMLElement>(".field-text");
      const stacked = Number.isFinite(overlapY) && !!nameBox;
      if (stacked && nameBox) {
        const top = nameBox.getBoundingClientRect().top - stage.getBoundingClientRect().top;
        rope = Math.max(48, top + overlapY - ay - CLIP - ch);
      }
      seg = rope / (POINTS - 1);
      const hint = hintRef.current;
      if (hint) {
        if (stacked) {
          hint.style.left = `${Math.max(0, ax - cw / 2 - hint.offsetWidth - 12)}px`;
          hint.style.top = `${ay + rope + CLIP + ch / 2 - hint.offsetHeight / 2}px`;
        } else {
          hint.style.left = `${ax - hint.offsetWidth / 2}px`;
          hint.style.top = `${ay + rope + CLIP + ch + 18}px`;
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
      phiVel = 0;
      twist = twistVel = nod = nodVel = 0;
      stretch = 1;
      stretchVel = 0;
      lastCx = end.x - Math.sin(phi) * (CLIP + ch / 2);
      lastCy = end.y + Math.cos(phi) * (CLIP + ch / 2);
      calm = 0;
      asleep = false;
    };

    // While held, the badge goes wherever the pointer goes. Nothing clamps it
    // to the lanyard's reach: the band stretches instead.
    const aim = (mx: number, my: number) => {
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      targetX = mx - (c * grabX - s * grabY);
      targetY = my - (s * grabX + c * grabY);
    };

    const simulate = (dt: number) => {
      const steps = 3;
      const h = dt / steps;
      // Damping is per second, not per step, so it feels the same at 60 and 120 Hz.
      const endDamp = Math.exp(-0.42 * h);
      const ropeDamp = Math.exp(-2.4 * h);
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
          stretch = Math.max(1, Math.hypot(end.x - ax, end.y - ay) / rope);
          stretchVel = 0;
        } else if (stretch > 1 || stretchVel !== 0) {
          // Let go while stretched and the band pulls back like elastic.
          stretchVel += (-(stretch - 1) * 190 - stretchVel * 15) * h;
          stretch += stretchVel * h;
          if (stretch <= 1) {
            stretch = 1;
            stretchVel = 0;
          }
        }
        const len = seg * stretch;
        for (let it = 0; it < 8; it++) {
          for (let i = 0; i < POINTS - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1e-6;
            const diff = (d - len) / d;
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

    // The badge points away from the anchor while the band is taut, and hangs
    // straight when it is slack.
    const lean = () => {
      const dx = end.x - ax;
      const dy = end.y - ay;
      const d = Math.hypot(dx, dy) || 1;
      const taut = Math.min(1, Math.max(0, (d / rope - 0.82) / 0.16));
      const angle = Math.max(-1.15, Math.min(1.15, Math.atan2(-dx, dy)));
      return angle * taut * taut * (3 - 2 * taut);
    };

    const paint = () => {
      const cx = end.x - Math.sin(phi) * (CLIP + ch / 2);
      const cy = end.y + Math.cos(phi) * (CLIP + ch / 2);
      // Twist and nod are drawn without perspective, which makes them exact
      // scales. The glass underneath can then match the card to the pixel.
      const sx = Math.cos(twist);
      const sy = Math.cos(nod);
      card.style.transform = `translate3d(${cx - cw / 2}px,${cy - ch / 2}px,0) rotate(${phi}rad) scale(${sx},${sy})`;

      let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < POINTS - 1; i++) {
        const p = pts[i];
        const n = pts[i + 1];
        d += ` Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)} ${((p.y + n.y) / 2).toFixed(1)}`;
      }
      d += ` L${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
      band.setAttribute("d", d);
      edge.setAttribute("d", d);
      // A stretched band gets thinner.
      const thin = 1 / Math.sqrt(stretch);
      band.style.strokeWidth = `${(7 * thin).toFixed(2)}px`;
      edge.style.strokeWidth = `${(11 * thin).toFixed(2)}px`;

      const sr = stage.getBoundingClientRect();
      field.setGeometry(card, {
        cx: sr.left + cx,
        cy: sr.top + window.scrollY + cy,
        w: cw * sx,
        h: ch * sy,
        angle: phi,
      });
    };

    const tick = (dt: number) => {
      if (!ready) return;
      const sr = stage.getBoundingClientRect();
      if (sr.bottom < -200 || sr.top > window.innerHeight + 200) return;
      if (asleep && !dragging) return;

      simulate(dt);
      phiVel += ((lean() - phi) * 150 - phiVel * 15) * dt;
      phi += phiVel * dt;

      const cx = end.x - Math.sin(phi) * (CLIP + ch / 2);
      const cy = end.y + Math.cos(phi) * (CLIP + ch / 2);
      const vx = (cx - lastCx) / dt;
      const vy = (cy - lastCy) / dt;
      lastCx = cx;
      lastCy = cy;
      // Moving sideways twists the badge about its lanyard; moving up or down nods it.
      const twistTo = Math.max(-1.2, Math.min(1.2, vx * 0.00062));
      const nodTo = Math.max(-0.7, Math.min(0.7, -vy * 0.00034));
      twistVel += ((twistTo - twist) * 95 - twistVel * 8.5) * dt;
      twist += twistVel * dt;
      nodVel += ((nodTo - nod) * 95 - nodVel * 10) * dt;
      nod += nodVel * dt;
      twist = Math.max(-1.25, Math.min(1.25, twist));
      nod = Math.max(-0.8, Math.min(0.8, nod));
      paint();

      const motion =
        Math.abs(end.x - end.px) +
        Math.abs(end.y - end.py) +
        (Math.abs(phiVel) + Math.abs(twistVel) + Math.abs(nodVel)) * 0.05 +
        Math.abs(twist) +
        Math.abs(stretch - 1);
      calm = motion < 0.03 ? calm + 1 : 0;
      if (calm > 45 && !dragging) asleep = true;
    };

    const local = (e: PointerEvent) => {
      const sr = stage.getBoundingClientRect();
      return { x: e.clientX - sr.left, y: e.clientY - sr.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !ready) return;
      // A sticker on the badge is being peeled off; that is not a pull on the badge.
      if (e.target instanceof Element && e.target.closest(".sticker")) return;
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
      throwX = throwY = 0;
      lastMove = performance.now();
      dragging = true;
      asleep = false;
      calm = 0;
      card.dataset.dragging = "";
      aim(m.x, m.y);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const m = local(e);
      const beforeX = targetX;
      const beforeY = targetY;
      aim(m.x, m.y);
      const now = performance.now();
      const span = Math.max(1, now - lastMove) / 1000;
      lastMove = now;
      // Smoothed pointer velocity, so a flick carries into the release.
      throwX += ((targetX - beforeX) / span - throwX) * 0.5;
      throwY += ((targetY - beforeY) / span - throwY) * 0.5;
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      delete card.dataset.dragging;
      if (card.hasPointerCapture(e.pointerId)) card.releasePointerCapture(e.pointerId);
      // If the pointer sat still before letting go, there is no throw.
      const stale = performance.now() - lastMove > 90;
      const step = 1 / 180;
      end.px = end.x - (stale ? 0 : Math.max(-3200, Math.min(3200, throwX)) * step);
      end.py = end.y - (stale ? 0 : Math.max(-3200, Math.min(3200, throwY)) * step);
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
      stickerStore.setBadge(card);
    };
    if (document.fonts?.status === "loaded") begin();
    else (document.fonts?.ready ?? Promise.resolve()).then(begin, begin);
    const stop = field.onFrame(tick);

    return () => {
      mounted = false;
      stickerStore.setBadge(null);
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
      <p ref={hintRef} className="badge-hint note" aria-hidden="true">
        pull me, I&rsquo;m glass
      </p>
      <div ref={cardRef} className="badge glass">
        <span className="badge-clip" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="badge-photo" src="/assets/badge.jpg" alt="Franklin Cheng on a cliff above the sea" width={720} height={540} draggable={false} />
        <span className="badge-seal" aria-hidden="true">
          <Seal />
        </span>
        <p className="badge-name">Franklin Cheng</p>
        <p className="badge-role">Product, agents, games</p>
        <dl className="badge-facts">
          <div>
            <dt>Day job</dt>
            <dd>Call of Duty</dd>
          </div>
          <div>
            <dt>Based</dt>
            <dd>Los Angeles</dd>
          </div>
          <div>
            <dt>Plays</dt>
            <dd>Valorant, LoL</dd>
          </div>
          <div>
            <dt>Also</dt>
            <dd>Tea, pickleball</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
