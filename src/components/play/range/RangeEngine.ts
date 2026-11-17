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
  halo: THREE.Sprite;
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
const INK = 0x14060d;
const CORAL = 0xff4d5e;
const PEACH = 0xffd9a3;

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
  private flashLight = new THREE.PointLight(PEACH, 0, 9);
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
    this.renderer.toneMappingExposure = 1.15;

    this.scene.background = new THREE.Color(INK);
    this.scene.fog = new THREE.Fog(0x1d0a15, 24, 70);
    this.camera.position.set(0, 1.62, 0);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.buildRoom();
    this.buildGun();

    const glow = canvasTexture(128, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,150,150,0.9)");
      g.addColorStop(0.35, "rgba(255,77,94,0.35)");
      g.addColorStop(1, "rgba(255,77,94,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    });
    const ball = new THREE.SphereGeometry(1, 32, 20);
    const skin = new THREE.MeshStandardMaterial({ color: CORAL, emissive: 0xff1f3d, emissiveIntensity: 0.55, roughness: 0.32, metalness: 0.05 });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(ball, skin);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      mesh.visible = false;
      halo.visible = false;
      this.scene.add(mesh, halo);
      this.targets.push({ mesh, halo, radius: 0.5, born: 0, alive: false, vx: 0, turnAt: 0, pillar: 0, side: 1, until: 0 });
    }

    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: PEACH, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    this.flash.scale.setScalar(0.42);
    this.flash.position.set(0, 0.012, -0.88);
    this.gun.add(this.flash);
    this.flashLight.position.set(0.25, -0.1, -1);
    this.camera.add(this.flashLight);

    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: PEACH }), PARTICLES);
    this.sparks.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < PARTICLES; i++) this.sparks.setMatrixAt(i, this.dummy.matrix);
    this.scene.add(this.sparks);

    const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: PEACH, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
      mesh.visible = false;
      this.scene.add(mesh);
      this.rings.push({ mesh, life: 0 });
    }
    const beam = new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true);
    beam.rotateX(Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(beam, new THREE.MeshBasicMaterial({ color: PEACH, transparent: true, opacity: 0, depthWrite: false }));
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

  private buildRoom() {
    const depth = ROOM.front - ROOM.back;
    const midZ = (ROOM.front + ROOM.back) / 2;

    const floorTex = canvasTexture(512, (c, s) => {
      c.fillStyle = "#2a101d";
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "rgba(255,150,165,0.3)";
      c.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        const p = (i * s) / 4;
        c.beginPath();
        c.moveTo(p, 0);
        c.lineTo(p, s);
        c.moveTo(0, p);
        c.lineTo(s, p);
        c.stroke();
      }
      c.fillStyle = "rgba(255,140,160,0.1)";
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) c.fillRect((x * s) / 4, (y * s) / 4, s / 4, s / 4);
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(ROOM.width / 4, depth / 4);
    floorTex.anisotropy = 8;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.width, depth),
      new THREE.MeshStandardMaterial({ map: floorTex, emissiveMap: floorTex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.15 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, midZ);
    this.scene.add(floor);

    const wallTex = canvasTexture(512, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "#4a1a30");
      g.addColorStop(1, "#2a0e1c");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "rgba(255,217,163,0.2)";
      c.lineWidth = 3;
      for (let i = 0; i <= 8; i++) {
        c.beginPath();
        c.moveTo((i * s) / 8, 0);
        c.lineTo((i * s) / 8, s);
        c.stroke();
      }
      c.shadowColor = "#ff4d5e";
      c.shadowBlur = 18;
      c.strokeStyle = "rgba(255,110,125,0.9)";
      c.lineWidth = 6;
      c.strokeRect(s * 0.06, s * 0.1, s * 0.88, s * 0.62);
    });
    // The textures carry their own light, so the hall reads on any GPU and under any tone curve.
    const lit = (map: THREE.Texture, glow: number, roughness: number) =>
      new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: glow, roughness });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, ROOM.height), lit(wallTex, 0.5, 0.85));
    back.position.set(0, ROOM.height / 2, ROOM.back);
    this.scene.add(back);

    const sideTex = canvasTexture(512, (c, s) => {
      const g = c.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, "#3b152a");
      g.addColorStop(0.7, "#2a0e1d");
      g.addColorStop(1, "#1d0a15");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.fillStyle = "rgba(255,217,163,0.1)";
      c.fillRect(0, 0, 4, s);
      c.fillRect(s / 2, 0, 3, s);
      c.fillStyle = "rgba(0,0,0,0.25)";
      c.fillRect(0, s * 0.86, s, s * 0.14);
      // One coral line at chest height and a pale one near the ceiling run the length of the hall.
      c.shadowColor = "#ff4d5e";
      c.shadowBlur = 16;
      c.fillStyle = "#ff6a78";
      c.fillRect(0, s * 0.8, s, 7);
      c.shadowColor = "#ffd9a3";
      c.shadowBlur = 10;
      c.fillStyle = "rgba(255,217,163,0.75)";
      c.fillRect(0, s * 0.1, s, 3);
    });
    sideTex.wrapS = THREE.RepeatWrapping;
    sideTex.repeat.set(depth / 5, 1);
    sideTex.anisotropy = 8;
    const wallMat = lit(sideTex, 0.55, 0.9);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(depth, ROOM.height), wallMat);
      wall.rotation.y = (-side * Math.PI) / 2;
      wall.position.set((side * ROOM.width) / 2, ROOM.height / 2, midZ);
      this.scene.add(wall);
    }

    const ceilTex = canvasTexture(256, (c, s) => {
      c.fillStyle = "#24101b";
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "rgba(255,217,163,0.12)";
      c.lineWidth = 3;
      c.strokeRect(0, 0, s, s);
      c.fillStyle = "rgba(0,0,0,0.22)";
      c.fillRect(s * 0.12, s * 0.12, s * 0.76, s * 0.76);
    });
    ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
    ceilTex.repeat.set(ROOM.width / 3.25, depth / 3.5);
    ceilTex.anisotropy = 8;
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width, depth), lit(ceilTex, 0.5, 1));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, ROOM.height, midZ);
    this.scene.add(ceiling);

    // Light strips overhead and lane markers on the floor, so depth reads at a glance.
    const strip = new THREE.MeshBasicMaterial({ color: PEACH });
    const lane = new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: 0.5 });
    for (let z = -2; z > ROOM.back; z -= 5.5) {
      for (const x of [-7, 7]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.24), strip);
        bar.position.set(x, ROOM.height - 0.06, z);
        this.scene.add(bar);
      }
      const mark = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.width - 6, 0.07), lane);
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(0, 0.012, z - 2);
      this.scene.add(mark);
    }

    // The shooting bench.
    const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a1727, roughness: 0.5, metalness: 0.3 }));
    bench.position.set(0, 0.98, -1.25);
    this.scene.add(bench);
    for (const x of [-4.2, 4.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.98, 0.6), bench.material);
      leg.position.set(x, 0.49, -1.25);
      this.scene.add(leg);
    }

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x4a1b2f, roughness: 0.6, metalness: 0.2 });
    for (const x of PILLARS) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(PILLAR_HALF * 2, 4.6, 1.1), pillarMat);
      p.position.set(x, 2.3, -15.8);
      p.visible = false;
      this.scene.add(p);
      this.pillars.push(p);
    }

    this.scene.add(new THREE.HemisphereLight(0xffe0d0, 0x2a0e1c, 1.5));
    const key = new THREE.DirectionalLight(0xffe2c4, 1.6);
    key.position.set(-4, 9, 6);
    this.scene.add(key);
    const wash = new THREE.PointLight(CORAL, 70, 34, 1.6);
    wash.position.set(0, 5, -22);
    this.scene.add(wash);
    // Two pools of warm light under the strips, so the floor is not one flat sheet.
    for (const z of [-5, -15]) {
      const pool = new THREE.PointLight(PEACH, 26, 16, 1.7);
      pool.position.set(0, ROOM.height - 1.2, z);
      this.scene.add(pool);
    }
  }

  private buildGun() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a3640, roughness: 0.38, metalness: 0.7, emissive: 0x1c0f15 });
    const body = new THREE.MeshStandardMaterial({ color: 0x8a6272, roughness: 0.5, metalness: 0.3, emissive: 0x2c1721 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x2a161f, roughness: 0.85, metalness: 0.05, emissive: 0x10070b });
    const accent = new THREE.MeshBasicMaterial({ color: CORAL });
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
    box(0.058, 0.08, 0.34, 0, 0, -0.22, body); // receiver
    box(0.048, 0.026, 0.34, 0, 0.05, -0.22, steel); // top cover
    box(0.05, 0.058, 0.27, 0, 0.008, -0.52, steel); // handguard
    for (const side of [-1, 1]) box(0.003, 0.007, 0.2, side * 0.0262, 0.014, -0.52, accent); // a thin line down each side
    tube(0.012, 0.18, 0.012, -0.73, rubber); // barrel
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
    box(0.04, 0.12, 0.052, 0, -0.09, -0.1, rubber, -0.32); // grip
    box(0.044, 0.07, 0.22, 0, -0.012, 0.05, body); // stock
    this.gun.position.set(GUN.x, GUN.y, GUN.z);
    this.camera.add(this.gun);
    // A small light that travels with the rifle keeps it readable against the dark hall.
    const fill = new THREE.PointLight(0xffe6d6, 0.5, 1.6, 1.4);
    fill.position.set(0.05, 0.12, 0.1);
    this.camera.add(fill);
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
    t.halo.visible = false;
  }

  private spawn(t: Target, pillar = -1) {
    const d = DRILLS[this.options.drill];
    t.radius = d.radius;
    t.born = this.clock;
    t.alive = true;
    t.mesh.visible = true;
    t.halo.visible = true;
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
      this.burst(end, 4, 1.6);
      this.push();
      return;
    }

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

    this.burst(target.mesh.position, 16, 4.4);
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
      this.burst(end, 2, 1.8);
      sound.hit();
    } else {
      this.stats.streak = 0;
    }
    this.push();
  }

  /* ---------- effects ---------- */

  private burst(at: THREE.Vector3, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const o = (this.sparkNext++ % PARTICLES) * 7;
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
      t.halo.position.copy(t.mesh.position);
      t.halo.scale.setScalar(s * 4.2);
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
