
import { useEffect, useRef, useState } from "react";
import s from "../gift.module.css";

type Props = {
  ticker: string;
  company: string;
  shares: string;
  amount: number;
  why: string;
  rule: string;
  rate: number;
  her: string;
  startYear: number;
};

/** A share certificate with a scratch-off amount and an illustrative "what it grows into" chart. */
export function StockGift({ ticker, company, shares, amount, why, rule, rate, her, startYear }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = c.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    // gold foil scratch layer
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, "#b8893a");
    g.addColorStop(0.45, "#f1d38a");
    g.addColorStop(0.55, "#d9ae5a");
    g.addColorStop(1, "#9c6f28");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
    }
    ctx.fillStyle = "rgba(60,30,10,0.75)";
    ctx.font = `${16 * dpr}px "VT323", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SCRATCH HERE", c.width / 2, c.height / 2);

    let down = false;
    let last: { x: number; y: number } | null = null;
    const pos = (e: PointerEvent) => {
      const rr = c.getBoundingClientRect();
      return { x: (e.clientX - rr.left) * dpr, y: (e.clientY - rr.top) * dpr };
    };
    const scratch = (e: PointerEvent) => {
      if (!down) return;
      const p = pos(e);
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 26 * dpr;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo((last ?? p).x, (last ?? p).y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
    };
    const check = () => {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let clear = 0;
      for (let i = 3; i < d.length; i += 64) if (d[i] === 0) clear++;
      if (clear / (d.length / 64) > 0.45) {
        c.style.transition = "opacity .8s";
        c.style.opacity = "0";
        setRevealed(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture(e.pointerId);
      last = pos(e);
    };
    const onUp = () => {
      down = false;
      last = null;
      check();
    };
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", scratch);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    return () => {
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", scratch);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // illustrative compounding to your 50th anniversary
  const years = [0, 5, 10, 20, 30, 40, 50];
  const vals = years.map((y) => amount * Math.pow(1 + rate, y));
  const max = vals[vals.length - 1];
  const W = 560;
  const H = 200;
  const pts = years.map((y, i) => [30 + (y / 50) * (W - 60), H - 30 - (vals[i] / max) * (H - 60)] as const);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString();

  return (
    <div className={s.cert}>
      <div className={s.certHead}>certificate of ownership</div>
      <div className={s.certTitle}>
        {shares} shares of {ticker}
      </div>
      <div className={s.certBody}>
        This certifies that <b>{her}</b> is the owner of {shares} shares of {company}, given on our second anniversary.
      </div>
      <div className={s.scratchBox}>
        <div className={s.scratchVal}>
          <b>{fmt(amount)}</b>
          <small>{amount === 1112 ? "one for every 11/12" : "for you"}</small>
        </div>
        <canvas ref={ref} className={s.scratchCanvas} aria-label="scratch to reveal" />
      </div>
      <div className={s.certBody} style={{ opacity: revealed ? 1 : 0.35, transition: "opacity 1s" }}>
        <p style={{ fontStyle: "italic" }}>{why}</p>
        <p>{rule}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} role="img" aria-label="illustrative growth">
          <path d={`${path} L${pts[pts.length - 1][0]},${H - 30} L30,${H - 30} Z`} fill="rgba(110,18,32,0.08)" />
          <path d={path} fill="none" stroke="#6e1220" strokeWidth={2.5} />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p[0]} cy={p[1]} r={4} fill="#6e1220" />
              <text x={p[0]} y={H - 10} textAnchor="middle" fontSize={13} fill="#1f3a2f" fontFamily="VT323, monospace">
                {years[i] === 0 ? "now" : `yr ${years[i] + 2}`}
              </text>
              {i > 1 && (
                <text x={p[0]} y={p[1] - 10} textAnchor="middle" fontSize={13} fill="#1f3a2f" fontFamily="VT323, monospace">
                  {fmt(vals[i])}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div className={s.fine}>
          if we never touch it and it averages {Math.round(rate * 100)}%/yr, by our 52nd anniversary ({startYear + 52}).
          illustration only, not a prediction.
        </div>
      </div>
    </div>
  );
}
