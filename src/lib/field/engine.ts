import { FRAG, MAX_RECTS, VERT } from "./shader";

// One canvas, one loop. Glass elements register themselves here; every frame
// the engine reads where they are and hands their rectangles to the shader.
//
// The canvas is viewport sized but anchored to the document, not fixed. It is
// moved to the current scroll position on each frame, so between frames it
// scrolls with the content and a slab can never trail the text sitting on it.

export type GlassKind = "panel" | "card" | "sheet" | "badge" | "pill";

type Params = {
  bezel: number;
  strength: number;
  frost: number;
  tint: number;
  zoom: number;
  rim: number;
  shadow: number;
};

const PRESETS: Record<GlassKind, Params> = {
  panel: { bezel: 40, strength: 0.56, frost: 3.2, tint: 0.34, zoom: 1.03, rim: 0.85, shadow: 0.55 },
  card: { bezel: 34, strength: 0.58, frost: 3, tint: 0.33, zoom: 1.04, rim: 0.8, shadow: 0.45 },
  // Long-form reading surface: same bezel, frostier middle so lines stay out of the text.
  sheet: { bezel: 40, strength: 0.56, frost: 7.5, tint: 0.42, zoom: 1.02, rim: 0.85, shadow: 0.55 },
  badge: { bezel: 30, strength: 0.72, frost: 2.2, tint: 0.3, zoom: 1.1, rim: 1.05, shadow: 0.8 },
  pill: { bezel: 22, strength: 0.7, frost: 2, tint: 0.26, zoom: 1.06, rim: 0.9, shadow: 0.4 },
};

/** Centre, size and rotation in document css px. */
export type Geometry = { cx: number; cy: number; w: number; h: number; angle: number };

type Entry = {
  el: HTMLElement;
  kind: GlassKind;
  order: number;
  appear: number;
  delay: number;
  started: boolean;
  hover: number;
  hoverTarget: number;
  inView: boolean;
  radius: number;
  geom: Geometry | null;
  explicit: boolean;
  live: boolean;
};

type FrameHook = (dt: number, now: number) => void;

const PIXEL_BUDGET = 3.1e6;
const PARALLAX = 0.2;

const entries = new Map<HTMLElement, Entry>();
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
let dirty = true;
let lastScroll = -1;
let reduced = false;
let quality = 1;
let still = false;
let slowFrames = 0;
let sampled = 0;

let vw = 0;
let vh = 0;
let over = 0;
let cssH = 0;
let px = 1;
let mapScale = 480;
let startTime = 0;

let pointerX = -1e5;
let pointerY = -1e5;
let pointerOn = 0;
let pointerTarget = 0;
const light = { x: -0.55, y: -0.835 };

let textEl: HTMLElement | null = null;
let textCanvas: HTMLCanvasElement | null = null;
let textOn = false;
let textScale = 1;
let textW = 0;
let textH = 0;
const TEXT_PAD = 28;

const bufA = new Float32Array(MAX_RECTS * 4);
const bufB = new Float32Array(MAX_RECTS * 4);
const bufC = new Float32Array(MAX_RECTS * 4);
const bufD = new Float32Array(MAX_RECTS * 4);

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
    "uText",
    "uTextRect",
    "uTextScale",
    "uTextOn",
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

// Draw the registered headline into a texture so the shader can treat it as
// part of the map. That is what lets a slab of glass bend the letters.
function rasterText() {
  if (!gl || !textEl || !textEl.isConnected) {
    if (textEl && !textEl.isConnected) textEl = null;
    textOn = false;
    dirty = true;
    return;
  }
  const r = textEl.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) {
    textOn = false;
    return;
  }
  textCanvas ??= document.createElement("canvas");
  const ts = clamp(window.devicePixelRatio || 1, 1, 2);
  const w = Math.ceil(r.width + TEXT_PAD * 2);
  const h = Math.ceil(r.height + TEXT_PAD * 2);
  textCanvas.width = Math.ceil(w * ts);
  textCanvas.height = Math.ceil(h * ts);
  const ctx = textCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(ts, 0, 0, ts, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";

  const lines = textEl.querySelectorAll<HTMLElement>("[data-field-line]");
  for (const line of lines) {
    const cs = getComputedStyle(line);
    const lr = line.getBoundingClientRect();
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
    let text = line.textContent ?? "";
    if (cs.textTransform === "uppercase") text = text.toUpperCase();
    const m = ctx.measureText(text);
    const asc = m.fontBoundingBoxAscent ?? size * 0.8;
    const desc = m.fontBoundingBoxDescent ?? size * 0.2;
    const y = lr.top - r.top + TEXT_PAD + (lr.height - (asc + desc)) / 2 + asc;
    ctx.fillText(text, lr.left - r.left + TEXT_PAD, y);
  }

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  textScale = ts;
  textW = w;
  textH = h;
  textOn = true;
  textEl.dataset.live = "";
  dirty = true;
}

function collect(top: number, sy: number, dt: number) {
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
      }
    }
    const reach = g ? Math.hypot(g.w, g.h) / 2 + 70 : 0;
    const visible = !!g && g.cy + reach > top && g.cy - reach < top + cssH;
    if (g && visible) {
      picked.push({ e, g, dist: e.explicit ? -1 : Math.abs(g.cy - mid) });
    } else if (e.live) {
      e.live = false;
      delete e.el.dataset.live;
    }
  }

  if (picked.length > MAX_RECTS) {
    picked.sort((a, b) => a.dist - b.dist);
    for (const drop of picked.splice(MAX_RECTS)) {
      if (drop.e.live) {
        drop.e.live = false;
        delete drop.e.el.dataset.live;
      }
    }
  }
  picked.sort((a, b) => a.e.order - b.e.order || a.g.cy - b.g.cy || a.g.cx - b.g.cx);

  let fresh = 0;
  let animating = false;
  picked.forEach(({ e, g }, i) => {
    if (!e.live) {
      e.live = true;
      e.el.dataset.live = "";
    }
    if (!e.started) {
      e.started = true;
      e.delay = reduced ? 0 : fresh++ * 0.07;
      if (reduced) e.appear = 1;
    }
    if (e.appear < 1) {
      if (e.delay > 0) e.delay -= dt;
      else e.appear += (1 - e.appear) * (1 - Math.exp(-dt * 6.5));
      if (e.appear > 0.998) e.appear = 1;
      animating = true;
    }
    if (Math.abs(e.hoverTarget - e.hover) > 0.002) {
      e.hover += (e.hoverTarget - e.hover) * (1 - Math.exp(-dt * 12));
      animating = true;
    } else {
      e.hover = e.hoverTarget;
    }

    const p = PRESETS[e.kind];
    const half = Math.min(g.w, g.h) / 2;
    const radius = Math.min(e.radius, half);
    const bezel = Math.min(p.bezel, half);
    const o = i * 4;
    bufA[o] = g.cx;
    bufA[o + 1] = g.cy - top;
    bufA[o + 2] = g.w / 2;
    bufA[o + 3] = g.h / 2;
    bufB[o] = radius;
    bufB[o + 1] = g.angle;
    bufB[o + 2] = e.appear;
    bufB[o + 3] = e.hover;
    bufC[o] = bezel;
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

function frame(now: number) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  const rawDt = now - last;
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
  let lx = -0.55 * Math.cos(swing) - -0.835 * Math.sin(swing);
  let ly = -0.55 * Math.sin(swing) + -0.835 * Math.cos(swing);
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

  if (!reduced && frameNo % 2 === 0) dirty = true;
  if (!dirty) return;

  const docH = canvas.parentElement?.offsetHeight ?? cssH;
  const top = clamp(sy - over, 0, Math.max(0, docH - cssH));
  const { count, animating } = collect(top, sy, dt);

  canvas.style.transform = `translate3d(0,${top}px,0)`;
  const time = reduced ? 0 : (now - startTime) / 1000;

  gl.uniform2f(uni.uRes, canvas.width, canvas.height);
  gl.uniform1f(uni.uPx, px);
  gl.uniform2f(uni.uFieldOff, 0, top - (reduced ? 0 : PARALLAX * sy));
  gl.uniform1f(uni.uS, mapScale);
  gl.uniform1f(uni.uTime, time);
  gl.uniform2f(uni.uLight, light.x, light.y);
  gl.uniform3f(uni.uPointer, pointerX, pointerY + sy - top, pointerOn);
  gl.uniform1i(uni.uN, count);
  gl.uniform4fv(uni.uA, bufA);
  gl.uniform4fv(uni.uB, bufB);
  gl.uniform4fv(uni.uC, bufC);
  gl.uniform4fv(uni.uD, bufD);

  let showText = false;
  if (textOn && textEl) {
    if (textEl.isConnected) {
      const r = textEl.getBoundingClientRect();
      gl.uniform4f(uni.uTextRect, r.left - TEXT_PAD, r.top + sy - top - TEXT_PAD, textW, textH);
      gl.uniform1f(uni.uTextScale, textScale);
      showText = true;
    } else {
      textEl = null;
      textOn = false;
    }
  }
  gl.uniform1f(uni.uTextOn, showText ? 1 : 0);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  dirty = animating;

  if (frameNo === 2) document.documentElement.classList.add("field-on");

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
  dirty = true;
}

function onPointerGone() {
  pointerTarget = 0;
  dirty = true;
}

let resizeTimer = 0;
function onResize() {
  measure();
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(rasterText, 120);
}

export const field = {
  mount(el: HTMLCanvasElement) {
    canvas = el;
    still = new URLSearchParams(window.location.search).has("still");
    reduced = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reduced = still || mq.matches;
      dirty = true;
    };
    mq.addEventListener("change", onMq);

    try {
      gl = el.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
      });
      if (!gl) throw new Error("webgl2 unavailable");
      setupGL();
    } catch (err) {
      console.warn("Field disabled, using the plain glass fallback.", err);
      gl = null;
      program = null;
    }

    // If the GPU drops the context, hand every surface back to its CSS
    // stand-in (and the headline back to the DOM) until it returns.
    const onLost = (e: Event) => {
      e.preventDefault();
      program = null;
      textOn = false;
      if (textEl) delete textEl.dataset.live;
      for (const entry of entries.values()) {
        entry.live = false;
        delete entry.el.dataset.live;
      }
      document.documentElement.classList.remove("field-on");
    };
    const onRestored = () => {
      try {
        setupGL();
        frameNo = 0;
        measure();
        rasterText();
      } catch {
        gl = null;
      }
    };

    if (gl) {
      probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      startTime = performance.now();
      measure();
      el.addEventListener("webglcontextlost", onLost);
      el.addEventListener("webglcontextrestored", onRestored);
      window.addEventListener("resize", onResize);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerGone);
      window.addEventListener("blur", onPointerGone);
      document.fonts?.ready.then(rasterText).catch(() => {});
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
      probe?.remove();
      probe = null;
      document.documentElement.classList.remove("field-on");
      gl = null;
      program = null;
      canvas = null;
      frameNo = 0;
      stopLoopIfIdle();
    };
  },

  register(el: HTMLElement, kind: GlassKind, opts: { explicit?: boolean; order?: number; hover?: boolean } = {}) {
    ensureObservers();
    const entry: Entry = {
      el,
      kind,
      order: opts.order ?? 0,
      appear: 0,
      delay: 0,
      started: false,
      hover: 0,
      hoverTarget: 0,
      inView: false,
      radius: readRadius(el),
      geom: null,
      explicit: !!opts.explicit,
      live: false,
    };
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

  /** Hand the engine a headline whose [data-field-line] children it should draw into the map. */
  setText(el: HTMLElement | null) {
    if (textEl && textEl !== el) delete textEl.dataset.live;
    textEl = el;
    if (!el) {
      textOn = false;
      dirty = true;
      return;
    }
    if (document.fonts?.status === "loaded") rasterText();
    else document.fonts?.ready.then(rasterText).catch(() => {});
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

  get reducedMotion() {
    if (typeof window === "undefined") return false;
    return (
      new URLSearchParams(window.location.search).has("still") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  },
};
