// The field: one fragment shader that draws the ground behind every page and
// every glass slab on top of it. Glass is not a blur here. Each slab bends the
// ground along its bezel, splits colour slightly at the edge, frosts toward
// its centre and carries a rim light, so it reads as a thick piece of glass in
// any browser.
//
// The ground is split into zones. Each section of a page names a theme, and
// the shader paints that theme below the section's top edge: a contour map, a
// blueprint grid, halftone dots, a paper chart, sunset bands. Zones meet along
// a wobbling coastline instead of a straight cut.

export const MAX_RECTS = 12;
export const MAX_ZONES = 8;
export const MAX_TEXTS = 6;

/** Order matters: the index is the id the shader switches on. */
export const THEMES = ["abyss", "blueprint", "arcade", "paper", "sunset"] as const;
export type ThemeName = (typeof THEMES)[number];

export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = `#version 300 es
precision highp float;
#define MAXR ${MAX_RECTS}
#define MAXZ ${MAX_ZONES}
#define MAXT ${MAX_TEXTS}

uniform vec2 uRes;        // canvas size in device px
uniform float uPx;        // css px per device px
uniform vec2 uFieldOff;   // canvas-local css px -> ground space
uniform float uS;         // ground scale, css px per noise unit
uniform float uTime;
uniform vec2 uLight;      // direction toward the light, y down
uniform vec3 uPointer;    // xy canvas-local css px, z strength
uniform int uN;
uniform vec4 uA[MAXR];    // centre xy, half size xy (canvas-local css px)
uniform vec4 uB[MAXR];    // radius, angle, appear, hover
uniform vec4 uC[MAXR];    // bezel px, strength, frost px, tint
uniform vec4 uD[MAXR];    // zoom, rim, shadow, unused
uniform int uZN;
uniform vec2 uZ[MAXZ];    // zone top (canvas-local css px), theme id
uniform int uTN;
uniform sampler2D uText;
uniform vec4 uTR[MAXT];   // headline rect: xy, wh canvas-local css px
uniform vec4 uTU[MAXT];   // its place in the atlas: uv origin, uv size
uniform vec4 uTP[MAXT];   // reveal 0..1, unused
uniform float uTextScale; // atlas px per css px

out vec4 outColor;

const float K = 13.0;     // contour levels per unit of elevation
const float GRID = 112.0; // tick pitch on the maps, css px

struct Theme {
  vec3 c0; vec3 c1; vec3 c2; vec3 c3; // ground ramp, low to high
  vec3 line;   // drawn marks
  vec3 hot;    // marks on high ground
  vec3 ink;    // headlines drawn into the ground
  vec3 halo;   // what sits behind a headline
  vec3 tint;   // glass tint
  int pattern; // 0 contours, 1 grid, 2 dots, 3 bands
};

Theme themeOf(int id) {
  if (id == 1) return Theme( // blueprint
    vec3(0.020, 0.075, 0.300), vec3(0.030, 0.115, 0.430), vec3(0.045, 0.150, 0.520), vec3(0.060, 0.195, 0.610),
    vec3(0.80, 0.88, 1.00), vec3(1.00, 0.86, 0.38), vec3(0.95, 0.97, 1.00), vec3(0.015, 0.060, 0.250),
    vec3(0.22, 0.34, 0.72), 1);
  if (id == 2) return Theme( // arcade
    vec3(0.040, 0.012, 0.034), vec3(0.078, 0.020, 0.052), vec3(0.120, 0.028, 0.066), vec3(0.170, 0.038, 0.078),
    vec3(1.00, 0.30, 0.37), vec3(1.00, 0.84, 0.56), vec3(1.00, 0.95, 0.93), vec3(0.035, 0.010, 0.030),
    vec3(0.34, 0.13, 0.20), 2);
  if (id == 3) return Theme( // paper
    vec3(0.790, 0.850, 0.790), vec3(0.830, 0.880, 0.820), vec3(0.865, 0.908, 0.852), vec3(0.900, 0.935, 0.885),
    vec3(0.10, 0.30, 0.22), vec3(0.16, 0.30, 0.66), vec3(0.055, 0.165, 0.130), vec3(0.885, 0.925, 0.875),
    vec3(0.975, 0.990, 0.965), 0);
  if (id == 4) return Theme( // sunset
    vec3(0.130, 0.030, 0.045), vec3(0.300, 0.065, 0.050), vec3(0.500, 0.150, 0.055), vec3(0.700, 0.290, 0.095),
    vec3(1.00, 0.82, 0.55), vec3(1.00, 0.93, 0.76), vec3(1.00, 0.96, 0.90), vec3(0.120, 0.028, 0.035),
    vec3(0.40, 0.15, 0.10), 3);
  return Theme( // abyss
    vec3(0.010, 0.050, 0.094), vec3(0.020, 0.100, 0.165), vec3(0.035, 0.170, 0.245), vec3(0.060, 0.275, 0.345),
    vec3(0.60, 0.86, 0.93), vec3(1.00, 0.60, 0.28), vec3(0.93, 0.965, 0.975), vec3(0.012, 0.055, 0.094),
    vec3(0.19, 0.35, 0.42), 0);
}

float hash1(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

// Gradient noise with analytic derivatives: x = value, yz = gradient.
vec3 gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  vec2 du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  vec2 ga = hash2(i);
  vec2 gb = hash2(i + vec2(1.0, 0.0));
  vec2 gc = hash2(i + vec2(0.0, 1.0));
  vec2 gd = hash2(i + vec2(1.0, 1.0));
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  return vec3(
    va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * (va - vb - vc + vd),
    ga + u.x * (gb - ga) + u.y * (gc - ga) + u.x * u.y * (ga - gb - gc + gd)
      + du * (u.yx * (va - vb - vc + vd) + vec2(vb, vc) - va)
  );
}

// Elevation and its gradient. Each octave drifts its own way, so the terrain
// slowly changes shape instead of sliding.
vec3 terrain(vec2 q) {
  mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
  mat2 Mt = transpose(M);
  float t = uTime;
  vec3 n1 = gnoise(q + vec2(t * 0.011, -t * 0.007));
  vec2 q2 = M * q;
  vec3 n2 = gnoise(q2 + vec2(-t * 0.017, t * 0.013) + 17.3);
  vec2 q3 = M * q2;
  vec3 n3 = gnoise(q3 + vec2(t * 0.024, t * 0.019) + 41.7);
  float v = n1.x + 0.5 * n2.x + 0.2 * n3.x;
  vec2 g = n1.yz + 0.5 * (Mt * n2.yz) + 0.2 * (Mt * (Mt * n3.yz));
  return vec3(v, g);
}

vec3 ramp(Theme th, float h) {
  vec3 c = mix(th.c0, th.c1, smoothstep(0.0, 0.36, h));
  c = mix(c, th.c2, smoothstep(0.30, 0.66, h));
  return mix(c, th.c3, smoothstep(0.60, 1.0, h));
}

// One theme's ground at a point. pf is ground space, T the terrain there, and
// soft a blur radius in css px: the ground is procedural, so blurring it is
// just drawing its marks wider and fainter.
vec3 paint(Theme th, vec2 pf, vec3 T, float soft) {
  float aa = uPx * 0.9 + soft;
  float h = clamp(T.x * 0.78 + 0.5, 0.0, 1.0);
  float lv = T.x * K;

  if (th.pattern == 1) {
    // Drafting sheet: a fine grid, a heavier one every fifth line, and the
    // terrain reduced to a faint pencil trace.
    vec3 col = ramp(th, h);
    vec2 fine = abs(fract(pf / 28.0 + 0.5) - 0.5) * 28.0;
    vec2 bold = abs(fract(pf / 140.0 + 0.5) - 0.5) * 140.0;
    float fl = 1.0 - smoothstep(0.35, 0.35 + aa, min(fine.x, fine.y));
    float bl = 1.0 - smoothstep(0.6, 0.6 + aa, min(bold.x, bold.y));
    float keep = 1.6 / (1.6 + soft * 1.3);
    col = mix(col, th.line, (fl * 0.11 + bl * 0.26) * keep);
    float gl = max(length(T.yz) * K / uS, 0.0035);
    float nl = floor(lv * 0.5 + 0.5);
    float trace = 1.0 - smoothstep(0.5, 0.5 + aa, abs(lv * 0.5 - nl) / (gl * 0.5));
    return mix(col, th.hot, trace * 0.20 * keep);
  }

  if (th.pattern == 2) {
    // Halftone: dots on a tilted lattice that swell on high ground.
    vec3 col = ramp(th, h);
    vec2 r = vec2(0.940 * pf.x - 0.342 * pf.y, 0.342 * pf.x + 0.940 * pf.y) / 22.0;
    vec2 cell = fract(r) - 0.5;
    float size = mix(0.5, 7.6, smoothstep(0.20, 0.86, h));
    float d = length(cell) * 22.0;
    float dot_ = 1.0 - smoothstep(size - aa * 0.5, size + aa * 0.5 + 0.6, d);
    // Dots are loud, so frosted glass has to quieten them more than it does lines.
    float keep = (size + 1.0) / (size + 1.0 + soft * 2.4);
    vec3 dc = mix(th.line, th.hot, smoothstep(0.74, 0.90, h));
    return mix(col, dc, dot_ * keep * (0.34 + 0.46 * h));
  }

  if (th.pattern == 3) {
    // Sunset: broad bands of colour that follow the terrain, with a thin
    // bright crest where one band meets the next.
    float w = lv * 0.42;
    float band = floor(w);
    float f = fract(w);
    float tone = fract(band * 0.37 + 0.11);
    vec3 col = ramp(th, clamp(0.12 + 0.76 * tone + 0.18 * (h - 0.5), 0.0, 1.0));
    float gl = max(length(T.yz) * K * 0.42 / uS, 0.0018);
    float edge = min(f, 1.0 - f) / gl;
    float crest = 1.0 - smoothstep(0.7, 0.7 + aa, edge);
    float keep = 2.4 / (2.4 + soft * 1.2);
    return mix(col, th.line, crest * 0.34 * keep);
  }

  // Contour map: hairlines every level, a heavier index line every fifth,
  // stepped shading between them and a tick grid over the top.
  float gl = max(length(T.yz) * K / uS, 0.0035);
  float nl = floor(lv + 0.5);
  float dist = abs(lv - nl) / gl;
  float isIdx = 1.0 - step(0.5, mod(nl, 5.0));
  float hw = mix(0.5, 0.95, isIdx);
  float line = 1.0 - smoothstep(hw, hw + aa, dist);
  float keep = (2.0 * hw + 1.0) / (2.0 * hw + 1.0 + soft * 1.4);
  float hb = clamp((floor(lv) / K) * 0.78 + 0.5, 0.0, 1.0);
  vec3 col = ramp(th, mix(h, hb, 0.45 / (1.0 + soft * 0.6)));

  float high = smoothstep(0.60, 0.74, h);
  vec3 lineCol = mix(th.line, th.hot, high);
  float la = mix(0.19, 0.48, isIdx) * (0.55 + 0.65 * h) * (1.0 + 0.9 * high);
  col = mix(col, lineCol, min(1.0, line * keep * la));

  vec2 gd = abs(fract(pf / GRID + 0.5) - 0.5) * GRID;
  float gmin = min(gd.x, gd.y);
  float gmax = max(gd.x, gd.y);
  float gline = 1.0 - smoothstep(0.4, 0.4 + aa, gmin);
  float tick = (1.0 - smoothstep(0.7, 0.7 + aa, gmin)) * (1.0 - smoothstep(6.0, 6.0 + aa, gmax));
  float gkeep = 1.8 / (1.8 + soft * 1.4);
  return mix(col, th.line, (gline * 0.07 + tick * 0.36) * gkeep);
}

// Which zone a y falls in, and how far it has blended into the next one.
void zoneAt(float y, float band, out int a, out int b, out float w) {
  a = int(uZ[0].y);
  b = a;
  w = 0.0;
  for (int i = 1; i < MAXZ; i++) {
    if (i >= uZN) break;
    float e = y - uZ[i].x;
    if (e > band) {
      a = int(uZ[i].y);
      b = a;
      w = 0.0;
    } else if (e > -band) {
      b = int(uZ[i].y);
      w = smoothstep(-band, band, e);
      break;
    }
  }
}

// The ground at a point, headlines included.
vec3 scene(vec2 p, float soft) {
  vec2 pf = p + uFieldOff;
  vec3 T = terrain(pf / uS);

  int za; int zb; float zw;
  zoneAt(p.y + T.x * 96.0, 11.0 + soft, za, zb, zw);
  Theme ta = themeOf(za);
  vec3 col = paint(ta, pf, T, soft);
  vec3 ink = ta.ink;
  vec3 halo = ta.halo;
  if (zw > 0.0) {
    Theme tb = themeOf(zb);
    col = mix(col, paint(tb, pf, T, soft), zw);
    ink = mix(ink, tb.ink, zw);
    halo = mix(halo, tb.halo, zw);
    // A bright shoreline where two zones meet.
    col = mix(col, mix(ta.line, tb.line, zw), (1.0 - abs(zw * 2.0 - 1.0)) * 0.22);
  }

  for (int i = 0; i < MAXT; i++) {
    if (i >= uTN) break;
    vec2 uv = (p - uTR[i].xy) / uTR[i].zw;
    if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) continue;
    // Headlines surface the way something does through water: they start
    // soft and rippling and settle into place.
    float rv = uTP[i].x;
    float un = 1.0 - rv;
    vec2 q = uv;
    q.y += un * un * 0.16 * sin(uv.x * 11.0 + uTime * 2.6);
    q.x += un * un * 0.012 * sin(uv.y * 9.0 - uTime * 2.1);
    q = clamp(q, 0.002, 0.998);
    float lod = log2(max(1.0, uTextScale * (uPx + soft * 1.5 + un * un * 9.0)));
    vec2 at = uTU[i].xy + q * uTU[i].zw;
    float show = smoothstep(0.0, 0.5, rv);
    float glow = textureLod(uText, at, lod + 3.2).a;
    float a = textureLod(uText, at, lod).a;
    col = mix(col, halo, min(1.0, glow * 1.5) * 0.62 * show);
    col = mix(col, ink, a * show);
  }
  return col;
}

vec2 rot(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float sdBox(vec2 l, vec2 hs, float r) {
  vec2 q = abs(l) - hs + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 nBox(vec2 l, vec2 hs, float r) {
  vec2 q = abs(l) - hs + r;
  vec2 s = vec2(l.x < 0.0 ? -1.0 : 1.0, l.y < 0.0 ? -1.0 : 1.0);
  if (max(q.x, q.y) > 0.0) return normalize(max(q, 0.0)) * s;
  return q.x > q.y ? vec2(s.x, 0.0) : vec2(0.0, s.y);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) * uPx;

  int hit = -1;
  float hd = 1e5;
  vec2 hl = vec2(0.0);
  float sh = 0.0;

  for (int i = 0; i < MAXR; i++) {
    if (i >= uN) break;
    vec4 A = uA[i];
    vec4 B = uB[i];
    vec2 l = rot(p - A.xy, -B.y);
    vec2 ext = A.zw + 64.0;
    if (abs(l.x) > ext.x || abs(l.y) > ext.y) continue;
    float d = sdBox(l, A.zw, B.x);
    float ds = sdBox(l - vec2(0.0, 14.0), A.zw - 4.0, B.x);
    sh = max(sh, B.z * uD[i].z * (1.0 - smoothstep(-10.0, 38.0, ds)));
    if (d < uPx && B.z > 0.004) { hit = i; hd = d; hl = l; }
  }

  float cov = hit >= 0 ? 1.0 - smoothstep(-uPx * 0.75, uPx * 0.75, hd) : 0.0;
  vec3 col = vec3(0.0);
  if (cov < 1.0) col = scene(p, 0.0) * (1.0 - 0.6 * sh);

  if (cov > 0.0) {
    vec4 A = uA[hit];
    vec4 B = uB[hit];
    vec4 C = uC[hit];
    vec4 D = uD[hit];
    float ap = B.z;
    float hov = B.w;

    // Depth into the slab is measured on a rounder inner profile, so a bezel
    // wider than the corner radius still has a smooth normal everywhere.
    float pr = min(max(B.x, C.x), min(A.z, A.w));
    vec2 n = rot(nBox(hl, A.zw, pr), B.y);
    float t = clamp(-sdBox(hl, A.zw, pr) / C.x, 0.0, 1.0);
    float k = 1.0 - t;

    // A convex bezel bends light inward: the rim shows what sits deeper in,
    // squeezed, and the whole slab magnifies slightly. Under a hover the
    // slab swells a little, which shifts everything seen through it.
    float mag = C.y * C.x * k * k * ap * (1.0 + 0.45 * hov);
    vec2 off = -n * mag;
    vec2 pz = A.xy + (p - A.xy) / mix(1.0, D.x + 0.035 * hov, ap);
    float soft = C.z * (0.25 + 0.75 * smoothstep(0.0, 0.9, t)) * ap;

    vec3 g;
    if (mag > 0.6) {
      g.r = scene(pz + off * 1.10, soft).r;
      g.g = scene(pz + off, soft).g;
      g.b = scene(pz + off * 0.90, soft).b;
    } else {
      g = scene(pz + off, soft);
    }

    // The glass takes its tint from the zone it sits in.
    int za; int zb; float zw;
    zoneAt(p.y, 46.0, za, zb, zw);
    vec3 tint = themeOf(za).tint;
    if (zw > 0.0) tint = mix(tint, themeOf(zb).tint, zw);
    float pale = step(0.6, tint.g);

    float ti = C.w * ap * (0.62 + 0.38 * t) * (1.0 + 0.22 * hov) * mix(1.0, 1.5, pale);
    g = mix(g, tint, min(ti, 0.92));
    g += 0.010 * ap * (1.0 - pale);

    float ndl = dot(n, uLight);
    float inset = -hd;
    // Thickness: the side facing away from the light is a touch darker.
    g *= 1.0 - mix(0.22, 0.13, pale) * ap * (1.0 - smoothstep(0.0, 9.0, inset)) * max(-ndl, 0.0);
    float rim = 1.0 - smoothstep(0.0, 1.25 + uPx, inset);
    float lit = 0.16 + 1.0 * pow(max(ndl, 0.0), 1.4) + 0.42 * pow(max(-ndl, 0.0), 3.0);
    g += rim * lit * D.y * ap * (1.0 + 0.5 * hov);
    g += k * k * (0.25 + 0.75 * max(ndl, 0.0)) * 0.085 * ap * (1.0 - 0.5 * pale);

    vec2 pd = p - uPointer.xy;
    g += exp(-dot(pd, pd) / 33800.0) * uPointer.z * 0.055 * ap * (1.0 - pale);

    col = cov >= 1.0 ? g : mix(col, g, cov);
  }

  col += (hash1(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
