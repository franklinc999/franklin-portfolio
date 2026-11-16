// The field: one fragment shader that draws the contour map and every glass
// slab on top of it. Glass is not a blur here. Each slab bends the map along
// its bezel, splits colour slightly at the edge, frosts toward its centre and
// carries a rim light, so it reads as a thick piece of glass in any browser.

export const MAX_RECTS = 12;

export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAG = `#version 300 es
precision highp float;
#define MAXR ${MAX_RECTS}

uniform vec2 uRes;        // canvas size in device px
uniform float uPx;        // css px per device px
uniform vec2 uFieldOff;   // canvas-local css px -> map space
uniform float uS;         // map scale, css px per noise unit
uniform float uTime;
uniform vec2 uLight;      // direction toward the light, y down
uniform vec3 uPointer;    // xy canvas-local css px, z strength
uniform int uN;
uniform vec4 uA[MAXR];    // centre xy, half size xy (canvas-local css px)
uniform vec4 uB[MAXR];    // radius, angle, appear, hover
uniform vec4 uC[MAXR];    // bezel px, strength, frost px, tint
uniform vec4 uD[MAXR];    // zoom, rim, shadow, unused
uniform sampler2D uText;
uniform vec4 uTextRect;   // xy, wh canvas-local css px
uniform float uTextScale; // texture px per css px
uniform float uTextOn;

out vec4 outColor;

const float K = 13.0;     // contour levels per unit of elevation
const float GRID = 112.0; // grid pitch, css px

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

vec3 ramp(float h) {
  vec3 c0 = vec3(0.010, 0.050, 0.094);
  vec3 c1 = vec3(0.020, 0.100, 0.165);
  vec3 c2 = vec3(0.035, 0.170, 0.245);
  vec3 c3 = vec3(0.060, 0.275, 0.345);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.36, h));
  c = mix(c, c2, smoothstep(0.30, 0.66, h));
  return mix(c, c3, smoothstep(0.60, 1.0, h));
}

// The map at a point. soft is a blur radius in css px: because the map is
// procedural, blurring it is just drawing its lines wider and fainter.
vec3 scene(vec2 p, float soft) {
  vec2 pf = p + uFieldOff;
  vec3 T = terrain(pf / uS);
  float lv = T.x * K;
  float gl = max(length(T.yz) * K / uS, 0.0035);
  float nl = floor(lv + 0.5);
  float dist = abs(lv - nl) / gl;
  float isIdx = 1.0 - step(0.5, mod(nl, 5.0));
  float hw = mix(0.5, 0.95, isIdx);
  float aa = uPx * 0.9 + soft;
  float line = 1.0 - smoothstep(hw, hw + aa, dist);
  float keep = (2.0 * hw + 1.0) / (2.0 * hw + 1.0 + soft * 1.4);

  float h = clamp(T.x * 0.78 + 0.5, 0.0, 1.0);
  float hb = clamp((floor(lv) / K) * 0.78 + 0.5, 0.0, 1.0);
  vec3 col = ramp(mix(h, hb, 0.45 / (1.0 + soft * 0.6)));

  float high = smoothstep(0.60, 0.74, h);
  vec3 lineCol = mix(vec3(0.60, 0.86, 0.93), vec3(1.0, 0.60, 0.28), high);
  float la = mix(0.19, 0.48, isIdx) * (0.55 + 0.65 * h) * (1.0 + 0.9 * high);
  col += lineCol * line * keep * la;

  vec2 gd = abs(fract(pf / GRID + 0.5) - 0.5) * GRID;
  float gmin = min(gd.x, gd.y);
  float gmax = max(gd.x, gd.y);
  float gline = 1.0 - smoothstep(0.4, 0.4 + aa, gmin);
  float tick = (1.0 - smoothstep(0.7, 0.7 + aa, gmin)) * (1.0 - smoothstep(6.0, 6.0 + aa, gmax));
  float gkeep = 1.8 / (1.8 + soft * 1.4);
  col += vec3(0.70, 0.90, 0.96) * (gline * 0.07 + tick * 0.36) * gkeep;

  if (uTextOn > 0.5) {
    vec2 uv = (p - uTextRect.xy) / uTextRect.zw;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      float lod = log2(max(1.0, uTextScale * (uPx + soft * 1.5)));
      float a = textureLod(uText, uv, lod).a;
      col = mix(col, vec3(0.93, 0.965, 0.975), a);
    }
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
    if (d < uPx) { hit = i; hd = d; hl = l; }
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

    // Depth into the slab is measured on a rounder inner profile, so a bezel
    // wider than the corner radius still has a smooth normal everywhere.
    float pr = min(max(B.x, C.x), min(A.z, A.w));
    vec2 n = rot(nBox(hl, A.zw, pr), B.y);
    float t = clamp(-sdBox(hl, A.zw, pr) / C.x, 0.0, 1.0);
    float k = 1.0 - t;

    // A convex bezel bends light inward: the rim shows what sits deeper in,
    // squeezed, and the whole slab magnifies slightly.
    float mag = C.y * C.x * k * k * ap;
    vec2 off = -n * mag;
    vec2 pz = A.xy + (p - A.xy) / mix(1.0, D.x, ap);
    float soft = C.z * (0.25 + 0.75 * smoothstep(0.0, 0.9, t)) * ap;

    vec3 g;
    if (mag > 0.6) {
      g.r = scene(pz + off * 1.10, soft).r;
      g.g = scene(pz + off, soft).g;
      g.b = scene(pz + off * 0.90, soft).b;
    } else {
      g = scene(pz + off, soft);
    }

    float ti = C.w * ap * (0.62 + 0.38 * t) * (1.0 + 0.22 * B.w);
    g = mix(g, vec3(0.19, 0.35, 0.42), ti);
    g += 0.010 * ap;

    float ndl = dot(n, uLight);
    float inset = -hd;
    // Thickness: the side facing away from the light is a touch darker.
    g *= 1.0 - 0.22 * ap * (1.0 - smoothstep(0.0, 9.0, inset)) * max(-ndl, 0.0);
    float rim = 1.0 - smoothstep(0.0, 1.25 + uPx, inset);
    float lit = 0.16 + 1.0 * pow(max(ndl, 0.0), 1.4) + 0.42 * pow(max(-ndl, 0.0), 3.0);
    g += rim * lit * D.y * ap * (1.0 + 0.5 * B.w);
    g += k * k * (0.25 + 0.75 * max(ndl, 0.0)) * 0.085 * ap;

    vec2 pd = p - uPointer.xy;
    g += exp(-dot(pd, pd) / 33800.0) * uPointer.z * 0.055 * ap;

    col = cov >= 1.0 ? g : mix(col, g, cov);
  }

  col += (hash1(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`;
