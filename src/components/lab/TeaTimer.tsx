"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { field } from "@/lib/field/engine";

type Tea = { name: string; tempF: number; tempC: number; first: number; add: number; color: string };

// Common gongfu starting points. Leaf, pot and taste all move these.
const TEAS: Tea[] = [
  { name: "Green", tempF: 175, tempC: 80, first: 15, add: 5, color: "#b9c96a" },
  { name: "White", tempF: 185, tempC: 85, first: 20, add: 10, color: "#e2c780" },
  { name: "Oolong", tempF: 200, tempC: 95, first: 20, add: 5, color: "#d49a3d" },
  { name: "Black", tempF: 200, tempC: 95, first: 15, add: 5, color: "#b4532a" },
  { name: "Pu-erh", tempF: 212, tempC: 100, first: 10, add: 5, color: "#7a3b22" },
];

const SESSION = 6; // steeps shown on the session strip
const CUP_TOP = 34;
const CUP_BOTTOM = 148;

/**
 * A gongfu brewing timer. Pick a tea, start the steep, and the cup fills as
 * the seconds run. Each steep after the first runs a little longer.
 */
export function TeaTimer() {
  const [teaIndex, setTeaIndex] = useState(2);
  const [steep, setSteep] = useState(1);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(TEAS[2].first);
  const [done, setDone] = useState(false);

  const tea = TEAS[teaIndex];
  const total = tea.first + tea.add * (steep - 1);

  const startRef = useRef(0);
  const levelRef = useRef(0);
  const waveRef = useRef<SVGPathElement>(null);
  const stateRef = useRef({ running, total, done });
  useEffect(() => {
    stateRef.current = { running, total, done };
  }, [running, total, done]);

  // The liquid: its level follows the clock and its surface never sits quite still.
  useEffect(() => {
    return field.onFrame((dt, now) => {
      const calm = field.motionOff;
      const st = stateRef.current;
      let target = st.done ? 1 : 0;
      if (st.running) {
        const elapsed = (now - startRef.current) / 1000;
        target = Math.min(1, elapsed / st.total);
        const remaining = Math.max(0, Math.ceil(st.total - elapsed));
        setLeft((prev) => (prev === remaining ? prev : remaining));
        if (elapsed >= st.total) {
          setRunning(false);
          setDone(true);
        }
      }
      levelRef.current += (target - levelRef.current) * Math.min(1, dt * (st.running ? 12 : 4));
      const path = waveRef.current;
      if (!path) return;
      const y = CUP_BOTTOM - (CUP_BOTTOM - CUP_TOP) * levelRef.current;
      const amp = calm ? 0 : 1.2 + (st.running ? 1.6 : 0.4);
      const t = now / 1000;
      let d = `M0 ${CUP_BOTTOM + 20} L0 ${y.toFixed(2)}`;
      for (let x = 0; x <= 200; x += 10) {
        const wy = y + Math.sin(x * 0.06 + t * 2.4) * amp + Math.sin(x * 0.11 - t * 1.7) * amp * 0.5;
        d += ` L${x} ${wy.toFixed(2)}`;
      }
      d += ` L200 ${CUP_BOTTOM + 20} Z`;
      path.setAttribute("d", d);
    });
  }, []);

  const pick = (i: number) => {
    setTeaIndex(i);
    setSteep(1);
    setRunning(false);
    setDone(false);
    setLeft(TEAS[i].first);
  };

  const start = () => {
    startRef.current = performance.now();
    setDone(false);
    setLeft(total);
    setRunning(true);
  };

  const next = () => {
    const n = steep + 1;
    setSteep(n);
    setDone(false);
    setRunning(false);
    setLeft(tea.first + tea.add * (n - 1));
  };

  const reset = () => pick(teaIndex);

  // The session at a glance: each steep a little longer than the last.
  const first = Math.max(1, steep - SESSION + 1);
  const session = Array.from({ length: SESSION }, (_, i) => {
    const n = first + i;
    const seconds = tea.first + tea.add * (n - 1);
    return { n, seconds, state: n < steep || (n === steep && done) ? "done" : n === steep ? "now" : "next" };
  });
  const tallest = session[session.length - 1].seconds;

  return (
    <div className="tea">
      <svg className="tea-cup" viewBox="0 0 200 190" role="img" aria-label={`A glass cup of ${tea.name.toLowerCase()} tea`}>
        <defs>
          <clipPath id="tea-bowl">
            <path d="M34 30 H166 C166 96 150 150 100 150 C50 150 34 96 34 30 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#tea-bowl)">
          <path ref={waveRef} fill={tea.color} opacity="0.86" />
        </g>
        <path className="tea-glass" d="M34 30 H166 C166 96 150 150 100 150 C50 150 34 96 34 30 Z" />
        <path className="tea-shine" d="M48 44 C50 84 58 116 78 134" />
        <path className="tea-saucer" d="M52 164 H148" />
      </svg>

      <div className="tea-panel">
        <fieldset className="seg" aria-label="Tea">
          {TEAS.map((t, i) => (
            <label key={t.name} className="seg-item">
              <input type="radio" name="tea" checked={i === teaIndex} onChange={() => pick(i)} />
              <span>{t.name}</span>
            </label>
          ))}
        </fieldset>

        <p className="tea-clock" aria-live="off">
          <span className="tea-seconds" data-bump={done ? "" : undefined}>
            {left}
          </span>
          <span className="tea-unit">{done ? "Pour." : running ? "seconds left" : "second steep"}</span>
        </p>
        <p className="tea-meta">
          Steep {steep}, water at {tea.tempF}°F ({tea.tempC}°C)
        </p>

        <div className="tea-actions">
          {done ? (
            <button type="button" className="btn btn-solid" onClick={next}>
              Next steep
            </button>
          ) : (
            <button type="button" className="btn btn-solid" onClick={start} disabled={running}>
              {running ? "Steeping" : "Start the steep"}
            </button>
          )}
          <button type="button" className="btn btn-glass" onClick={reset}>
            Start over
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {done ? `Steep ${steep} is done. Pour.` : ""}
        </p>
      </div>

      <div className="tea-session">
        <p className="meta">The session</p>
        <ol>
          {session.map((s) => (
            <li key={s.n} data-state={s.state} style={{ "--h": (s.seconds / tallest).toFixed(3) } as CSSProperties}>
              <span className="tea-bar" aria-hidden="true" />
              <span className="tea-bar-label">
                <span className="sr-only">Steep {s.n}: </span>
                {s.seconds}s
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
