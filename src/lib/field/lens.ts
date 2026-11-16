// Displacement map for an SVG lens filter. Chromium can run an SVG filter as a
// backdrop-filter, which lets a DOM element bend whatever scrolls beneath it,
// page text included. Other browsers keep the frosted fallback from the CSS.

export type LensMap = { url: string; scale: number; width: number; height: number };

export function supportsBackdropLens() {
  if (typeof navigator === "undefined") return false;
  return /\bChrome\/\d+/.test(navigator.userAgent);
}

export function buildLensMap(width: number, height: number, radius: number, bezel: number, strength: number): LensMap | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 4 || h < 4) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const r = Math.min(radius, w / 2, h / 2);
  const b = Math.min(bezel, Math.max(4, r));
  const max = b * strength;
  const img = ctx.createImageData(w, h);
  const hx = w / 2;
  const hy = h / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lx = x + 0.5 - hx;
      const ly = y + 0.5 - hy;
      const qx = Math.abs(lx) - hx + r;
      const qy = Math.abs(ly) - hy + r;
      const sx = lx < 0 ? -1 : 1;
      const sy = ly < 0 ? -1 : 1;
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const d = Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
      let nx = 0;
      let ny = 0;
      if (Math.max(qx, qy) > 0) {
        const len = Math.hypot(ox, oy) || 1;
        nx = (ox / len) * sx;
        ny = (oy / len) * sy;
      } else if (qx > qy) {
        nx = sx;
      } else {
        ny = sy;
      }
      const t = Math.min(1, Math.max(0, -d / b));
      const k = 1 - t;
      const mag = d > 0 ? 0 : k * k;
      const i = (y * w + x) * 4;
      img.data[i] = Math.round(128 - nx * mag * 127);
      img.data[i + 1] = Math.round(128 - ny * mag * 127);
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { url: canvas.toDataURL("image/png"), scale: max * 2.008, width: w, height: h };
}
