import * as THREE from "three";
import { sound } from "@/components/play/sound";

/**
 * Dink: singles pickleball against the computer, on a real-size court, drawn like a 1970s rec league
 * poster: flat colour, hard shading, and vegetables for players.
 *
 * Both players run to the ball on their own. What you choose is when to swing and where to put it:
 * click or tap a spot on the far side as the ball comes up off its bounce. Clean timing lands on the
 * spot; early or late sprays. The rules are simplified (see the page), the court is not.
 */

export type Side = "you" | "them";

export type PickleState = {
  you: number;
  them: number;
  server: Side;
  phase: "idle" | "serve" | "rally" | "point" | "over";
  /** The call on the last point, and who it went to. */
  note: string;
  won: Side | null;
  /** How the last swing was timed. */
  timing: "" | "Clean" | "Early" | "Late" | "Whiff";
  rally: number;
  longest: number;
  swings: number;
  clean: number;
};

export type PickleOptions = { level: 0 | 1 | 2; target: 5 | 11 };

type Plan = { ideal: THREE.Vector3; tStart: number; tIdeal: number; tEnd: number };
type Player = {
  group: THREE.Group;
  arm: THREE.Group;
  shadow: THREE.Mesh;
  x: number;
  z: number;
  swing: number;
  step: number;
};

// A pickleball court, in metres.
const HALF_W = 3.05;
const HALF_L = 6.705;
const KITCHEN = 2.134;
const NET = 0.88;
const G = 8.8;
const R = 0.075;
const REACH = 1.45;
const THEIR_REACH = 1.25;
const TRAIL = 10;

const NAVY = 0x1d2a44;
const CREAM = 0xfff3d6;
const MUSTARD = 0xf4b83a;
const TOMATO = 0xe4572e;
const TEAL = 0x1a9a8f;
const DEEP = 0x12756d;
const CLAY = 0xd9603b;
const BALL = 0xf2ff5a;

/** How quick, how alert and how accurate the opponent is at each level. */
const LEVELS = [
  { speed: 2.9, react: 0.34, error: 1.15, miss: 0.08, dink: 0.12, late: 0.14, pace: 0.9 },
  { speed: 3.5, react: 0.25, error: 0.68, miss: 0.035, dink: 0.25, late: 0.07, pace: 1 },
  { speed: 3.9, react: 0.18, error: 0.38, miss: 0.015, dink: 0.36, late: 0.03, pace: 1.1 },
];

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext("2d");
  if (c) draw(c);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class PickleEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 300);
  private look = new THREE.Vector3(0, 0.5, -1.4);
  private ball: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private trail: THREE.InstancedMesh;
  private trailPos: THREE.Vector3[] = [];
  private reticle: THREE.Mesh;
  private spot: THREE.Mesh;
  private closing: THREE.Mesh;
  private pop: THREE.Sprite;
  private popLife = 0;
  private steps: THREE.DataTexture;
  private rim = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, fog: false });
  private you: Player;
  private them: Player;
  private rivals: Player[] = [];
  private dummy = new THREE.Object3D();
  private caster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private raf = 0;
  private last = 0;
  private now = 0;
  private paused = false;
  private options: PickleOptions = { level: 1, target: 11 };
  private state: PickleState = { you: 0, them: 0, server: "you", phase: "idle", note: "", won: null, timing: "", rally: 0, longest: 0, swings: 0, clean: 0 };

  private pos = new THREE.Vector3(0, 1, 6.6);
  private vel = new THREE.Vector3();
  private lastHit: Side = "you";
  private bounces = 0;
  private isServe = false;
  private dead = false;
  private planYou: Plan | null = null;
  private planThem: Plan | null = null;
  private themHitAt = 0;
  private themRun = 0;
  private themSeesAt = 0;
  private serveAt = 0;
  private pointUntil = 0;
  private whiffUntil = 0;
  private aim = new THREE.Vector3(0, 0, -4.5);

  constructor(
    private canvas: HTMLCanvasElement,
    private onState: (s: PickleState) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const shade = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    shade.minFilter = shade.magFilter = THREE.NearestFilter;
    shade.needsUpdate = true;
    this.steps = shade;

    this.scene.background = new THREE.Color(0xfff1cf);
    this.scene.add(this.camera);

    this.buildCourt();
    this.you = this.buildVeg("pickle", 1);
    this.rivals = [this.buildVeg("onion", -1), this.buildVeg("carrot", -1), this.buildVeg("chili", -1)];
    this.them = this.rivals[1];
    this.cast();

    this.ball = this.edge(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), this.toon(BALL)), 1.16);
    this.scene.add(this.ball);
    this.ballShadow = this.disc(0.14, NAVY, 0.45);
    this.trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), this.ink(0xffffff), TRAIL);
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
    for (let i = 0; i < TRAIL; i++) this.trailPos.push(this.pos.clone());

    const ring = (inner: number, outer: number, color: number, opacity: number) => {
      const geo = new THREE.RingGeometry(inner, outer, 44);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
      m.position.y = 0.02;
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    // Where you are aiming: a white ring with a dark edge, so it shows on teal and on mustard.
    this.reticle = ring(0.3, 0.42, 0xffffff, 1);
    const rimRing = new THREE.RingGeometry(0.42, 0.47, 44);
    rimRing.rotateX(-Math.PI / 2);
    this.reticle.add(new THREE.Mesh(rimRing, this.ink(NAVY)));
    this.spot = ring(0.34, 0.42, CREAM, 0.95);
    this.closing = ring(0.36, 0.44, NAVY, 1);

    // The pop when a paddle meets the ball: a white burst, straight out of a comic.
    this.pop = new THREE.Sprite(
      new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        map: canvasTexture(128, 128, (c) => {
          c.translate(64, 64);
          c.beginPath();
          for (let i = 0; i < 24; i++) {
            const r = i % 2 ? 30 : 58;
            const a = (i / 24) * Math.PI * 2;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          c.closePath();
          c.fillStyle = "#ffffff";
          c.fill();
          c.lineWidth = 7;
          c.strokeStyle = "#1d2a44";
          c.stroke();
        }),
      }),
    );
    this.scene.add(this.pop);

    this.place();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- scene ---------- */

  /** Flat, unlit colour: the court and everything around it is drawn like a printed poster. */
  private ink(color: number, opts: THREE.MeshBasicMaterialParameters = {}) {
    return new THREE.MeshBasicMaterial({ color, fog: false, ...opts });
  }

  /** Three hard steps of shade, for anything with a body. */
  private toon(color: number) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.steps });
  }

  /** A dark edge around a shape: the same shape, a little bigger, drawn inside out. */
  private edge<T extends THREE.Mesh>(mesh: T, grow = 1.08) {
    const rim = new THREE.Mesh(mesh.geometry, this.rim);
    rim.scale.setScalar(grow);
    mesh.add(rim);
    return mesh;
  }

  private disc(radius: number, color: number, opacity: number) {
    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    mesh.position.y = 0.012;
    this.scene.add(mesh);
    return mesh;
  }

  private buildCourt() {
    const slab = (w: number, d: number, color: number, y: number, x = 0, z = 0) => {
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, this.ink(color));
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      return mesh;
    };
    slab(900, 900, CLAY, 0); // clay out to the horizon
    slab(HALF_W * 2 + 7, HALF_L * 2 + 8.4, DEEP, 0.002); // the pad
    slab(HALF_W * 2, HALF_L * 2, TEAL, 0.004); // the court
    slab(HALF_W * 2, KITCHEN * 2, MUSTARD, 0.006); // the kitchen, both sides of the net

    const line = this.ink(CREAM);
    const stripe = (w: number, d: number, x: number, z: number) => {
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, line);
      mesh.position.set(x, 0.009, z);
      this.scene.add(mesh);
    };
    const T = 0.07;
    for (const s of [-1, 1]) {
      stripe(HALF_W * 2 + T, T, 0, s * HALF_L);
      stripe(T, HALF_L * 2, s * HALF_W, 0);
      stripe(HALF_W * 2, T, 0, s * KITCHEN);
      stripe(T, HALF_L - KITCHEN, 0, s * (KITCHEN + (HALF_L - KITCHEN) / 2));
    }

    const mesh = canvasTexture(256, 64, (c) => {
      c.clearRect(0, 0, 256, 64);
      c.fillStyle = "rgba(29,42,68,0.2)";
      c.fillRect(0, 0, 256, 64);
      c.strokeStyle = "rgba(29,42,68,0.85)";
      c.lineWidth = 1.5;
      for (let x = 0; x <= 256; x += 8) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, 64);
        c.stroke();
      }
      for (let y = 0; y <= 64; y += 8) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(256, y);
        c.stroke();
      }
    });
    const net = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 0.6, NET), new THREE.MeshBasicMaterial({ map: mesh, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    net.position.set(0, NET / 2, 0);
    this.scene.add(net);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 0.6, 0.08, 0.04), line);
    tape.position.set(0, NET, 0);
    this.scene.add(tape);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, NET + 0.1, 10), this.ink(NAVY));
      post.position.set(s * (HALF_W + 0.3), (NET + 0.1) / 2, 0);
      this.scene.add(post);
    }

    // Behind the far baseline: a low wall, a string of pennants, hills, and a very large sun.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 1.1, 0.2), this.ink(CREAM));
    wall.position.set(0, 0.55, -10.6);
    const band = new THREE.Mesh(new THREE.BoxGeometry(40, 0.26, 0.22), this.ink(TOMATO));
    band.position.set(0, 0.82, -10.6);
    this.scene.add(wall, band);

    const flag = new THREE.BufferGeometry();
    flag.setAttribute("position", new THREE.Float32BufferAttribute([-0.34, 0, 0, 0.34, 0, 0, 0, -0.78, 0], 3));
    const colours = [TOMATO, CREAM, MUSTARD, TEAL];
    for (let i = 0; i < 25; i++) {
      const u = i / 24;
      const pennant = new THREE.Mesh(flag, this.ink(colours[i % colours.length], { side: THREE.DoubleSide }));
      // The string sags in the middle.
      pennant.position.set(-10 + u * 20, 4.5 - Math.sin(u * Math.PI) * 0.9, -10.4);
      pennant.rotation.z = (u - 0.5) * -0.35;
      this.scene.add(pennant);
    }
    for (const s of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.7, 8), this.ink(NAVY));
      pole.position.set(s * 10.2, 2.35, -10.4);
      this.scene.add(pole);
    }

    const round = (r: number, color: number, x: number, y: number, z: number, squash = 1) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), this.ink(color));
      m.position.set(x, y, z);
      m.scale.y = squash;
      this.scene.add(m);
    };
    round(46, 0xf9d98a, -14, 8, -260);
    round(36, MUSTARD, -14, 8, -255);
    round(70, 0x12756d, 62, -18, -200, 0.55);
    round(86, TEAL, -78, -24, -185, 0.5);
    round(60, 0x5a9e3f, 8, -26, -170, 0.5);

    // Courtside: a bench and a drinks cooler.
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 2.4), this.ink(CREAM));
    seat.position.set(-5.5, 0.48, 1.2);
    this.scene.add(seat);
    for (const z of [0.2, 2.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.46, 0.08), this.ink(NAVY));
      leg.position.set(-5.5, 0.23, z);
      this.scene.add(leg);
    }
    const cooler = this.edge(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 16), this.toon(TOMATO)), 1.06);
    cooler.position.set(-5.5, 0.35, -0.9);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 16), this.toon(CREAM));
    lid.position.y = 0.4;
    cooler.add(lid);
    this.scene.add(cooler);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8468, 1.7));
    const sun = new THREE.DirectionalLight(0xfff0cf, 1.9);
    sun.position.set(-6, 9, 6);
    this.scene.add(sun);
  }

  /**
   * The players are vegetables. You are a pickle; across the net is an onion, a carrot or a chili,
   * depending on who you asked to play.
   */
  private buildVeg(kind: "pickle" | "onion" | "carrot" | "chili", facing: 1 | -1): Player {
    const group = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rim = true) => {
      const m = new THREE.Mesh(geo, this.toon(color));
      m.position.set(x, y, z);
      if (rim) this.edge(m);
      group.add(m);
      return m;
    };
    let eyesAt = 1.3;
    let girth = 0.26;
    if (kind === "pickle") {
      add(new THREE.CapsuleGeometry(0.27, 0.62, 8, 18), 0x6aa84f, 0, 1.0, 0);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        add(new THREE.SphereGeometry(0.045, 8, 6), 0x4f8a3a, Math.cos(a) * 0.26, 0.62 + (i % 5) * 0.17, Math.sin(a) * 0.26, false);
      }
      add(new THREE.TorusGeometry(0.26, 0.055, 8, 22), TOMATO, 0, 1.42, 0, false).rotation.x = Math.PI / 2;
    } else if (kind === "onion") {
      const bulb = add(new THREE.SphereGeometry(0.44, 20, 16), 0xc58bd6, 0, 0.92, 0, false);
      bulb.scale.set(1, 0.9, 1);
      this.edge(bulb, 1.06);
      for (const s of [-0.5, 0, 0.5]) {
        const leaf = add(new THREE.ConeGeometry(0.07, 0.42, 8), 0x5a9e3f, s * 0.14, 1.5, 0, false);
        leaf.rotation.z = -s * 0.7;
      }
      add(new THREE.TorusGeometry(0.4, 0.05, 8, 22), CREAM, 0, 1.12, 0, false).rotation.x = Math.PI / 2;
      eyesAt = 0.98;
      girth = 0.42;
    } else if (kind === "carrot") {
      const root = add(new THREE.ConeGeometry(0.34, 1.2, 18), 0xf2832b, 0, 1.02, 0);
      root.rotation.x = Math.PI;
      for (const s of [-1, 0, 1]) {
        const leaf = add(new THREE.ConeGeometry(0.09, 0.5, 8), 0x5a9e3f, s * 0.12, 1.82, 0, false);
        leaf.rotation.z = -s * 0.6;
      }
      eyesAt = 1.36;
      girth = 0.3;
    } else {
      const pod = add(new THREE.CapsuleGeometry(0.21, 0.72, 8, 18), 0xd7263d, 0, 1.02, 0);
      pod.rotation.x = facing * 0.16;
      add(new THREE.CylinderGeometry(0.15, 0.22, 0.14, 12), 0x3f7d3a, 0, 1.6, 0, false);
      add(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 8), 0x3f7d3a, 0.03, 1.78, 0, false).rotation.z = -0.4;
      eyesAt = 1.28;
      girth = 0.2;
    }
    // A face on the front. You only ever see your own from behind.
    for (const s of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.ink(0xffffff));
      white.position.set(s * 0.1, eyesAt, -girth * 0.96);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), this.ink(NAVY));
      pupil.position.set(s * 0.1, eyesAt, -girth * 0.96 - 0.055);
      group.add(white, pupil);
    }
    for (const s of [-1, 1]) {
      const geo = new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8);
      geo.translate(0, -0.21, 0);
      const leg = new THREE.Mesh(geo, this.ink(NAVY));
      leg.position.set(s * 0.11, 0.46, 0);
      leg.name = s < 0 ? "legL" : "legR";
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.22), this.ink(0xffffff));
      shoe.position.set(0, -0.42, -0.04);
      leg.add(shoe);
      group.add(leg);
    }
    const arm = new THREE.Group();
    arm.position.set(girth, 1.02, 0);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.44, 8), this.ink(NAVY));
    fore.rotation.x = Math.PI / 2;
    fore.position.z = -0.24;
    const face = new THREE.CylinderGeometry(0.17, 0.17, 0.03, 22);
    face.rotateZ(Math.PI / 2);
    const paddle = this.edge(new THREE.Mesh(face, this.toon(facing === 1 ? TOMATO : CREAM)), 1.1);
    paddle.position.z = -0.6;
    arm.add(fore, paddle);
    group.add(arm);
    group.rotation.y = facing === 1 ? 0 : Math.PI;
    this.scene.add(group);
    return { group, arm, shadow: this.disc(0.36, NAVY, 0.35), x: 0, z: facing * 5, swing: 0, step: 0 };
  }

  /* ---------- public ---------- */

  setOptions(o: PickleOptions) {
    this.options = o;
    const next = this.rivals[o.level];
    next.x = this.them.x;
    next.z = this.them.z;
    this.them = next;
    this.cast();
  }

  /** Only the opponent you picked is on court. */
  private cast() {
    for (const r of this.rivals) r.group.visible = r.shadow.visible = r === this.them;
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // A tall screen needs the camera higher and further back to keep both sidelines in view.
    const tall = Math.min(1, Math.max(0, (1.5 - aspect) / 0.75));
    this.camera.fov = 38 + tall * 18;
    this.camera.position.set(0, 4.8 + tall * 2.6, 15.5 - tall * 1.2);
    this.look.set(0, 0.5 - tall * 0.5, -1.4 + tall * 1.2);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.state = { you: 0, them: 0, server: "you", phase: "serve", note: "", won: null, timing: "", rally: 0, longest: 0, swings: 0, clean: 0 };
    this.paused = false;
    this.beginServe("you");
  }

  stop() {
    this.state.phase = "idle";
    this.push();
  }

  setPaused(value: boolean) {
    this.paused = value;
    this.last = performance.now();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }

  /** Point at a spot on the far side. `at` is in normalised device coordinates. */
  aimAt(at: { x: number; y: number }) {
    this.caster.setFromCamera(new THREE.Vector2(at.x, at.y), this.camera);
    const hit = this.caster.ray.intersectPlane(this.ground, new THREE.Vector3());
    if (hit) this.setAim(hit.x, hit.z);
  }

  /** Move the aim by a step, for the keyboard. */
  nudge(dx: number, dz: number) {
    this.setAim(this.aim.x + dx, this.aim.z + dz);
  }

  private setAim(x: number, z: number) {
    const serving = this.state.phase === "serve";
    this.aim.set(Math.max(-HALF_W + 0.1, Math.min(HALF_W - 0.1, x)), 0, Math.max(-HALF_L + 0.1, Math.min(serving ? -KITCHEN - 0.3 : -0.4, z)));
  }

  /** Swing. With `at`, aim there first. */
  swing(at?: { x: number; y: number }) {
    if (this.paused) return;
    if (at) this.aimAt(at);
    const s = this.state;
    if (s.phase === "serve" && s.server === "you") {
      this.setAim(this.aim.x, this.aim.z);
      this.you.swing = 1;
      this.hit("you", this.aim.x, this.aim.z, 0.22, true);
      return;
    }
    if (s.phase !== "rally" || this.now < this.whiffUntil) return;
    this.you.swing = 1;
    s.swings++;
    const plan = this.planYou;
    const near = Math.hypot(this.pos.x - this.you.x, this.pos.z - this.you.z) < REACH;
    const ready = this.lastHit === "them" && this.bounces === 1 && !this.dead && plan && near && this.pos.y > 0.15 && this.pos.y < 2;
    if (!ready || !plan) {
      // Swinging at air costs you a beat.
      this.whiffUntil = this.now + 0.42;
      s.timing = "Whiff";
      sound.swing();
      this.push();
      return;
    }
    const off = this.now - plan.tIdeal;
    const span = off < 0 ? plan.tIdeal - plan.tStart : plan.tEnd - plan.tIdeal;
    const quality = 1 - Math.min(1, Math.abs(off) / Math.max(0.08, span));
    s.timing = quality > 0.62 ? "Clean" : off < 0 ? "Early" : "Late";
    if (quality > 0.62) s.clean++;
    // Clean timing lands on the spot. The further off, the wider it sprays.
    const spray = 0.1 + (1 - quality) ** 2 * 2.4;
    this.hit("you", this.aim.x, this.aim.z, spray, false, quality > 0.62 ? 1.15 : 1);
  }

  /** For the automated check: what the game would like you to do right now. */
  debug() {
    const plan = this.planYou;
    const near = Math.hypot(this.pos.x - this.you.x, this.pos.z - this.you.z) < REACH;
    const v = new THREE.Vector3();
    const project = (x: number, z: number) => {
      v.set(x, 0, z).project(this.camera);
      return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight };
    };
    return {
      phase: this.state.phase,
      server: this.state.server,
      canHit: this.state.phase === "rally" && this.lastHit === "them" && this.bounces === 1 && !this.dead && !!plan && near,
      toIdeal: plan ? plan.tIdeal - this.now : 0,
      them: { x: this.them.x, z: this.them.z },
      project,
    };
  }

  /* ---------- the ball ---------- */

  /** Send the ball from where it is to a spot on the other side, with some spray. */
  private hit(by: Side, tx: number, tz: number, spray: number, serve: boolean, pace = 1) {
    const angle = Math.random() * Math.PI * 2;
    const far = Math.sqrt(Math.random()) * spray;
    tx += Math.cos(angle) * far;
    tz += Math.sin(angle) * far * 1.25;

    const from = this.pos;
    const depth = Math.min(1, Math.max(0, (Math.abs(tz) - 1.4) / 4.6));
    // Pickleball is a slow game on a small court: the ball should give both players time to get there.
    // A cleanly timed ball comes off the paddle with more on it.
    let speed = (6.4 + depth * 5.2) * (by === "them" ? LEVELS[this.options.level].pace : pace);
    if (serve) speed = 9.5;
    const dist = Math.hypot(tx - from.x, tz - from.z);
    let time = dist / speed;
    // Add loft until it clears the net with a little room. Slower shots have to arc.
    for (let i = 0; i < 60; i++) {
      const vy = (R - from.y) / time + 0.5 * G * time;
      const tNet = (-from.z / (tz - from.z)) * time;
      const yNet = from.y + vy * tNet - 0.5 * G * tNet * tNet;
      if (yNet >= NET + 0.16) break;
      time *= 1.05;
    }
    this.vel.set((tx - from.x) / time, (R - from.y) / time + 0.5 * G * time, (tz - from.z) / time);
    // A badly mistimed ball can also clip the tape.
    if (!serve && spray > 1.6 && Math.random() < 0.45) this.vel.y *= 0.8;

    this.lastHit = by;
    this.bounces = 0;
    this.isServe = serve;
    this.dead = false;
    if (this.state.phase === "serve") this.state.phase = "rally";
    this.state.rally = serve ? 1 : this.state.rally + 1;
    this.state.longest = Math.max(this.state.longest, this.state.rally);
    if (by === "them") this.state.timing = "";

    const plan = this.predict();
    if (by === "you") {
      this.planThem = plan;
      this.planYou = null;
      if (plan) {
        this.themHitAt = plan.tIdeal + (Math.random() * 2 - 1) * LEVELS[this.options.level].late;
        this.themRun = Math.hypot(plan.ideal.x - this.them.x, plan.ideal.z - this.them.z);
        this.themSeesAt = this.now + LEVELS[this.options.level].react;
      }
    } else {
      this.planYou = plan;
      this.planThem = null;
    }
    this.popLife = 1;
    this.pop.position.copy(from);
    sound.pop();
    this.push();
  }

  /** One step of flight. Returns what the ball ran into, if anything. */
  private stepBall(p: THREE.Vector3, v: THREE.Vector3, dt: number): "" | "bounce" | "net" {
    const z0 = p.z;
    v.y -= G * dt;
    p.addScaledVector(v, dt);
    if (z0 !== 0 && Math.sign(z0) !== Math.sign(p.z) && Math.abs(p.x) < HALF_W + 0.35) {
      const f = z0 / (z0 - p.z);
      const yAt = p.y - v.y * dt * (1 - f);
      if (yAt < NET + R * 0.4) {
        p.z = Math.sign(z0) * 0.08;
        v.z *= -0.12;
        v.x *= 0.3;
        v.y = Math.min(v.y, 0) * 0.3;
        return "net";
      }
    }
    if (p.y <= R && v.y < 0) {
      p.y = R;
      // A pickleball is light and full of holes: it loses a lot of pace on the bounce and sits up.
      v.y *= -0.62;
      v.x *= 0.58;
      v.z *= 0.58;
      return "bounce";
    }
    return "";
  }

  /** Is a first bounce at this spot good for the player who hit it? */
  private landsIn(x: number, z: number) {
    const receiver = this.lastHit === "you" ? -1 : 1;
    if (Math.sign(z) !== receiver) return false;
    if (Math.abs(x) > HALF_W + R || Math.abs(z) > HALF_L + R) return false;
    if (this.isServe && Math.abs(z) <= KITCHEN + 0.02) return false;
    return true;
  }

  /** Where and when the receiver should meet the ball, or null if it is not coming in. */
  private predict(): Plan | null {
    const p = this.pos.clone();
    const v = this.vel.clone();
    const dt = 1 / 240;
    let t = this.now;
    for (let i = 0; i < 2400; i++) {
      const hit = this.stepBall(p, v, dt);
      t += dt;
      if (hit === "net") return null;
      if (hit === "bounce") break;
    }
    if (!this.landsIn(p.x, p.z)) return null;
    const tStart = t + 0.1;
    // Best contact is on the way up to the top of the bounce, before the ball has run far.
    const tIdeal = t + Math.min(0.34, Math.max(0.14, v.y / G));
    const ideal = p.clone();
    let tEnd = t;
    for (let i = 0; i < 2400; i++) {
      const hit = this.stepBall(p, v, dt);
      tEnd += dt;
      if (Math.abs(tEnd - tIdeal) < dt) ideal.copy(p);
      if (hit === "bounce") break;
    }
    return { ideal, tStart, tIdeal, tEnd };
  }

  /* ---------- points ---------- */

  private beginServe(server: Side) {
    const s = this.state;
    s.server = server;
    s.phase = "serve";
    s.rally = 0;
    s.timing = "";
    this.planYou = this.planThem = null;
    this.dead = false;
    this.bounces = 0;
    this.vel.set(0, 0, 0);
    this.you.x = server === "you" ? 1.1 : -0.6;
    this.you.z = server === "you" ? HALF_L + 0.35 : HALF_L - 0.6;
    this.them.x = server === "them" ? -1.1 : 0.6;
    this.them.z = server === "them" ? -HALF_L - 0.35 : -HALF_L + 0.6;
    this.serveAt = this.now + 1.1;
    this.setAim(0, -5);
    this.place();
    this.push();
  }

  private award(to: Side, note: string) {
    const s = this.state;
    if (s.phase !== "rally") return;
    s[to]++;
    s.note = note;
    s.won = to;
    s.phase = "point";
    this.dead = true;
    this.pointUntil = this.now + 1.6;
    if (to === "you") sound.good();
    else sound.bad();
    this.push();
  }

  private place() {
    const s = this.state;
    if (s.phase === "serve" || s.phase === "idle") {
      const p = s.server === "you" ? this.you : this.them;
      const f = s.server === "you" ? -1 : 1;
      this.pos.set(p.x - f * 0.3, 1.0, p.z + f * 0.45);
    }
  }

  /* ---------- loop ---------- */

  private frame = (time: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, Math.max(0.001, (time - this.last) / 1000));
    this.last = time;
    if (!this.paused) {
      // Fixed small steps keep bounces and the net honest when frames are slow.
      let left = dt;
      while (left > 0) {
        const h = Math.min(left, 1 / 120);
        this.update(h);
        left -= h;
      }
    }
    this.draw(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private run(p: Player, tx: number, tz: number, speed: number, dt: number) {
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.02) return;
    const move = Math.min(d, speed * dt);
    p.x += (dx / d) * move;
    p.z += (dz / d) * move;
    p.step += move * 5;
  }

  private update(dt: number) {
    this.now += dt;
    const s = this.state;
    const level = LEVELS[this.options.level];

    if (s.phase === "idle" || s.phase === "over") return;

    if (s.phase === "serve") {
      this.place();
      if (s.server === "them" && this.now >= this.serveAt) {
        this.them.swing = 1;
        this.hit("them", (Math.random() * 2 - 1) * 2.2, 3.6 + Math.random() * 2.4, 0.25 + level.error * 0.25, true);
      }
      return;
    }

    if (s.phase === "point" && this.now >= this.pointUntil) {
      const lead = Math.abs(s.you - s.them);
      if (Math.max(s.you, s.them) >= this.options.target && lead >= 2) {
        s.phase = "over";
        sound.end();
        this.push();
      } else {
        this.beginServe(s.won ?? "you");
      }
      return;
    }

    // Flight.
    const what = this.stepBall(this.pos, this.vel, dt);
    if (what === "bounce") {
      this.bounces++;
      if (Math.abs(this.vel.y) > 0.6) sound.thud();
      if (!this.dead) {
        const hitter = this.lastHit;
        const other: Side = hitter === "you" ? "them" : "you";
        if (this.bounces === 1 && !this.landsIn(this.pos.x, this.pos.z)) {
          const own = Math.sign(this.pos.z) === (hitter === "you" ? 1 : -1);
          this.award(other, own ? "Short" : this.isServe && Math.abs(this.pos.z) <= KITCHEN + 0.02 && Math.abs(this.pos.x) <= HALF_W ? "Serve landed in the kitchen" : "Out");
        } else if (this.bounces === 2) {
          this.award(hitter, hitter === "you" ? "Too good" : "Got past you");
        }
      }
    } else if (what === "net" && !this.dead) {
      this.award(this.lastHit === "you" ? "them" : "you", "Into the net");
    }
    // A ball rolling around after the point should come to rest.
    if (this.dead && this.pos.y <= R + 0.001 && Math.abs(this.vel.y) < 0.5) {
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 3));
      this.vel.y = 0;
    }

    if (s.phase !== "rally") return;

    // You run to where the ball will come up, and stay with it if you are late. So do they.
    const meet = (plan: Plan) => (this.now > plan.tIdeal ? this.pos : plan.ideal);
    if (this.lastHit === "them" && this.planYou) {
      const m = meet(this.planYou);
      this.run(this.you, m.x - 0.32, Math.min(HALF_L + 2.8, Math.max(0.7, m.z + 0.18)), 5, dt);
    } else this.run(this.you, 0, 4.9, 4.2, dt);

    if (this.lastHit === "you" && this.planThem) {
      const plan = this.planThem;
      const m = meet(plan);
      // It takes them a moment to read the shot.
      if (this.now >= this.themSeesAt) this.run(this.them, m.x + 0.32, Math.max(-HALF_L - 2.8, Math.min(-0.7, m.z - 0.18)), level.speed, dt);
      const near = Math.hypot(this.pos.x - this.them.x, this.pos.z - this.them.z) < THEIR_REACH;
      if (this.bounces === 1 && near && this.now >= this.themHitAt && this.pos.y > 0.15) {
        // They aim away from you, mostly deep, sometimes short. The further they had to run, and the
        // later they got there, the worse it gets. Now and then they just miss.
        const stretch = Math.max(0, this.themRun - 2.2) * 0.4 + Math.max(0, this.now - this.themHitAt) * 1.5;
        // Long rallies wear on them: past the sixth shot their aim loosens a little with every ball.
        const tired = 1 + Math.max(0, s.rally - 6) * 0.07;
        const away = this.you.x > 0 ? -1 : 1;
        const tx = (Math.random() < 0.75 ? away : -away) * (0.6 + Math.random() * 1.9);
        const tz = Math.random() < level.dink ? 0.7 + Math.random() * 1.1 : 3.4 + Math.random() * 2.6;
        const miss = Math.random() < level.miss ? 2.6 : 0;
        this.them.swing = 1;
        this.hit("them", tx, tz, level.error * (0.45 + Math.random() * 0.75) * tired + stretch + miss, false);
      }
    } else {
      this.run(this.them, 0, -4.9, level.speed * 0.85, dt);
    }
  }

  /** Put everything where the state says it is. */
  private draw(dt: number) {
    const s = this.state;
    this.ball.position.copy(this.pos);
    this.ballShadow.position.set(this.pos.x, 0.012, this.pos.z);
    const lift = Math.min(1, this.pos.y / 3);
    this.ballShadow.scale.setScalar(1 + lift * 1.4);
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.45 - lift * 0.25;

    this.trailPos.pop();
    this.trailPos.unshift(this.pos.clone());
    const moving = s.phase === "rally" || s.phase === "point";
    for (let i = 0; i < TRAIL; i++) {
      this.dummy.position.copy(this.trailPos[i]);
      this.dummy.scale.setScalar(moving ? 1 - i / TRAIL : 0);
      this.dummy.updateMatrix();
      this.trail.setMatrixAt(i, this.dummy.matrix);
    }
    this.trail.instanceMatrix.needsUpdate = true;

    for (const p of [this.you, this.them]) {
      p.group.position.set(p.x, Math.abs(Math.sin(p.step)) * 0.05, p.z);
      p.shadow.position.set(p.x, 0.011, p.z);
      p.swing = Math.max(0, p.swing - dt * 4.2);
      // Wind back, then through.
      p.arm.rotation.y = 0.9 - Math.sin((1 - p.swing) * Math.PI) * (p.swing > 0 ? 2.3 : 0);
      const l = p.group.getObjectByName("legL");
      const r = p.group.getObjectByName("legR");
      if (l && r) {
        l.rotation.x = Math.sin(p.step) * 0.6;
        r.rotation.x = -Math.sin(p.step) * 0.6;
      }
    }

    // Where you are aiming, shown whenever the next shot is yours.
    const yours = (s.phase === "serve" && s.server === "you") || (s.phase === "rally" && this.lastHit === "them" && !!this.planYou);
    this.reticle.visible = yours;
    this.reticle.position.set(this.aim.x, 0.02, this.aim.z);

    // The timing cue: a ring closes on the spot where the ball will come up.
    const plan = s.phase === "rally" && this.lastHit === "them" ? this.planYou : null;
    this.spot.visible = this.closing.visible = !!plan && this.now < plan.tEnd;
    if (plan) {
      const until = plan.tIdeal - this.now;
      this.spot.position.set(plan.ideal.x, 0.02, plan.ideal.z);
      this.closing.position.copy(this.spot.position);
      this.closing.scale.setScalar(1 + Math.max(0, until) * 2.4);
      (this.closing.material as THREE.MeshBasicMaterial).color.set(Math.abs(until) < 0.12 ? MUSTARD : NAVY);
    }

    if (this.popLife > 0) {
      this.popLife = Math.max(0, this.popLife - dt * 4.5);
      this.pop.scale.setScalar(0.5 + (1 - this.popLife) * 1.1);
      this.pop.material.opacity = Math.min(1, this.popLife * 2.4);
      this.pop.material.rotation = (1 - this.popLife) * 0.5;
    }

    // The camera leans a little with you.
    const cx = this.you.x * 0.16;
    this.camera.position.x += (cx - this.camera.position.x) * Math.min(1, dt * 3);
    this.look.x = this.camera.position.x * 0.5;
    this.camera.lookAt(this.look);
  }

  private push() {
    this.onState({ ...this.state });
  }
}
