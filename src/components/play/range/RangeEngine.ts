import * as THREE from "three";
import { sound } from "@/components/play/sound";

export type Drill = "pop" | "pin" | "ride" | "peek";

export type RangeStats = {
  score: number;
  shots: number;
  hits: number;
  streak: number;
  bestStreak: number;
  /** Seconds left in the round. */
  left: number;
  /** Mean milliseconds between hits, 0 until there are two. */
  pace: number;
};

export type RangeOptions = {
  drill: Drill;
  /** Degrees the view turns per mouse count: game yaw times sensitivity. */
  degPerCount: number;
  /** Horizontal field of view at 16:9, the way shooters state it. */
  hfov: number;
  duration: number;
};

type Target = {
  mesh: THREE.Mesh;
  /** The rod it sits on. */
  stand: THREE.Mesh;
  radius: number;
  born: number;
  alive: boolean;
  /** ride: sideways speed and when it next changes its mind. */
  vx: number;
  turnAt: number;
  /** peek: which pillar, which side, and when it ducks back. */
  pillar: number;
  side: number;
  until: number;
};

const DEG = Math.PI / 180;
const ROOM = { width: 26, height: 7.5, back: -30, front: 5 };
const WALL_HALF = 5.6;
const PILLARS = [-6.4, -3.2, 0, 3.2, 6.4];
const PILLAR_HALF = 0.62;
const PARTICLES = 200;
/** Where the rifle rests in the view, in camera space. */
const GUN = { x: 0.2, y: -0.2, z: -0.2, turn: 0.055 };
/** Clay-pigeon orange, and the pale dust a miss kicks up. */
const CLAY = 0xf26b21;
const DUST = 0xe6d5b0;

const DRILLS: Record<Drill, { distance: number; radius: number; count: number }> = {
  pop: { distance: 14, radius: 0.56, count: 3 },
  pin: { distance: 20, radius: 0.25, count: 1 },
  ride: { distance: 12, radius: 0.52, count: 1 },
  peek: { distance: 16.4, radius: 0.5, count: 1 },
};

function canvasTexture(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext("2d");
  if (c) draw(c, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * The firing range: a three.js scene, four drills and the rules for scoring
 * them. It knows nothing about React; the component feeds it mouse movement
 * and clicks and reads stats back.
 */
export class RangeEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 120);
  private gun = new THREE.Group();
  private flash: THREE.Sprite;
  private flashLight = new THREE.PointLight(0xffd9a3, 0, 9);
  private tint = new THREE.Color();
  private shots: { x: number; y: number }[] = [];
  private targets: Target[] = [];
  private pillars: THREE.Mesh[] = [];
  private sparks: THREE.InstancedMesh;
  private sparkData = new Float32Array(PARTICLES * 7); // x y z vx vy vz life
  private sparkNext = 0;
  private rings: { mesh: THREE.Mesh; life: number }[] = [];
  private tracers: { mesh: THREE.Mesh; life: number }[] = [];
  private dummy = new THREE.Object3D();
  private raf = 0;
  private last = 0;
  private clock = 0;
  private yaw = 0;
  private pitch = 0;
  private kick = 0;
  private swayX = 0;
  private swayY = 0;
  private holding = false;
  private beamAt = 0;
  private nextPeek = 0;
  private lastHitAt = 0;
  private gaps: number[] = [];
  private statsAt = 0;
  private running = false;
  private paused = false;
  private options: RangeOptions = { drill: "pop", degPerCount: 0.035, hfov: 103, duration: 30 };
  private stats: RangeStats = { score: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0, left: 30, pace: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private onStats: (s: RangeStats) => void,
    private onEnd: (s: RangeStats) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    // A clear desert noon: blue overhead, haze at the horizon.
    const sky = document.createElement("canvas");
    sky.width = 4;
    sky.height = 256;
    const sc = sky.getContext("2d");
    if (sc) {
      const g = sc.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#7fb4de");
      g.addColorStop(0.42, "#bcd9ec");
      g.addColorStop(0.56, "#efe3c8");
      g.addColorStop(1, "#efe3c8");
      sc.fillStyle = g;
      sc.fillRect(0, 0, 4, 256);
    }
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(0xe9dcc0, 60, 300);
    this.camera.position.set(0, 1.62, 0);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.buildRange();
    this.buildGun();

    const glow = canvasTexture(128, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,244,214,0.95)");
      g.addColorStop(0.35, "rgba(255,190,110,0.4)");
      g.addColorStop(1, "rgba(255,190,110,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    // The targets are clays: orange discs, face on, that break when you hit them.
    const face = canvasTexture(256, (c, s) => {
      const m = s / 2;
      c.fillStyle = "#f26b21";
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "#fff4e2";
      c.lineWidth = 14;
      c.beginPath();
      c.arc(m, m, m - 9, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = "#c9500f";
      c.lineWidth = 7;
      for (const r of [0.66, 0.42]) {
        c.beginPath();
        c.arc(m, m, m * r, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = "#1c1a17";
      c.beginPath();
      c.arc(m, m, m * 0.12, 0, Math.PI * 2);
      c.fill();
    });
    const disc = new THREE.CylinderGeometry(1, 1, 0.14, 40);
    disc.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9500f, roughness: 0.6 });
    const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.55, emissive: 0xf26b21, emissiveIntensity: 0.18 });
    const rod = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
    rod.translate(0, 0.5, 0);
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.6, metalness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(disc, [rimMat, faceMat, faceMat]);
      const stand = new THREE.Mesh(rod, rodMat);
      mesh.visible = false;
      stand.visible = false;
      this.scene.add(mesh, stand);
      this.targets.push({ mesh, stand, radius: 0.5, born: 0, alive: false, vx: 0, turnAt: 0, pillar: 0, side: 1, until: 0 });
    }

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    this.flash.scale.setScalar(0.42);
    this.flash.position.set(0, 0.012, -0.88);
    this.gun.add(this.flash);
    this.flashLight.position.set(0.25, -0.1, -1);
    this.camera.add(this.flashLight);

    // Shards of clay and puffs of dust share one pool; each piece carries its own colour.
    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.035), new THREE.MeshBasicMaterial(), PARTICLES);
    this.sparks.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < PARTICLES; i++) {
      this.sparks.setMatrixAt(i, this.dummy.matrix);
      this.sparks.setColorAt(i, this.tint.set(CLAY));
    }
    this.scene.add(this.sparks);

    const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xfff4e2, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.rings.push({ mesh, life: 0 });
    }
    const beam = new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true);
    beam.rotateX(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(beam, new THREE.MeshBasicMaterial({ color: 0xfff4e2, transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }

    this.setOptions(this.options);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- scene ---------- */

  private buildRange() {
    // Sand, out to the hills.
    const sand = canvasTexture(512, (c, s) => {
      c.fillStyle = "#d8c398";
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 5200; i++) {
        c.fillStyle = Math.random() < 0.5 ? "rgba(120,96,60,0.16)" : "rgba(255,244,214,0.2)";
        c.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.4, 1 + Math.random() * 1.6);
      }
    });
    sand.wrapS = sand.wrapT = THREE.RepeatWrapping;
    sand.repeat.set(70, 70);
    sand.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // The backstop: a wall of bulldozed dirt, with a ragged top.
    const dirt = (seed: number) =>
      canvasTexture(1024, (c, s) => {
        c.clearRect(0, 0, s, s);
        c.beginPath();
        c.moveTo(0, s);
        for (let x = 0; x <= s; x += 16) c.lineTo(x, s * 0.2 + Math.sin(x * 0.011 + seed) * 26 + Math.sin(x * 0.043 + seed * 3) * 12 + Math.sin(x * 0.13) * 5);
        c.lineTo(s, s);
        c.closePath();
        const g = c.createLinearGradient(0, s * 0.15, 0, s);
        g.addColorStop(0, "#947553");
        g.addColorStop(0.5, "#7d6245");
        g.addColorStop(1, "#6c543b");
        c.fillStyle = g;
        c.fill();
        c.globalCompositeOperation = "source-atop";
        for (let i = 0; i < 1400; i++) {
          c.fillStyle = Math.random() < 0.6 ? "rgba(60,44,28,0.22)" : "rgba(214,186,140,0.2)";
          c.fillRect(Math.random() * s, s * 0.15 + Math.random() * s * 0.85, 2 + Math.random() * 9, 1 + Math.random() * 3);
        }
        // Scars from rain running down the face.
        c.strokeStyle = "rgba(60,44,28,0.2)";
        c.lineWidth = 3;
        for (let i = 0; i < 26; i++) {
          const x = Math.random() * s;
          c.beginPath();
          c.moveTo(x, s * 0.24);
          c.quadraticCurveTo(x + (Math.random() - 0.5) * 30, s * 0.6, x + (Math.random() - 0.5) * 50, s);
          c.stroke();
        }
      });
    const bank = (w: number, h: number, seed: number) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: dirt(seed), roughness: 1, transparent: true, alphaTest: 0.5 }));
    const berm = bank(86, 14, 1);
    berm.position.set(0, 6.4, ROOM.back - 0.6);
    this.scene.add(berm);
    for (const side of [-1, 1]) {
      const wing = bank(44, 7.5, 2 + side);
      wing.rotation.y = (-side * Math.PI) / 2;
      wing.position.set(side * 15, 3.3, -12);
      this.scene.add(wing);
    }

    // Far off: dry hills, then mountains gone blue with distance.
    const ridge = (color: string, rough: number, seed: number) =>
      canvasTexture(1024, (c, s) => {
        c.clearRect(0, 0, s, s);
        c.beginPath();
        c.moveTo(0, s);
        for (let x = 0; x <= s; x += 8) c.lineTo(x, s * 0.5 + Math.sin(x * 0.006 + seed) * s * 0.16 + Math.sin(x * 0.021 + seed * 2) * s * 0.08 * rough + Math.sin(x * 0.07 + seed) * s * 0.02 * rough);
        c.lineTo(s, s);
        c.closePath();
        c.fillStyle = color;
        c.fill();
      });
    const far = (tex: THREE.Texture, w: number, h: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, fog: false }));
      m.position.set(0, y, z);
      this.scene.add(m);
    };
    far(ridge("#9fb2c6", 1.4, 0.7), 900, 150, 34, -420);
    far(ridge("#c3ab8c", 0.8, 2.6), 700, 70, 10, -260);

    // Chalk lines every five metres, and posts down both sides.
    const chalk = new THREE.MeshBasicMaterial({ color: 0xfbf6ea, transparent: true, opacity: 0.6 });
    const post = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.9 });
    const cap = new THREE.MeshStandardMaterial({ color: CLAY, roughness: 0.6 });
    for (let d = 5; d <= 25; d += 5) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(22, 0.09), chalk);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.012, -d);
      this.scene.add(line);
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), post);
        p.position.set(side * 11.4, 0.55, -d);
        const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), cap);
        top.position.y = 0.6;
        p.add(top);
        this.scene.add(p);
      }
    }

    // The firing line: a plank table.
    const wood = new THREE.MeshStandardMaterial({ color: 0xb48a58, roughness: 0.85 });
    const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.75), wood);
    bench.position.set(0, 0.98, -1.25);
    this.scene.add(bench);
    for (const x of [-4.2, 4.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.98, 0.6), wood);
      leg.position.set(x, 0.49, -1.25);
      this.scene.add(leg);
    }

    // Cover for the peek drill: sheets of plywood, braced.
    const ply = canvasTexture(256, (c, s) => {
      c.fillStyle = "#c9a36a";
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "rgba(120,84,40,0.25)";
      for (let i = 0; i < 40; i++) {
        c.lineWidth = 1 + Math.random() * 2;
        c.beginPath();
        c.moveTo(Math.random() * s, 0);
        c.lineTo(Math.random() * s, s);
        c.stroke();
      }
      c.strokeStyle = "#8b6a3e";
      c.lineWidth = 14;
      c.strokeRect(7, 7, s - 14, s - 14);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(s, s);
      c.moveTo(s, 0);
      c.lineTo(0, s);
      c.stroke();
    });
    const plyMat = new THREE.MeshStandardMaterial({ map: ply, roughness: 0.9 });
    for (const x of PILLARS) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(PILLAR_HALF * 2, 4.6, 0.14), plyMat);
      p.position.set(x, 2.3, -15.8);
      p.visible = false;
      this.scene.add(p);
      this.pillars.push(p);
    }

    this.scene.add(new THREE.HemisphereLight(0xd6e9ff, 0xcdb48a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.6);
    sun.position.set(9, 15, 7);
    this.scene.add(sun);
  }

  private buildGun() {
    // No shiny metal: with nothing to reflect it would just read as a black cut-out.
    const steel = new THREE.MeshStandardMaterial({ color: 0x4b4d54, roughness: 0.6, metalness: 0.1 });
    const body = new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.75 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x2a2b2f, roughness: 0.9 });
    const accent = new THREE.MeshBasicMaterial({ color: CLAY });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, tilt = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.rotation.x = tilt;
      this.gun.add(mesh);
      return mesh;
    };
    const tube = (r: number, len: number, y: number, z: number, m: THREE.Material) => {
      const geo = new THREE.CylinderGeometry(r, r, len, 14);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(0, y, z);
      this.gun.add(mesh);
    };
    box(0.058, 0.08, 0.34, 0, 0, -0.22, steel); // receiver
    box(0.048, 0.026, 0.34, 0, 0.05, -0.22, steel); // top cover
    box(0.052, 0.06, 0.27, 0, 0.008, -0.52, body); // handguard
    tube(0.012, 0.18, 0.012, -0.73, steel); // barrel
    tube(0.019, 0.07, 0.012, -0.83, steel); // muzzle
    box(0.024, 0.01, 0.52, 0, 0.068, -0.37, rubber); // rail
    box(0.03, 0.026, 0.014, 0, 0.084, -0.11, rubber); // rear sight
    box(0.007, 0.03, 0.012, 0, 0.086, -0.63, rubber); // front post
    box(0.007, 0.007, 0.012, 0, 0.104, -0.63, accent);
    box(0.022, 0.012, 0.05, 0, 0.078, -0.3, steel); // optic base
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.023, 0.0045, 8, 28), steel);
    ring.position.set(0, 0.108, -0.3);
    this.gun.add(ring);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 8, 6), accent);
    dot.position.set(0, 0.108, -0.3);
    this.gun.add(dot);
    box(0.038, 0.15, 0.066, 0, -0.105, -0.31, rubber, 0.16); // magazine
    box(0.04, 0.12, 0.052, 0, -0.09, -0.1, body, -0.32); // grip
    box(0.044, 0.07, 0.22, 0, -0.012, 0.05, body); // stock
    this.gun.position.set(GUN.x, GUN.y, GUN.z);
    this.camera.add(this.gun);
    // Light bounced up off the sand, so the underside of the rifle is not lost.
    const bounce = new THREE.PointLight(0xffe9c4, 0.9, 2.2, 1.2);
    bounce.position.set(-0.2, -0.25, -0.3);
    this.camera.add(bounce);
  }

  /* ---------- public ---------- */

  setOptions(o: RangeOptions) {
    this.options = o;
    // Shooters quote horizontal field of view at 16:9; the camera wants vertical.
    this.camera.fov = (2 * Math.atan(Math.tan((o.hfov * DEG) / 2) / (16 / 9))) / DEG;
    this.camera.updateProjectionMatrix();
    for (const p of this.pillars) p.visible = o.drill === "peek";
    if (!this.running) this.layout();
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.stats = { score: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0, left: this.options.duration, pace: 0 };
    this.gaps = [];
    this.shots = [];
    this.lastHitAt = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.running = true;
    this.paused = false;
    this.holding = false;
    this.nextPeek = this.clock + 0.7;
    this.layout();
    this.onStats({ ...this.stats });
  }

  setPaused(value: boolean) {
    this.paused = value;
    if (value) this.holding = false;
    this.last = performance.now();
  }

  stop() {
    this.running = false;
    this.holding = false;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }

  /**
   * Where each hit landed on its target, as a fraction of the target's radius: x to the right, y up.
   * The results screen plots these on one paper target, which shows which way you tend to miss.
   */
  holes() {
    return this.shots.slice();
  }

  /** Mouse movement, in counts. */
  look(dx: number, dy: number) {
    if (!this.running || this.paused) return;
    const k = this.options.degPerCount * DEG;
    this.yaw -= dx * k;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * k));
    this.swayX += dx * 0.00035;
    this.swayY += dy * 0.00035;
  }

  /**
   * Trigger down or up. With `at` (screen position, -1..1) the shot goes
   * through that point instead of the middle of the view, which is how the
   * range is played without pointer lock and on touch screens.
   */
  fire(down: boolean, at?: { x: number; y: number }) {
    if (!this.running || this.paused) return;
    if (!down) {
      this.holding = false;
      return;
    }
    if (this.options.drill === "ride") {
      this.holding = true;
      this.aimAt = at ?? null;
      return;
    }
    this.shoot(at);
  }

  /** Where the live targets are on screen, in css px. Used by the automated check. */
  debugTargets() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    return this.targets
      .filter((t) => t.alive && this.exposed(t))
      .map((t) => {
        v.copy(t.mesh.position).project(this.camera);
        return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
      });
  }

  /* ---------- drills ---------- */

  private aimAt: { x: number; y: number } | null = null;

  private layout() {
    for (const t of this.targets) this.hide(t);
    const d = DRILLS[this.options.drill];
    if (this.options.drill === "peek") return;
    for (let i = 0; i < d.count; i++) this.spawn(this.targets[i]);
  }

  private hide(t: Target) {
    t.alive = false;
    t.mesh.visible = false;
    t.stand.visible = false;
  }

  private spawn(t: Target, pillar = -1) {
    const d = DRILLS[this.options.drill];
    t.radius = d.radius;
    t.born = this.clock;
    t.alive = true;
    t.mesh.visible = true;
    t.stand.visible = true;
    if (this.options.drill === "peek") {
      t.pillar = pillar;
      t.side = Math.random() < 0.5 ? -1 : 1;
      t.until = this.clock + 1.05;
      t.mesh.position.set(PILLARS[pillar], 1.3 + Math.random() * 1.5, -d.distance);
      return;
    }
    // Keep new targets clear of the ones already up, so two never overlap.
    for (let tries = 0; tries < 24; tries++) {
      const x = (Math.random() * 2 - 1) * (this.options.drill === "ride" ? 2 : WALL_HALF);
      const y = 1.05 + Math.random() * 2.7;
      const clear = this.targets.every((o) => o === t || !o.alive || Math.hypot(o.mesh.position.x - x, o.mesh.position.y - y) > d.radius * 3.2);
      t.mesh.position.set(x, y, -d.distance);
      if (clear) break;
    }
    if (this.options.drill === "ride") {
      t.vx = (Math.random() < 0.5 ? -1 : 1) * 3.6;
      t.turnAt = this.clock + 0.6 + Math.random() * 0.8;
    }
  }

  /** Peek targets can only be hit once they have cleared their pillar. */
  private exposed(t: Target) {
    if (this.options.drill !== "peek") return true;
    return Math.abs(t.mesh.position.x - PILLARS[t.pillar]) > PILLAR_HALF + t.radius * 0.35;
  }

  private ray(at?: { x: number; y: number } | null) {
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = at
      ? new THREE.Vector3(at.x, at.y, 0.5).unproject(this.camera).sub(origin).normalize()
      : this.camera.getWorldDirection(new THREE.Vector3());
    return { origin, dir };
  }

  /** Nearest live target the ray passes through, with the distance to it. */
  private note(target: Target, origin: THREE.Vector3, dir: THREE.Vector3) {
    if (this.shots.length >= 260) return;
    const off = origin.clone().addScaledVector(dir, target.mesh.position.clone().sub(origin).dot(dir)).sub(target.mesh.position);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.shots.push({ x: off.dot(right) / target.radius, y: off.dot(up) / target.radius });
  }

  private trace(origin: THREE.Vector3, dir: THREE.Vector3) {
    let best: Target | null = null;
    let bestT = Infinity;
    const oc = new THREE.Vector3();
    for (const t of this.targets) {
      if (!t.alive || !this.exposed(t)) continue;
      oc.copy(t.mesh.position).sub(origin);
      const along = oc.dot(dir);
      if (along <= 0) continue;
      const miss2 = oc.lengthSq() - along * along;
      const r2 = t.radius * t.radius;
      if (miss2 > r2) continue;
      const hitT = along - Math.sqrt(r2 - miss2);
      if (hitT < bestT) {
        bestT = hitT;
        best = t;
      }
    }
    return { target: best, distance: bestT };
  }

  private shoot(at?: { x: number; y: number } | null) {
    const { origin, dir } = this.ray(at);
    const { target, distance } = this.trace(origin, dir);
    this.stats.shots++;
    this.kick = 1;
    (this.flash.material as THREE.SpriteMaterial).opacity = 1;
    this.flashLight.intensity = 5;
    sound.shot();

    // Where the round lands if it hits nothing: the back wall or the floor.
    let reach = distance;
    if (!target) {
      const toWall = dir.z < 0 ? (ROOM.back - origin.z) / dir.z : Infinity;
      const toFloor = dir.y < 0 ? -origin.y / dir.y : Infinity;
      reach = Math.min(toWall, toFloor, 60);
    }
    const end = origin.clone().addScaledVector(dir, reach);
    this.tracer(end);

    if (!target) {
      this.stats.streak = 0;
      this.burst(end, 7, 1.9, DUST);
      this.push();
      return;
    }
    this.note(target, origin, dir);

    const now = this.clock;
    if (this.lastHitAt) this.gaps.push(now - this.lastHitAt);
    this.lastHitAt = now;
    this.stats.hits++;
    this.stats.streak++;
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
    let points = 100 + Math.min(50, (this.stats.streak - 1) * 5);
    if (this.options.drill === "peek") points = Math.round(Math.max(60, 190 - (now - target.born) * 130));
    this.stats.score += points;
    this.stats.pace = this.gaps.length ? Math.round((this.gaps.reduce((a, b) => a + b, 0) / this.gaps.length) * 1000) : 0;

    this.burst(target.mesh.position, 20, 4.8, CLAY);
    this.ring(target.mesh.position, target.radius);
    sound.pop();

    if (this.options.drill === "peek") {
      this.hide(target);
      this.nextPeek = now + 0.3 + Math.random() * 0.45;
    } else {
      this.spawn(target);
    }
    this.push();
  }

  /** Tracking: while the trigger is held, the beam ticks ten times a second. */
  private beam() {
    const { origin, dir } = this.ray(this.aimAt);
    const { target, distance } = this.trace(origin, dir);
    this.stats.shots++;
    this.kick = Math.max(this.kick, 0.35);
    (this.flash.material as THREE.SpriteMaterial).opacity = 0.7;
    const end = origin.clone().addScaledVector(dir, target ? distance : 40);
    this.tracer(end);
    if (target) {
      this.stats.hits++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
      this.stats.score += 10;
      this.note(target, origin, dir);
      this.burst(end, 2, 1.8, CLAY);
      sound.hit();
    } else {
      this.stats.streak = 0;
    }
    this.push();
  }

  /* ---------- effects ---------- */

  private burst(at: THREE.Vector3, count: number, speed: number, color: number) {
    this.tint.set(color);
    for (let i = 0; i < count; i++) {
      const slot = this.sparkNext++ % PARTICLES;
      this.sparks.setColorAt(slot, this.tint);
      const o = slot * 7;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2 - 0.6;
      this.sparkData[o] = at.x;
      this.sparkData[o + 1] = at.y;
      this.sparkData[o + 2] = at.z;
      this.sparkData[o + 3] = Math.cos(a) * speed * (0.4 + Math.random());
      this.sparkData[o + 4] = up * speed;
      this.sparkData[o + 5] = (Math.random() * 0.8 + 0.2) * speed;
      this.sparkData[o + 6] = 0.5 + Math.random() * 0.25;
    }
    if (this.sparks.instanceColor) this.sparks.instanceColor.needsUpdate = true;
  }

  private ring(at: THREE.Vector3, radius: number) {
    const r = this.rings.reduce((a, b) => (a.life <= b.life ? a : b));
    r.life = 1;
    r.mesh.visible = true;
    r.mesh.position.copy(at);
    r.mesh.scale.setScalar(radius);
    r.mesh.lookAt(this.camera.position);
  }

  private tracer(end: THREE.Vector3) {
    const t = this.tracers.reduce((a, b) => (a.life <= b.life ? a : b));
    const muzzle = this.flash.getWorldPosition(new THREE.Vector3());
    t.life = 1;
    t.mesh.visible = true;
    t.mesh.position.copy(muzzle).lerp(end, 0.5);
    t.mesh.scale.set(1, 1, muzzle.distanceTo(end));
    t.mesh.lookAt(end);
  }

  private push() {
    this.onStats({ ...this.stats });
  }

  /* ---------- loop ---------- */

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    // The round clock is real time, so a slow machine still gets a 30 second round. The cap only
    // swallows the gap after the tab was hidden.
    const dt = Math.min(0.25, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) this.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.clock += dt;
    const o = this.options;

    if (this.running) {
      this.stats.left -= dt;
      if (this.stats.left <= 0) {
        this.stats.left = 0;
        this.running = false;
        this.holding = false;
        sound.end();
        this.push();
        this.onEnd({ ...this.stats });
      } else if (this.clock - this.statsAt > 0.1) {
        this.statsAt = this.clock;
        this.push();
      }
    } else {
      // Before a round the view drifts a little, so the room is not a still.
      this.yaw = Math.sin(this.clock * 0.35) * 0.05;
      this.pitch = Math.sin(this.clock * 0.27) * 0.015;
    }

    if (this.running && o.drill === "ride" && this.holding && this.clock - this.beamAt >= 0.1) {
      this.beamAt = this.clock;
      this.beam();
    }

    if (o.drill === "peek" && this.running) {
      const t = this.targets[0];
      if (t.alive) {
        // Lean out, hold, duck back.
        const age = this.clock - t.born;
        const left = t.until - this.clock;
        const out = Math.min(1, age / 0.16, Math.max(0, left) / 0.16);
        t.mesh.position.x = PILLARS[t.pillar] + t.side * (PILLAR_HALF + t.radius * 1.15) * out;
        if (left <= 0) {
          this.hide(t);
          this.stats.streak = 0;
          this.nextPeek = this.clock + 0.3 + Math.random() * 0.45;
          sound.bad();
          this.push();
        }
      } else if (this.clock >= this.nextPeek) {
        this.spawn(t, Math.floor(Math.random() * PILLARS.length));
      }
    }

    for (const t of this.targets) {
      if (!t.alive) continue;
      if (o.drill === "ride") {
        t.mesh.position.x += t.vx * dt;
        t.mesh.position.y += Math.sin(this.clock * 1.7) * 0.25 * dt;
        if (this.clock >= t.turnAt || Math.abs(t.mesh.position.x) > WALL_HALF) {
          t.vx = (t.mesh.position.x > WALL_HALF ? -1 : t.mesh.position.x < -WALL_HALF ? 1 : Math.random() < 0.5 ? -1 : 1) * (2.8 + Math.random() * 2.4);
          t.turnAt = this.clock + 0.5 + Math.random() * 0.9;
        }
      }
      // Targets pop in rather than appear.
      const grow = Math.min(1, (this.clock - t.born) / 0.12);
      const s = t.radius * (0.4 + 0.6 * grow * (2 - grow));
      t.mesh.scale.setScalar(s);
      t.stand.position.set(t.mesh.position.x, 0, t.mesh.position.z - 0.09);
      t.stand.scale.y = Math.max(0.1, t.mesh.position.y - s * 0.2);
    }

    // Sparks fall and fade.
    for (let i = 0; i < PARTICLES; i++) {
      const p = i * 7;
      const life = this.sparkData[p + 6];
      if (life <= 0) continue;
      this.sparkData[p + 4] -= 9 * dt;
      this.sparkData[p] += this.sparkData[p + 3] * dt;
      this.sparkData[p + 1] += this.sparkData[p + 4] * dt;
      this.sparkData[p + 2] += this.sparkData[p + 5] * dt;
      this.sparkData[p + 6] = life - dt;
      this.dummy.position.set(this.sparkData[p], this.sparkData[p + 1], this.sparkData[p + 2]);
      this.dummy.scale.setScalar(Math.max(0, life - dt) * 2);
      this.dummy.rotation.set(life * 9, life * 7, 0);
      this.dummy.updateMatrix();
      this.sparks.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt * 3.4;
      r.mesh.scale.multiplyScalar(1 + dt * 5);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, r.life) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt * 12;
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, t.life) * 0.8;
      if (t.life <= 0) t.mesh.visible = false;
    }

    // The gun kicks, sways behind the view and settles.
    this.kick += (0 - this.kick) * Math.min(1, dt * 14);
    this.swayX += (0 - this.swayX) * Math.min(1, dt * 9);
    this.swayY += (0 - this.swayY) * Math.min(1, dt * 9);
    this.gun.position.set(GUN.x - this.swayX, GUN.y + this.swayY - this.kick * 0.012, GUN.z + this.kick * 0.06);
    this.gun.rotation.set(this.kick * 0.09, GUN.turn + this.swayX * 1.5, 0);
    const flash = this.flash.material as THREE.SpriteMaterial;
    flash.opacity = Math.max(0, flash.opacity - dt * 22);
    this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 90);

    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
