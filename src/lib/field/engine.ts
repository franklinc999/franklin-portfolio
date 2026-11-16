import { FRAG, MAX_RECTS, MAX_TEXTS, MAX_ZONES, THEMES, VERT } from "./shader";
import type { ThemeName } from "./shader";

// One canvas, one loop. Glass elements, zones and headlines register here;
// every frame the engine reads where they are and hands that to the shader.
//
// The canvas is viewport sized but anchored to the document, not fixed. It is
// moved to the current scroll position on each frame, so between frames it
// scrolls with the content and a slab can never trail the text sitting on it.

export type GlassKind = "panel" | "card" | "sheet" | "badge" | "pill" | "drop";

type Params = {
  bezel: number;
  strength: number;
  frost: number;
  tint: number;
  zoom: number;
  rim: number;
  shadow: number;
};

export const PRESETS: Record<GlassKind, Params> = {
  panel: { bezel: 40, strength: 0.56, frost: 3.2, tint: 0.34, zoom: 1.03, rim: 0.85, shadow: 0.55 },
  card: { bezel: 34, strength: 0.58, frost: 3, tint: 0.33, zoom: 1.04, rim: 0.8, shadow: 0.45 },
  // Long-form reading surface: same bezel, frostier middle so marks stay out of the text.
  sheet: { bezel: 40, strength: 0.56, frost: 7.5, tint: 0.42, zoom: 1.02, rim: 0.85, shadow: 0.55 },
  badge: { bezel: 30, strength: 0.72, frost: 2.2, tint: 0.3, zoom: 1.1, rim: 1.05, shadow: 0.8 },
  pill: { bezel: 22, strength: 0.7, frost: 2, tint: 0.26, zoom: 1.06, rim: 0.9, shadow: 0.4 },
  // The loose droplet that trails the cursor: clear, strongly magnifying.
  drop: { bezel: 34, strength: 0.8, frost: 0, tint: 0.03, zoom: 1.24, rim: 0.7, shadow: 0.2 },
};

/** Centre, size and rotation in document css px. */
export type Geometry = { cx: number; cy: number; w: number; h: number; angle: number };

type Entry = {
  el: HTMLElement;
  kind: GlassKind;
  order: number;
  appear: number;
  appearTarget: number;
  delay: number;
  started: boolean;
  hover: number;
  hoverTarget: number;
  inView: boolean;
  radius: number;
  geom: Geometry | null;
  explicit: boolean;
  live: boolean;
  /** null until first seen; true if the slab starts below the fold and should rise in. */
  rise: boolean | null;
};

type Zone = { el: HTMLElement; theme: number };

type TextEntry = {
  el: HTMLElement;
  progress: number;
  started: boolean;
  ok: boolean;
  w: number;
  h: number;
  u0: number;
  v0: number;
  uw: number;
  vh: number;
};

type FrameHook = (dt: number, now: number) => void;

const PIXEL_BUDGET = 3.1e6;
const PARALLAX = 0.2;
const TEXT_PAD = 28;
const DROP_SIZE = 92;

const entries = new Map<HTMLElement, Entry>();
const zones = new Map<HTMLElement, Zone>();
const texts = new Map<HTMLElement, TextEntry>();
const hooks = new Set<FrameHook>();

let canvas: HTMLCanvasElement | null = null;
let gl: WebGL2RenderingContext | null = null;
let program: WebGLProgram | null = null;
let uni: Record<string, WebGLUniformLocation | null> = {};
let textTex: WebGLTexture | null = null;
let probe: HTMLDivElement | null = null;
let io: IntersectionObserver | null = null;
let ro: ResizeObserver | null = null;

let raf = 0;
let last = 0;
let frameNo = 0;
let drawn = 0;
let dirty = true;
let lastScroll = -1;
// Two ways motion gets turned down. `reduced` is the visitor's system
// setting (or ?still): no drift, no parallax, no entrances. `paused` is the
// pause button: ambient motion stops, but anything a scroll or a hand causes
// still happens.
let reduced = false;
let paused = false;
let still = false;
let clock = 0;
const motionSubs = new Set<() => void>();
let quality = 1;
let slowFrames = 0;
let sampled = 0;

let vw = 0;
let vh = 0;
let over = 0;
let cssH = 0;
let px = 1;
let mapScale = 480;

let pointerX = -1e5;
let pointerY = -1e5;
let pointerOn = 0;
let pointerTarget = 0;
let pointerBusy = false; // the pointer is over a slab or a control
const light = { x: -0.55, y: -0.835 };

let textCanvas: HTMLCanvasElement | null = null;
let textScale = 1;
let atlasReady = false;
let rasterTimer = 0;

let dropEntry: Entry | null = null;
const drop = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, placed: false };

const bufA = new Float32Array(MAX_RECTS * 4);
const bufB = new Float32Array(MAX_RECTS * 4);
const bufC = new Float32Array(MAX_RECTS * 4);
const bufD = new Float32Array(MAX_RECTS * 4);
const bufZ = new Float32Array(MAX_ZONES * 2);
const bufTR = new Float32Array(MAX_TEXTS * 4);
const bufTU = new Float32Array(MAX_TEXTS * 4);
const bufTP = new Float32Array(MAX_TEXTS * 4);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function ensureLoop() {
  if (raf || typeof window === "undefined") return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function stopLoopIfIdle() {
  if (raf && !gl && hooks.size === 0) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

function ensureObservers() {
  if (io || typeof window === "undefined") return;
  io = new IntersectionObserver(
    (list) => {
      for (const item of list) {
        const e = entries.get(item.target as HTMLElement);
        if (e) e.inView = item.isIntersecting;
      }
      dirty = true;
    },
    { rootMargin: "240px 0px 240px 0px" },
  );
  ro = new ResizeObserver((list) => {
    for (const item of list) {
      const e = entries.get(item.target as HTMLElement);
      if (e) e.radius = readRadius(e.el);
    }
    dirty = true;
  });
}

function readRadius(el: HTMLElement) {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) ? r : 0;
}

function makeEntry(el: HTMLElement, kind: GlassKind, order: number, explicit: boolean): Entry {
  return {
    el,
    kind,
    order,
    appear: 0,
    appearTarget: 1,
    delay: 0,
    started: false,
    hover: 0,
    hoverTarget: 0,
    inView: false,
    radius: 0,
    geom: null,
    explicit,
    live: false,
    rise: null,
  };
}

function compile(type: number, src: string) {
  const sh = gl!.createShader(type)!;
  gl!.shaderSource(sh, src);
  gl!.compileShader(sh);
  if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
    const log = gl!.getShaderInfoLog(sh);
    gl!.deleteShader(sh);
    throw new Error(`field shader: ${log}`);
  }
  return sh;
}

function setupGL() {
  if (!gl) return;
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`field program: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  uni = {};
  for (const name of [
    "uRes",
    "uPx",
    "uFieldOff",
    "uS",
    "uTime",
    "uLight",
    "uPointer",
    "uN",
    "uA",
    "uB",
    "uC",
    "uD",
    "uZN",
    "uZ",
    "uTN",
    "uText",
    "uTR",
    "uTU",
    "uTP",
    "uTextScale",
  ]) {
    uni[name] = gl.getUniformLocation(program, name);
  }

  textTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(uni.uText, 0);
  atlasReady = false;
}

function measure() {
  if (!canvas || !gl) return;
  vw = document.documentElement.clientWidth;
  vh = probe?.offsetHeight || window.innerHeight;
  over = clamp(Math.round(vh * 0.12), 80, 160);
  cssH = vh + over * 2;
  const maxScale = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.max(0.6, Math.min(maxScale, Math.sqrt(PIXEL_BUDGET / (vw * cssH))) * quality);
  const w = Math.max(1, Math.round(vw * scale));
  const h = Math.max(1, Math.round(cssH * scale));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.height = `${cssH}px`;
  px = vw / w;
  mapScale = clamp(vw * 0.42, 300, 640);
  gl.viewport(0, 0, w, h);
  dirty = true;
}

function stretchKeyword(value: string) {
  const pct = parseFloat(value);
  if (!Number.isFinite(pct)) return "normal";
  if (pct >= 137) return "extra-expanded";
  if (pct >= 118) return "expanded";
  if (pct >= 106) return "semi-expanded";
  if (pct > 94) return "normal";
  if (pct > 81) return "semi-condensed";
  if (pct > 68) return "condensed";
  return "extra-condensed";
}

function scheduleRaster(delay = 60) {
  if (typeof window === "undefined") return;
  window.clearTimeout(rasterTimer);
  rasterTimer = window.setTimeout(rasterTexts, delay);
}

// Draw every registered headline into one texture atlas, so the shader can
// treat the words as part of the ground. That is what lets glass bend them.
// Each [data-field-line] child is drawn where the browser laid it out, which
// means wrapping, tracking and alignment all come from the CSS.
function rasterTexts() {
  if (!gl || !program) return;
  const list: TextEntry[] = [];
  for (const [el, t] of texts) {
    if (!el.isConnected) {
      texts.delete(el);
      continue;
    }
    const r = el.getBoundingClientRect();
    t.ok = r.width >= 2 && r.height >= 2;
    if (!t.ok) {
      delete el.dataset.live;
      continue;
    }
    t.w = Math.ceil(r.width + TEXT_PAD * 2);
    t.h = Math.ceil(r.height + TEXT_PAD * 2);
    list.push(t);
  }
  if (!list.length) {
    atlasReady = false;
    dirty = true;
    return;
  }

  const maxW = Math.max(...list.map((t) => t.w));
  const totalH = list.reduce((sum, t) => sum + t.h, 0);
  const limit = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  const ts = Math.min(clamp(window.devicePixelRatio || 1, 1, 2), limit / maxW, limit / totalH);
  textCanvas ??= document.createElement("canvas");
  textCanvas.width = Math.ceil(maxW * ts);
  textCanvas.height = Math.ceil(totalH * ts);
  const ctx = textCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ts, 0, 0, ts, 0, 0);
  ctx.clearRect(0, 0, maxW, totalH);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";

  let top = 0;
  for (const t of list) {
    const r = t.el.getBoundingClientRect();
    const parts = t.el.querySelectorAll<HTMLElement>("[data-field-line]");
    for (const part of parts) {
      const cs = getComputedStyle(part);
      const lr = part.getBoundingClientRect();
      const size = parseFloat(cs.fontSize);
      const stretch = stretchKeyword(cs.fontStretch);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${stretch} ${size}px ${cs.fontFamily}`;
      const extra = ctx as CanvasRenderingContext2D & { fontStretch?: string; letterSpacing?: string };
      try {
        extra.fontStretch = stretch;
        extra.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      } catch {
        // Older canvases have no stretch or tracking control; the text still draws.
      }
      let text = part.textContent ?? "";
      if (cs.textTransform === "uppercase") text = text.toUpperCase();
      const m = ctx.measureText(text);
      const asc = m.fontBoundingBoxAscent ?? size * 0.8;
      const desc = m.fontBoundingBoxDescent ?? size * 0.2;
      const y = top + lr.top - r.top + TEXT_PAD + (lr.height - (asc + desc)) / 2 + asc;
      ctx.fillText(text, lr.left - r.left + TEXT_PAD, y);
    }
    t.u0 = 0;
    t.v0 = (top * ts) / textCanvas.height;
    t.uw = (t.w * ts) / textCanvas.width;
    t.vh = (t.h * ts) / textCanvas.height;
    t.el.dataset.live = "";
    top += t.h;
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  textScale = ts;
  atlasReady = true;
  dirty = true;
}

function setLive(e: Entry, on: boolean) {
  if (e.live === on) return;
  e.live = on;
  if (on) e.el.dataset.live = "";
  else delete e.el.dataset.live;
}

function collectGlass(top: number, sy: number, dt: number) {
  const picked: { e: Entry; g: Geometry; dist: number }[] = [];
  const mid = sy + vh / 2;

  for (const e of entries.values()) {
    let g: Geometry | null = null;
    if (e.explicit) {
      g = e.geom;
    } else if (e.inView) {
      const r = e.el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        g = { cx: r.left + r.width / 2, cy: r.top + sy + r.height / 2, w: r.width, h: r.height, angle: 0 };
        // Slabs that start below the fold rise into place the first time they
        // are scrolled to. Ones already on screen only gain their optics.
        if (e.rise === null) {
          e.rise = !reduced && r.top > vh * 0.94;
          if (e.rise) {
            e.el.classList.add("rising");
            e.el.style.setProperty("--appear", "0");
          }
        }
        if (e.rise && !e.started && r.top > vh * 0.9) g = null;
      }
    }
    const reach = g ? Math.hypot(g.w, g.h) / 2 + 70 : 0;
    const visible = !!g && g.cy + reach > top && g.cy - reach < top + cssH;
    if (g && visible && (e.appearTarget > 0 || e.appear > 0.004)) {
      picked.push({ e, g, dist: e.explicit ? -1 : Math.abs(g.cy - mid) });
    } else {
      setLive(e, false);
    }
  }

  if (picked.length > MAX_RECTS) {
    picked.sort((a, b) => a.dist - b.dist);
    for (const dropped of picked.splice(MAX_RECTS)) setLive(dropped.e, false);
  }
  picked.sort((a, b) => a.e.order - b.e.order || a.g.cy - b.g.cy || a.g.cx - b.g.cx);

  let fresh = 0;
  let animating = false;
  picked.forEach(({ e, g }, i) => {
    setLive(e, true);
    if (!e.started) {
      e.started = true;
      e.delay = reduced ? 0 : fresh++ * 0.07;
      if (reduced) e.appear = e.appearTarget;
    }
    if (Math.abs(e.appearTarget - e.appear) > 0.002) {
      if (e.delay > 0) e.delay -= dt;
      else e.appear += (e.appearTarget - e.appear) * (1 - Math.exp(-dt * (e.kind === "drop" ? 9 : 6)));
      animating = true;
      if (e.rise) e.el.style.setProperty("--appear", e.appear.toFixed(3));
    } else if (e.appear !== e.appearTarget) {
      e.appear = e.appearTarget;
      if (e.rise) {
        e.el.classList.remove("rising");
        e.el.style.removeProperty("--appear");
        e.rise = false;
      }
      animating = true;
    }
    if (Math.abs(e.hoverTarget - e.hover) > 0.002) {
      e.hover += (e.hoverTarget - e.hover) * (1 - Math.exp(-dt * 11));
      animating = true;
    } else {
      e.hover = e.hoverTarget;
    }

    const p = PRESETS[e.kind];
    const half = Math.min(g.w, g.h) / 2;
    const radius = Math.min(e.radius, half);
    const o = i * 4;
    bufA[o] = g.cx;
    bufA[o + 1] = g.cy - top;
    bufA[o + 2] = g.w / 2;
    bufA[o + 3] = g.h / 2;
    bufB[o] = radius;
    bufB[o + 1] = g.angle;
    bufB[o + 2] = e.appear;
    bufB[o + 3] = e.hover;
    bufC[o] = Math.min(p.bezel, half);
    bufC[o + 1] = p.strength;
    bufC[o + 2] = p.frost;
    bufC[o + 3] = p.tint;
    bufD[o] = p.zoom;
    bufD[o + 1] = p.rim;
    bufD[o + 2] = p.shadow;
    bufD[o + 3] = 0;
  });

  return { count: picked.length, animating };
}

function collectZones(top: number, sy: number) {
  const list: { y: number; theme: number }[] = [];
  for (const [el, z] of zones) {
    if (!el.isConnected) continue;
    list.push({ y: el.getBoundingClientRect().top + sy, theme: z.theme });
  }
  list.sort((a, b) => a.y - b.y);
  if (!list.length) list.push({ y: 0, theme: 0 });
  // Whatever sits first owns everything above it too.
  list[0].y = -1e6;
  const n = Math.min(list.length, MAX_ZONES);
  for (let i = 0; i < n; i++) {
    bufZ[i * 2] = list[i].y - top;
    bufZ[i * 2 + 1] = list[i].theme;
  }
  return n;
}

function collectTexts(top: number, sy: number, dt: number) {
  if (!atlasReady) return { count: 0, animating: false };
  let count = 0;
  let animating = false;
  for (const [el, t] of texts) {
    if (!t.ok || count >= MAX_TEXTS) continue;
    if (!el.isConnected) {
      texts.delete(el);
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.bottom < -over - 60 || r.top > vh + over + 60) continue;
    if (!t.started && r.top < vh * 0.9 && r.bottom > 0) {
      t.started = true;
      if (reduced) t.progress = 1;
    }
    if (t.started && t.progress < 1) {
      t.progress = Math.min(1, t.progress + dt / 1.15);
      animating = true;
    }
    const eased = 1 - Math.pow(1 - t.progress, 3);
    const o = count * 4;
    bufTR[o] = r.left - TEXT_PAD;
    bufTR[o + 1] = r.top + sy - top - TEXT_PAD;
    bufTR[o + 2] = t.w;
    bufTR[o + 3] = t.h;
    bufTU[o] = t.u0;
    bufTU[o + 1] = t.v0;
    bufTU[o + 2] = t.uw;
    bufTU[o + 3] = t.vh;
    bufTP[o] = eased;
    count++;
  }
  return { count, animating };
}

// The droplet: a loose bead of glass that chases the cursor on a spring and
// stretches in the direction it is moving.
function updateDrop(dt: number, sy: number) {
  if (!dropEntry) return;
  // The droplet lives on open ground. Over a slab or a control it gets out of the way.
  const want = pointerTarget > 0 && !reduced && !pointerBusy ? 1 : 0;
  if (!want && !drop.placed) return;
  dropEntry.appearTarget = want;
  if (!want && dropEntry.appear < 0.004) {
    drop.placed = false;
    return;
  }
  if (!drop.placed) {
    drop.x = pointerX;
    drop.y = pointerY;
    drop.vx = 0;
    drop.vy = 0;
    drop.placed = true;
  }
  const ax = (pointerX - drop.x) * 170 - drop.vx * 19;
  const ay = (pointerY - drop.y) * 170 - drop.vy * 19;
  drop.vx += ax * dt;
  drop.vy += ay * dt;
  drop.x += drop.vx * dt;
  drop.y += drop.vy * dt;
  const speed = Math.hypot(drop.vx, drop.vy);
  if (speed > 24) drop.angle = Math.atan2(drop.vy, drop.vx);
  const s = Math.min(0.42, speed / 2400);
  const w = DROP_SIZE * (1 + s);
  const h = DROP_SIZE * (1 - s * 0.5);
  dropEntry.radius = Math.min(w, h) / 2;
  dropEntry.geom = { cx: drop.x, cy: drop.y + sy, w, h, angle: drop.angle };
  if (speed > 2 || Math.abs(pointerX - drop.x) + Math.abs(pointerY - drop.y) > 0.5) dirty = true;
}

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  const rawDt = now - last;
  const dt = Math.min(0.05, Math.max(0.001, rawDt / 1000));
  last = now;
  if (document.hidden) return;

  for (const hook of hooks) hook(dt, now);

  if (!gl || !canvas || !program) return;
  frameNo++;

  const sy = Math.max(0, window.scrollY);
  if (sy !== lastScroll) {
    lastScroll = sy;
    dirty = true;
  }

  // Light leans toward the cursor and swings a little as the page scrolls.
  const swing = reduced ? 0 : Math.sin(sy * 0.0016) * 0.38;
  let lx = -0.55 * Math.cos(swing) + 0.835 * Math.sin(swing);
  let ly = -0.55 * Math.sin(swing) - 0.835 * Math.cos(swing);
  if (pointerTarget > 0) {
    lx += (pointerX / vw - 0.5) * 0.9;
    ly += (pointerY / vh - 0.5) * 0.9;
  }
  const ll = Math.hypot(lx, ly) || 1;
  lx /= ll;
  ly /= ll;
  const ease = 1 - Math.exp(-dt * 5);
  if (Math.abs(lx - light.x) + Math.abs(ly - light.y) > 0.0015) {
    light.x += (lx - light.x) * ease;
    light.y += (ly - light.y) * ease;
    dirty = true;
  }
  if (Math.abs(pointerTarget - pointerOn) > 0.004) {
    pointerOn += (pointerTarget - pointerOn) * ease;
    dirty = true;
  }

  updateDrop(dt, sy);

  // The ground drifts on its own clock, which stops when motion is paused.
  const drifting = !reduced && !paused;
  if (drifting) {
    clock += dt;
    if (frameNo % 2 === 0) dirty = true;
  }
  if (!dirty) return;

  const docH = canvas.parentElement?.offsetHeight ?? cssH;
  const top = clamp(sy - over, 0, Math.max(0, docH - cssH));
  const glass = collectGlass(top, sy, dt);
  const zoneCount = collectZones(top, sy);
  const text = collectTexts(top, sy, dt);

  canvas.style.transform = `translate3d(0,${top}px,0)`;
  const time = clock;

  gl.uniform2f(uni.uRes, canvas.width, canvas.height);
  gl.uniform1f(uni.uPx, px);
  gl.uniform2f(uni.uFieldOff, 0, top - (reduced ? 0 : PARALLAX * sy));
  gl.uniform1f(uni.uS, mapScale);
  gl.uniform1f(uni.uTime, time);
  gl.uniform2f(uni.uLight, light.x, light.y);
  gl.uniform3f(uni.uPointer, pointerX, pointerY + sy - top, pointerOn);
  gl.uniform1i(uni.uN, glass.count);
  gl.uniform4fv(uni.uA, bufA);
  gl.uniform4fv(uni.uB, bufB);
  gl.uniform4fv(uni.uC, bufC);
  gl.uniform4fv(uni.uD, bufD);
  gl.uniform1i(uni.uZN, zoneCount);
  gl.uniform2fv(uni.uZ, bufZ);
  gl.uniform1i(uni.uTN, text.count);
  gl.uniform4fv(uni.uTR, bufTR);
  gl.uniform4fv(uni.uTU, bufTU);
  gl.uniform4fv(uni.uTP, bufTP);
  gl.uniform1f(uni.uTextScale, textScale);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // The canvas is revealed on its second drawn frame, so that has to happen
  // even on a page where nothing is moving.
  drawn++;
  dirty = glass.animating || text.animating || drawn < 2;

  if (drawn === 2) document.documentElement.classList.add("field-on");

  // If the device cannot hold the frame rate, draw fewer pixels.
  if (!still && frameNo > 20 && quality > 0.5) {
    sampled++;
    if (rawDt > 30) slowFrames++;
    if (sampled >= 90) {
      if (slowFrames > 36) {
        quality *= 0.8;
        measure();
      }
      sampled = 0;
      slowFrames = 0;
    }
  }
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType !== "mouse") return;
  pointerX = e.clientX;
  pointerY = e.clientY;
  pointerTarget = 1;
  const over = e.target instanceof Element ? e.target : null;
  pointerBusy = !!over?.closest(".glass, .sticker, .postcard, .nav, .motion-toggle, a, button, input, label");
  dirty = true;
}

function onPointerGone() {
  pointerTarget = 0;
  dirty = true;
}

function onResize() {
  measure();
  scheduleRaster(120);
}

export const field = {
  mount(el: HTMLCanvasElement) {
    canvas = el;
    still = new URLSearchParams(window.location.search).has("still");
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = still || mq.matches;
    const onMq = () => {
      reduced = still || mq.matches;
      dirty = true;
      for (const cb of motionSubs) cb();
    };
    mq.addEventListener("change", onMq);

    try {
      gl = el.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
      if (!gl) throw new Error("webgl2 unavailable");
      setupGL();
    } catch (err) {
      console.warn("Field disabled, using the plain glass fallback.", err);
      gl = null;
      program = null;
    }

    // If the GPU drops the context, hand every surface back to its CSS
    // stand-in (and the headlines back to the DOM) until it returns.
    const onLost = (e: Event) => {
      e.preventDefault();
      program = null;
      atlasReady = false;
      for (const t of texts.keys()) delete t.dataset.live;
      for (const entry of entries.values()) {
        setLive(entry, false);
        entry.el.classList.remove("rising");
        entry.el.style.removeProperty("--appear");
        entry.rise = false;
      }
      document.documentElement.classList.remove("field-on");
    };
    const onRestored = () => {
      try {
        setupGL();
        frameNo = 0;
        drawn = 0;
        measure();
        rasterTexts();
      } catch {
        gl = null;
      }
    };
    const onFonts = () => scheduleRaster(40);

    if (gl) {
      probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      measure();

      if (!still && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        dropEntry = makeEntry(document.createElement("div"), "drop", -5, true);
        dropEntry.radius = DROP_SIZE / 2;
        entries.set(dropEntry.el, dropEntry);
      }

      el.addEventListener("webglcontextlost", onLost);
      el.addEventListener("webglcontextrestored", onRestored);
      window.addEventListener("resize", onResize);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerGone);
      window.addEventListener("blur", onPointerGone);
      document.fonts?.addEventListener("loadingdone", onFonts);
      document.fonts?.ready.then(() => scheduleRaster(0)).catch(() => {});
      ensureLoop();
    }

    return () => {
      mq.removeEventListener("change", onMq);
      el.removeEventListener("webglcontextlost", onLost);
      el.removeEventListener("webglcontextrestored", onRestored);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerGone);
      window.removeEventListener("blur", onPointerGone);
      document.fonts?.removeEventListener("loadingdone", onFonts);
      if (dropEntry) entries.delete(dropEntry.el);
      dropEntry = null;
      probe?.remove();
      probe = null;
      document.documentElement.classList.remove("field-on");
      gl = null;
      program = null;
      canvas = null;
      frameNo = 0;
      drawn = 0;
      stopLoopIfIdle();
    };
  },

  register(el: HTMLElement, kind: GlassKind, opts: { explicit?: boolean; order?: number; hover?: boolean } = {}) {
    ensureObservers();
    const entry = makeEntry(el, kind, opts.order ?? 0, !!opts.explicit);
    entry.radius = readRadius(el);
    entries.set(el, entry);
    io?.observe(el);
    ro?.observe(el);

    const enter = () => {
      entry.hoverTarget = 1;
      dirty = true;
    };
    const leave = () => {
      entry.hoverTarget = 0;
      dirty = true;
    };
    if (opts.hover) {
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      el.addEventListener("focusin", enter);
      el.addEventListener("focusout", leave);
    }
    dirty = true;

    return () => {
      io?.unobserve(el);
      ro?.unobserve(el);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("focusin", enter);
      el.removeEventListener("focusout", leave);
      entries.delete(el);
      delete el.dataset.live;
      el.classList.remove("rising");
      el.style.removeProperty("--appear");
      dirty = true;
    };
  },

  setGeometry(el: HTMLElement, geom: Geometry) {
    const e = entries.get(el);
    if (!e) return;
    e.geom = geom;
    dirty = true;
  },

  setHover(el: HTMLElement, on: boolean) {
    const e = entries.get(el);
    if (!e) return;
    e.hoverTarget = on ? 1 : 0;
    dirty = true;
  },

  /** Paint a theme from the top of this element down to the next zone. */
  registerZone(el: HTMLElement, theme: ThemeName) {
    zones.set(el, { el, theme: Math.max(0, THEMES.indexOf(theme)) });
    dirty = true;
    return () => {
      zones.delete(el);
      dirty = true;
    };
  },

  /** Draw this headline's [data-field-line] children into the ground. */
  addText(el: HTMLElement) {
    texts.set(el, { el, progress: 0, started: false, ok: false, w: 0, h: 0, u0: 0, v0: 0, uw: 0, vh: 0 });
    scheduleRaster();
    return () => {
      texts.delete(el);
      delete el.dataset.live;
      scheduleRaster();
    };
  },

  /** Call when a headline's layout may have changed. */
  refreshText() {
    scheduleRaster();
  },

  onFrame(hook: FrameHook) {
    hooks.add(hook);
    ensureLoop();
    return () => {
      hooks.delete(hook);
      stopLoopIfIdle();
    };
  },

  invalidate() {
    dirty = true;
  },

  /** The visitor's system asks for less motion (or the page was opened with ?still). */
  get reducedMotion() {
    if (typeof window === "undefined") return false;
    return (
      new URLSearchParams(window.location.search).has("still") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  },

  /** Ambient motion should not run: either the system setting or the pause button. */
  get motionOff() {
    return paused || this.reducedMotion;
  },

  get paused() {
    return paused;
  },

  /** The pause button. Stops everything that moves on its own. */
  setPaused(value: boolean) {
    if (paused === value) return;
    paused = value;
    dirty = true;
    for (const cb of motionSubs) cb();
  },

  onMotionChange(cb: () => void) {
    motionSubs.add(cb);
    return () => {
      motionSubs.delete(cb);
    };
  },
};
