
import { useCallback, useEffect, useRef, useState } from "react";
import s from "../gift.module.css";
import { useAssetExists } from "./film";

type Props = {
  image: string;
  fogMessage: string;
  underText: string;
  onDone: () => void;
};

type Drip = { x: number; y: number; vy: number; left: number; w: number };

/**
 * A steamed-up bathroom mirror.
 * 1. Fog rolls in.  2. An invisible finger writes a message in it.
 * 3. She wipes the fog with her finger / mouse to reveal the photo underneath.
 * Fog slowly creeps back. She can "breathe" on it (mic) to fog it up again and write her own note.
 */
export function FogMirror({ image, fogMessage, underText, onDone }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasImage = useAssetExists(image);
  const [phase, setPhase] = useState<"fogging" | "writing" | "wipe">("fogging");
  const [cleared, setCleared] = useState(0);
  const [breathing, setBreathing] = useState(false);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  const breathRef = useRef(0); // 0..1 breath intensity this frame
  const holdBreath = useRef(false);

  // all mutable drawing state lives here so the RAF loop never re-subscribes
  const st = useRef({
    ctx: null as CanvasRenderingContext2D | null,
    fog: null as HTMLCanvasElement | null,
    breath: null as HTMLCanvasElement | null,
    W: 0,
    H: 0,
    drips: [] as Drip[],
    last: null as null | { x: number; y: number },
    wiped: false,
  });

  const buildFogTexture = (W: number, H: number) => {
    const f = document.createElement("canvas");
    f.width = W;
    f.height = H;
    const g = f.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(222,226,228,0.96)");
    grad.addColorStop(1, "rgba(200,206,210,0.98)");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // cloudy unevenness
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = (0.08 + Math.random() * 0.25) * W;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      const light = Math.random() > 0.5;
      rg.addColorStop(0, light ? "rgba(255,255,255,0.18)" : "rgba(150,160,165,0.12)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    // micro droplets
    const n = Math.floor((W * H) / 900);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const r = Math.random() * 1.6 + 0.3;
      g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.4})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return f;
  };

  // setup + main loop
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const S = st.current;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = c.getBoundingClientRect();
      S.W = c.width = Math.round(r.width * dpr);
      S.H = c.height = Math.round(r.height * dpr);
      S.ctx = c.getContext("2d");
      S.fog = buildFogTexture(S.W, S.H);
      // breath = fog texture faded out radially from the lower middle, where a mouth would be
      const b = document.createElement("canvas");
      b.width = S.W;
      b.height = S.H;
      const bg = b.getContext("2d")!;
      bg.drawImage(S.fog, 0, 0);
      bg.globalCompositeOperation = "destination-in";
      const rg = bg.createRadialGradient(S.W / 2, S.H * 0.7, 0, S.W / 2, S.H * 0.7, S.W * 0.85);
      rg.addColorStop(0, "rgba(0,0,0,1)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      bg.fillStyle = rg;
      bg.fillRect(0, 0, S.W, S.H);
      S.breath = b;
    };
    resize();
    const ctx = S.ctx!;

    let raf = 0;
    let t0 = performance.now();
    let fogLevel = 0;
    let writeStart = 0;
    let textCanvas: HTMLCanvasElement | null = null;
    let fontPending = false;

    const makeText = () => {
      const tc = document.createElement("canvas");
      tc.width = S.W;
      tc.height = S.H;
      const g = tc.getContext("2d")!;
      const words = fogMessage.includes("\n") ? fogMessage.split("\n") : splitBalanced(fogMessage);
      const size = S.W * (words.length > 1 ? 0.13 : 0.15);
      g.font = `${size}px "Homemade Apple", "Caveat", cursive`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = g.lineCap = "round";
      g.lineWidth = S.W * 0.014;
      g.strokeStyle = "#000";
      g.fillStyle = "#000";
      words.forEach((w, i) => {
        const y = S.H * 0.36 + (i - (words.length - 1) / 2) * size * 1.25;
        g.strokeText(w, S.W / 2, y);
        g.fillText(w, S.W / 2, y);
      });
      return tc;
    };

    const erase = (x: number, y: number, r: number) => {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.6, "rgba(0,0,0,0.9)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(50, now - t0);
      t0 = now;
      const ph = phaseRef.current;

      if (ph === "fogging") {
        fogLevel += dt / 2600;
        ctx.globalAlpha = 0.06;
        ctx.drawImage(S.fog!, 0, 0);
        ctx.globalAlpha = 1;
        if (fogLevel >= 1 && !fontPending) {
          fontPending = true;
          ctx.clearRect(0, 0, S.W, S.H);
          ctx.drawImage(S.fog!, 0, 0);
          // wait for the handwriting font, otherwise the canvas silently falls back to a serif
          const go = () => {
            textCanvas = makeText();
            writeStart = performance.now();
            setPhase("writing");
          };
          Promise.race([
            document.fonts.load(`40px "Homemade Apple"`),
            new Promise((r) => setTimeout(r, 2500)),
          ]).then(go, go);
        }
      } else if (ph === "writing" && textCanvas) {
        const p = Math.min(1, (now - writeStart) / 3200);
        // reveal the message left to right, like a finger tracing it
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, S.W * (0.08 + p * 0.86), S.H);
        ctx.clip();
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(textCanvas, 0, 0);
        ctx.restore();
        if (p >= 1) {
          // a few drips fall from the bottom of the letters
          for (let i = 0; i < 6; i++) {
            S.drips.push({
              x: S.W * (0.2 + Math.random() * 0.6),
              y: S.H * (0.4 + Math.random() * 0.08),
              vy: 0.02 + Math.random() * 0.03,
              left: S.H * (0.05 + Math.random() * 0.15),
              w: S.W * 0.006,
            });
          }
          setPhase("wipe");
        }
      } else if (ph === "wipe") {
        // fog slowly creeps back
        const regrow = S.wiped ? 0.0006 : 0;
        const breath = Math.max(breathRef.current, holdBreath.current ? 0.8 : 0);
        if (regrow > 0) {
          ctx.globalAlpha = regrow * (dt / 16);
          ctx.drawImage(S.fog!, 0, 0);
        }
        if (breath > 0.05 && S.breath) {
          ctx.globalAlpha = 0.1 * breath * (dt / 16);
          ctx.drawImage(S.breath, 0, 0);
        }
        ctx.globalAlpha = 1;
      }

      // drips (any phase after writing)
      if (S.drips.length) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.lineCap = "round";
        S.drips = S.drips.filter((d) => {
          const step = d.vy * dt * (S.H / 900);
          ctx.lineWidth = d.w;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          d.y += step;
          d.x += (Math.random() - 0.5) * 0.6;
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
          d.left -= step;
          d.w *= 0.9995;
          return d.left > 0;
        });
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(loop);

    // measure how much is wiped
    const probe = document.createElement("canvas");
    probe.width = 48;
    probe.height = 64;
    const pg = probe.getContext("2d", { willReadFrequently: true })!;
    const iv = setInterval(() => {
      if (phaseRef.current !== "wipe") return;
      pg.clearRect(0, 0, 48, 64);
      pg.drawImage(c, 0, 0, 48, 64);
      const d = pg.getImageData(0, 0, 48, 64).data;
      let clear = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 90) clear++;
      setCleared(clear / (48 * 64));
    }, 400);

    // pointer wiping
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * S.W, y: ((e.clientY - r.top) / r.height) * S.H };
    };
    let down = false;
    const onDown = (e: PointerEvent) => {
      down = true;
      c.setPointerCapture(e.pointerId);
      S.last = pos(e);
    };
    const onMove = (e: PointerEvent) => {
      if (phaseRef.current !== "wipe") return;
      // on desktop, wiping works on hover too, so it feels like a hand passing over glass
      if (!down && e.pointerType !== "mouse") return;
      const p = pos(e);
      const r = S.W * (e.pointerType === "touch" ? 0.07 : 0.06);
      const l = S.last ?? p;
      const dist = Math.hypot(p.x - l.x, p.y - l.y);
      const steps = Math.max(1, Math.ceil(dist / (r * 0.3)));
      for (let i = 0; i <= steps; i++) {
        erase(l.x + ((p.x - l.x) * i) / steps, l.y + ((p.y - l.y) * i) / steps, r);
      }
      if (Math.random() < 0.06 && S.drips.length < 40) {
        S.drips.push({ x: p.x + (Math.random() - 0.5) * r, y: p.y + r * 0.8, vy: 0.03 + Math.random() * 0.04, left: S.H * (0.05 + Math.random() * 0.25), w: S.W * (0.004 + Math.random() * 0.004) });
      }
      S.last = p;
      S.wiped = true;
    };
    const onUp = () => {
      down = false;
      S.last = null;
    };
    const onLeave = () => (S.last = null);
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
      c.removeEventListener("pointerleave", onLeave);
    };
  }, [fogMessage]);

  // mic "breath": low-frequency loud noise = someone breathing / blowing on the screen
  const startBreath = useCallback(async () => {
    if (breathing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      setBreathing(true);
      const read = () => {
        an.getByteFrequencyData(buf);
        let low = 0;
        for (let i = 1; i < 24; i++) low += buf[i];
        low /= 23 * 255;
        breathRef.current = Math.max(0, Math.min(1, (low - 0.25) * 2.5));
        requestAnimationFrame(read);
      };
      read();
    } catch {
      setBreathing(false);
    }
  }, [breathing]);

  const done = cleared > 0.5;

  return (
    <div className={s.mirrorWrap}>
      <div className={s.mirrorTools}>
        <button
          className={s.chip}
          onClick={startBreath}
          onPointerDown={() => (holdBreath.current = true)}
          onPointerUp={() => (holdBreath.current = false)}
          onPointerLeave={() => (holdBreath.current = false)}
        >
          {breathing ? "breathe on the screen" : "hold to breathe"}
        </button>
      </div>
      <div ref={wrapRef} className={s.mirror}>
        {hasImage ? (
          <div className={s.mirrorImg} style={{ backgroundImage: `url(${image})` }} />
        ) : (
          <div className={s.mirrorFallback} />
        )}
        <div className={s.mirrorUnder}>{underText}</div>
        <div className={s.mirrorGlare} />
        <canvas ref={canvasRef} className={s.fogCanvas} />
      </div>
      <div className={s.mirrorHint} style={{ opacity: phase === "wipe" ? 1 : 0 }}>
        {done ? (
          <button className={s.btn} onClick={onDone}>
            come in
          </button>
        ) : cleared > 0.08 ? (
          "keep going"
        ) : (
          "wipe the mirror"
        )}
      </div>
    </div>
  );
}

function splitBalanced(text: string) {
  const w = text.trim().split(/\s+/);
  if (w.length < 3) return [text];
  const mid = Math.ceil(w.length / 2);
  return [w.slice(0, mid).join(" "), w.slice(mid).join(" ")];
}
