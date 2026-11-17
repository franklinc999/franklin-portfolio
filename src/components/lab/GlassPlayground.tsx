"use client";

import { useEffect, useRef, useState } from "react";
import { Glass } from "@/components/Glass";
import { field, PRESETS } from "@/lib/field/engine";

const START = {
  radius: 28,
  bezel: PRESETS.panel.bezel,
  strength: PRESETS.panel.strength,
  frost: PRESETS.panel.frost,
  zoom: PRESETS.panel.zoom,
};

type Key = keyof typeof START;

/* The same letters the drawing uses, so a dial can be found on the sheet. */
const DIALS: { key: Key; symbol: string; name: string; min: number; max: number; step: number; digits: number }[] = [
  { key: "radius", symbol: "R1", name: "corner radius", min: 0, max: 90, step: 1, digits: 0 },
  { key: "bezel", symbol: "B", name: "bezel width", min: 6, max: 90, step: 1, digits: 0 },
  { key: "strength", symbol: "S", name: "bend", min: 0, max: 1.2, step: 0.02, digits: 2 },
  { key: "frost", symbol: "F", name: "frost", min: 0, max: 12, step: 0.2, digits: 1 },
  { key: "zoom", symbol: "Z", name: "magnification", min: 1, max: 1.4, step: 0.01, digits: 2 },
];

/**
 * A live slab over open ground. Drag it to watch the grid bend under its rim,
 * and turn the dials to change the optics the whole site is drawn with.
 */
export function GlassPlayground() {
  const [dials, setDials] = useState(START);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const slabRef = useRef<HTMLDivElement>(null);
  const grip = useRef({ px: 0, py: 0, x: 0, y: 0 });

  useEffect(() => {
    if (!slabRef.current) return;
    return field.register(slabRef.current, "panel");
  }, []);

  useEffect(() => {
    if (slabRef.current) field.tune(slabRef.current, dials);
  }, [dials]);

  useEffect(() => {
    field.invalidate();
  }, [pos]);

  const clamp = (x: number, y: number) => {
    const stage = stageRef.current;
    const slab = slabRef.current;
    if (!stage || !slab) return { x, y };
    const mx = Math.max(0, (stage.clientWidth - slab.offsetWidth) / 2);
    const my = Math.max(0, (stage.clientHeight - slab.offsetHeight) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };

  const changed = DIALS.some((d) => dials[d.key] !== START[d.key]);

  return (
    <div className="playground">
      <div ref={stageRef} className="playground-stage">
        <p className="annot on-map playground-caption">fig. 4: a live slab on open ground</p>
        <div
          ref={slabRef}
          className="glass playground-slab"
          role="group"
          tabIndex={0}
          aria-label="A slab of glass. Drag it, or use the arrow keys, to move it across the grid."
          data-dragging={dragging ? "" : undefined}
          style={{ borderRadius: dials.radius, translate: `${pos.x}px ${pos.y}px` }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            grip.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
            setDragging(true);
            setTouched(true);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const g = grip.current;
            setPos(clamp(g.x + e.clientX - g.px, g.y + e.clientY - g.py));
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 48 : 16;
            const move: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            const by = move[e.key];
            if (!by) return;
            e.preventDefault();
            setTouched(true);
            setPos((p) => clamp(p.x + by[0], p.y + by[1]));
          }}
        >
          {!touched && <span className="note">drag me</span>}
        </div>
      </div>

      <Glass kind="card" className="playground-controls">
        <div className="demo-head">
          <h3 className="h3">Tune the glass</h3>
          <p>The letters match the drawing. The starting values are the ones every panel on this site uses.</p>
        </div>
        {DIALS.map((d) => (
          <label key={d.key} className="dial">
            <span>
              <b>{d.symbol}</b>
              {d.name}
            </span>
            <output>{dials[d.key].toFixed(d.digits)}</output>
            <input
              type="range"
              min={d.min}
              max={d.max}
              step={d.step}
              value={dials[d.key]}
              onChange={(e) => setDials((v) => ({ ...v, [d.key]: Number(e.target.value) }))}
            />
          </label>
        ))}
        <button
          type="button"
          className="btn btn-glass"
          disabled={!changed}
          onClick={() => {
            setDials(START);
            setPos({ x: 0, y: 0 });
          }}
        >
          Back to the site’s values
        </button>
      </Glass>
    </div>
  );
}
