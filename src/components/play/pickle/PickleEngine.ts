import * as THREE from "three";
import { sound } from "@/components/play/sound";

/**
 * Dink: singles pickleball against the computer, on a real-size court.
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

const CREAM = 0xfff1e0;
const CORAL = 0xff4d5e;
const BALL = 0xe9ff5c;

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
  private ring: THREE.Mesh;
  private ringLife = 0;
  private you: Player;
  private them: Player;
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

    // Dusk over the court: plum overhead, coral at the horizon.
    this.scene.background = canvasTexture(8, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#2a1038");
      g.addColorStop(0.3, "#6a2350");
      g.addColorStop(0.52, "#ff7c6b");
      g.addColorStop(0.62, "#ffc58f");
      g.addColorStop(1, "#ffc58f");
      c.fillStyle = g;
      c.fillRect(0, 0, 8, 256);
    });
    this.scene.fog = new THREE.Fog(0xe07a66, 60, 190);
    this.scene.add(this.camera);

    this.buildCourt();
    this.you = this.buildPlayer(CREAM, 1);
    this.them = this.buildPlayer(CORAL, -1);

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), new THREE.MeshStandardMaterial({ color: BALL, emissive: 0x8a9a10, emissiveIntensity: 0.6, roughness: 0.5 }));
    this.scene.add(this.ball);
    this.ballShadow = this.disc(0.13, 0x05070a, 0.5);
    this.trail = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: BALL, transparent: true, opacity: 0.35, depthWrite: false }), TRAIL);
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);
    for (let i = 0; i < TRAIL; i++) this.trailPos.push(this.pos.clone());

    const ringGeo = new THREE.RingGeometry(0.34, 0.42, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const flat = (color: number, opacity: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.reticle = new THREE.Mesh(ringGeo, flat(0xffffff, 0.9));
    this.spot = new THREE.Mesh(ringGeo, flat(0xffffff, 0.55));
    this.closing = new THREE.Mesh(ringGeo, flat(BALL, 0.9));
    this.ring = new THREE.Mesh(ringGeo, flat(0xffffff, 0));
    for (const m of [this.reticle, this.spot, this.closing, this.ring]) {
      m.position.y = 0.02;
      m.visible = false;
      this.scene.add(m);
    }

    this.place();
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- scene ---------- */

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
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      return mesh;
    };
    slab(600, 600, 0x35203c, 0); // the ground out to the horizon
    slab(HALF_W * 2 + 7, HALF_L * 2 + 9, 0x1c2540, 0.002); // the pad around the court
    slab(HALF_W * 2, HALF_L * 2, 0x1f7a8c, 0.004); // the court
    slab(HALF_W * 2, KITCHEN * 2, 0xe2685a, 0.006); // the kitchen, both sides of the net

    const line = new THREE.MeshBasicMaterial({ color: 0xfff6ea });
    const stripe = (w: number, d: number, x: number, z: number) => {
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, line);
      mesh.position.set(x, 0.009, z);
      this.scene.add(mesh);
    };
    const T = 0.05;
    for (const s of [-1, 1]) {
      stripe(HALF_W * 2 + T, T, 0, s * HALF_L); // baseline
      stripe(T, HALF_L * 2, s * HALF_W, 0); // sideline
      stripe(HALF_W * 2, T, 0, s * KITCHEN); // kitchen line
      stripe(T, HALF_L - KITCHEN, 0, s * (KITCHEN + (HALF_L - KITCHEN) / 2)); // centre line
    }

    const mesh = canvasTexture(256, 64, (c) => {
      c.clearRect(0, 0, 256, 64);
      c.fillStyle = "rgba(20,10,24,0.38)";
      c.fillRect(0, 0, 256, 64);
      c.strokeStyle = "rgba(255,246,234,0.5)";
      c.lineWidth = 1;
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
    const net = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2 + 0.6, NET), new THREE.MeshBasicMaterial({ map: mesh, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(0, NET / 2, 0);
    this.scene.add(net);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 2 + 0.6, 0.05, 0.03), line);
    tape.position.set(0, NET, 0);
    this.scene.add(tape);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2a1a30, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, NET + 0.06, 10), postMat);
      post.position.set(s * (HALF_W + 0.3), (NET + 0.06) / 2, 0);
      this.scene.add(post);
    }

    // A low fence and a row of palms behind the far baseline, as silhouettes against the sky.
    const dark = new THREE.MeshBasicMaterial({ color: 0x24122c, fog: false });
    const fence = new THREE.Mesh(new THREE.BoxGeometry(60, 1.6, 0.2), dark);
    fence.position.set(0, 0.8, -15);
    this.scene.add(fence);
    for (const [x, h, lean] of [
      [-13, 8.5, 0.06],
      [-7.5, 10.5, -0.04],
      [-2, 7.8, 0.03],
      [5.5, 9.8, -0.05],
      [11, 8.2, 0.07],
      [17, 10.8, -0.02],
    ]) {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, h, 6), dark);
      trunk.position.y = h / 2;
      palm.add(trunk);
      for (let i = 0; i < 9; i++) {
        const frond = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.42), dark);
        const hold = new THREE.Group();
        frond.position.x = 1.25;
        hold.add(frond);
        hold.position.y = h;
        hold.rotation.set(0, (i / 9) * Math.PI * 2, -0.35 - (i % 3) * 0.22);
        palm.add(hold);
      }
      palm.position.set(x, 0, -19 - Math.abs(x) * 0.25);
      palm.rotation.z = lean;
      this.scene.add(palm);
    }
    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: canvasTexture(128, 128, (c) => {
          const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
          g.addColorStop(0, "rgba(255,244,214,1)");
          g.addColorStop(0.25, "rgba(255,214,150,0.85)");
          g.addColorStop(1, "rgba(255,160,110,0)");
          c.fillStyle = g;
          c.fillRect(0, 0, 128, 128);
        }),
        fog: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    sun.position.set(-9, 5.5, -120);
    sun.scale.setScalar(46);
    this.scene.add(sun);

    this.scene.add(new THREE.HemisphereLight(0xffd9c4, 0x3a2a48, 1.9));
    const low = new THREE.DirectionalLight(0xffc089, 1.8);
    low.position.set(-6, 5, -12);
    this.scene.add(low);
  }

  /** A figure made of simple solids: body, head, and a paddle on an arm that swings. */
  private buildPlayer(color: number, facing: 1 | -1): Player {
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe2ab80, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a30, roughness: 0.7 });
    const other = new THREE.MeshStandardMaterial({ color: facing === 1 ? CORAL : CREAM, roughness: 0.45 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), shirt);
    body.position.y = 1.06;
    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.2, 14), dark);
    hips.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin);
    head.position.y = 1.64;
    // A visor, so you can tell which way a figure is facing from across the court.
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16, 1, false, -Math.PI / 2, Math.PI), other);
    visor.position.set(0, 1.7, -0.02);
    visor.rotation.y = Math.PI / 2;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.14), other);
    brim.position.set(0, 1.69, -0.2);
    group.add(body, hips, head, visor, brim);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.44, 4, 8), skin);
      leg.geometry.translate(0, -0.26, 0);
      leg.position.set(s * 0.1, 0.62, 0);
      leg.name = s < 0 ? "legL" : "legR";
      group.add(leg);
    }
    const arm = new THREE.Group();
    arm.position.set(0.24, 1.24, 0);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), skin);
    fore.rotation.x = Math.PI / 2;
    fore.position.z = -0.24;
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.28), other);
    paddle.position.z = -0.6;
    paddle.rotation.z = Math.PI / 2;
    arm.add(fore, paddle);
    group.add(arm);
    group.rotation.y = facing === 1 ? 0 : Math.PI;
    this.scene.add(group);
    return { group, arm, shadow: this.disc(0.34, 0x05070a, 0.38), x: 0, z: facing * 5, swing: 0, step: 0 };
  }

  /* ---------- public ---------- */

  setOptions(o: PickleOptions) {
    this.options = o;
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
    this.ringLife = 1;
    this.ring.position.set(from.x, 0.02, from.z);
    this.ring.scale.setScalar(0.5);
    this.ring.visible = true;
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
    (this.ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.5 - lift * 0.3;

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
      (this.closing.material as THREE.MeshBasicMaterial).color.set(Math.abs(until) < 0.12 ? 0x8fe3c0 : BALL);
    }

    if (this.ringLife > 0) {
      this.ringLife -= dt * 3.2;
      this.ring.scale.multiplyScalar(1 + dt * 5);
      (this.ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, this.ringLife) * 0.8;
      if (this.ringLife <= 0) this.ring.visible = false;
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
