import * as THREE from "three";
import { sound } from "@/components/play/sound";

/**
 * The Backlog: one arena, one boss.
 *
 * The boss is a tower of blocks that loses a block every time you take a slice of its health, and gets
 * faster as it shrinks. Every attack is drawn on the floor before it lands, so nothing hits you that
 * you could not have read. You have a sword, a roll that makes you untouchable for a third of a
 * second, and two flasks. All combat is worked out on the ground plane.
 */

export type BossState = {
  phase: "idle" | "fight" | "won" | "lost";
  hp: number;
  stamina: number;
  flasks: number;
  /** The boss's health, 0 to 1. */
  boss: number;
  stage: 1 | 2 | 3;
  time: number;
  hits: number;
  /** The attack being wound up, by name. */
  call: string;
};

type Kind = "slam" | "line" | "ring" | "drop";
type Hazard = { kind: Kind; x: number; z: number; r: number; ang: number; t: number; dur: number; live: number; hit: boolean; mesh: THREE.Group; fill: THREE.Object3D };
type Debris = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; spin: number; life: number };

const ARENA = 11;
const BOSS_R = 1.25;
const BOSS_HP = 440;
const BLOCKS = 7;
const SPARKS = 120;
const CORAL = 0xff4d5e;
const PEACH = 0xffd9a3;
const CREAM = 0xfff1e0;
const INK = 0x14060d;
const NOTE = [0xffd9a3, 0xff7c88, 0xfff1e0, 0xc9b6ff, 0x8fe3c0, 0xffd9a3, 0xff4d5e];

const NAMES: Record<string, string> = { slam: "Stand-up", line: "Hotfix", ring: "Scope creep", drop: "New tickets" };

function tex(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  if (c) draw(c, size);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class BossEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  private focus = new THREE.Vector3();
  private rig = { h: 11, d: 10 };
  private hero = new THREE.Group();
  private heroArm = new THREE.Group();
  private heroShadow: THREE.Mesh;
  private tower = new THREE.Group();
  private blocks: THREE.Mesh[] = [];
  private blockMat: THREE.MeshStandardMaterial[] = [];
  private shots: THREE.Mesh[] = [];
  private pools: Record<Kind, { mesh: THREE.Group; fill: THREE.Object3D }[]> = { slam: [], line: [], ring: [], drop: [] };
  private hazards: Hazard[] = [];
  private debris: Debris[] = [];
  private sparks: THREE.InstancedMesh;
  private sparkData = new Float32Array(SPARKS * 7);
  private sparkNext = 0;
  private dummy = new THREE.Object3D();
  private later: { at: number; fn: () => void }[] = [];

  private raf = 0;
  private last = 0;
  private now = 0;
  private paused = false;
  private stop = 0;
  private shake = 0;
  private statsAt = 0;

  // The player.
  private p = { x: 0, z: 7, face: Math.PI, hp: 100, stamina: 100, flasks: 2, mode: "free" as "free" | "roll" | "attack" | "heal" | "hurt" | "dead", t: 0, dx: 0, dz: -1, combo: 0, struck: false, safeUntil: 0, spentAt: 0, endedAt: -9 };
  private move = { x: 0, z: 0 };
  private want = { attack: -9, roll: -9, heal: -9 };

  // The boss.
  private b = { x: 0, z: -2, face: 0, hp: BOSS_HP, mode: "idle" as "idle" | "wind" | "recover" | "dead", t: 0, dur: 0, tele: 0, attack: "" as Kind | "", last: "" as Kind | "", repeats: 0, lift: 0, flash: 0, shown: BLOCKS };

  private state: BossState = { phase: "idle", hp: 100, stamina: 100, flasks: 2, boss: 1, stage: 1, time: 0, hits: 0, call: "" };

  constructor(
    private canvas: HTMLCanvasElement,
    private onState: (s: BossState) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(INK);
    this.scene.fog = new THREE.Fog(INK, 24, 60);

    this.buildArena();
    this.buildHero();
    this.buildTower();
    this.heroShadow = this.flat(new THREE.CircleGeometry(0.42, 20), 0x000000, 0.45);
    this.heroShadow.visible = true;
    this.buildTells();

    this.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: PEACH }), SPARKS);
    this.sparks.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < SPARKS; i++) this.sparks.setMatrixAt(i, this.dummy.matrix);
    this.scene.add(this.sparks);

    this.resize();
    this.focus.set(0, 0, 2);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- scene ---------- */

  private flat(geo: THREE.BufferGeometry, color: number, opacity: number) {
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    mesh.position.y = 0.02;
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  private buildArena() {
    const floor = tex(1024, (c, s) => {
      const m = s / 2;
      const g = c.createRadialGradient(m, m, 0, m, m, m);
      g.addColorStop(0, "#3a1426");
      g.addColorStop(0.7, "#2a0e1c");
      g.addColorStop(1, "#1d0a15");
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.strokeStyle = "rgba(255,217,163,0.22)";
      c.lineWidth = 3;
      for (const r of [0.18, 0.4, 0.62, 0.84]) {
        c.beginPath();
        c.arc(m, m, m * r, 0, Math.PI * 2);
        c.stroke();
      }
      c.strokeStyle = "rgba(255,124,136,0.2)";
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        c.beginPath();
        c.moveTo(m + Math.cos(a) * m * 0.4, m + Math.sin(a) * m * 0.4);
        c.lineTo(m + Math.cos(a) * m * 0.96, m + Math.sin(a) * m * 0.96);
        c.stroke();
      }
      c.strokeStyle = "#ff6a78";
      c.lineWidth = 10;
      c.shadowColor = "#ff4d5e";
      c.shadowBlur = 30;
      c.beginPath();
      c.arc(m, m, m * 0.955, 0, Math.PI * 2);
      c.stroke();
    });
    const geo = new THREE.CircleGeometry(ARENA + 0.5, 72);
    geo.rotateX(-Math.PI / 2);
    this.scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: floor, emissiveMap: floor, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.7 })));
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(ARENA + 0.5, ARENA - 1.5, 5, 72, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d0a15, roughness: 1 }));
    skirt.position.y = -2.5;
    this.scene.add(skirt);

    // The rest of the backlog, drifting in the dark around the arena.
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + Math.random() * 0.2;
      const r = 17 + Math.random() * 12;
      const s = 0.8 + Math.random() * 1.8;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.3, s * 0.5, s * 1.3), new THREE.MeshStandardMaterial({ color: NOTE[i % NOTE.length], roughness: 0.8, emissive: NOTE[i % NOTE.length], emissiveIntensity: 0.08 }));
      m.position.set(Math.cos(a) * r, -7 + Math.random() * 8, Math.sin(a) * r);
      m.rotation.set(Math.random(), Math.random() * 3, Math.random());
      this.scene.add(m);
    }

    this.scene.add(new THREE.HemisphereLight(0xffe0d0, 0x2a0e1c, 1.5));
    const key = new THREE.DirectionalLight(0xffe2c4, 1.9);
    key.position.set(-6, 12, 8);
    this.scene.add(key);
    const rim = new THREE.PointLight(CORAL, 90, 30, 1.6);
    rim.position.set(0, 6, -9);
    this.scene.add(rim);
  }

  private buildHero() {
    const cloth = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.6 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xe2ab80, roughness: 0.7 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a1727, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 6, 14), cloth);
    body.position.y = 0.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), skin);
    head.position.y = 1.5;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 18), new THREE.MeshStandardMaterial({ color: CORAL, roughness: 0.6 }));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.3;
    const feet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 12), dark);
    feet.position.y = 0.2;
    this.heroArm.position.set(0.3, 1.05, 0);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 1.15), new THREE.MeshStandardMaterial({ color: 0xfff6ea, emissive: 0xffd9a3, emissiveIntensity: 0.7, roughness: 0.3 }));
    blade.position.z = -0.72;
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), dark);
    hilt.position.z = -0.14;
    this.heroArm.add(blade, hilt);
    this.hero.add(body, head, scarf, feet, this.heroArm);
    this.scene.add(this.hero);
  }

  private buildTower() {
    for (let i = 0; i < BLOCKS; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: NOTE[i], roughness: 0.75, emissive: CORAL, emissiveIntensity: 0 });
      const w = 2.3 - i * 0.07;
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, 0.62, w), mat);
      block.position.y = 0.33 + i * 0.66;
      block.rotation.y = (i % 2 ? 0.16 : -0.12) + i * 0.05;
      this.blocks.push(block);
      this.blockMat.push(mat);
      this.tower.add(block);
    }
    // Two eyes on whichever block is on top.
    const eye = new THREE.MeshBasicMaterial({ color: INK });
    const eyes = new THREE.Group();
    eyes.name = "eyes";
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), eye);
      e.position.set(s * 0.42, 0, 0);
      e.rotation.z = s * -0.25;
      eyes.add(e);
    }
    this.tower.add(eyes);
    this.scene.add(this.tower);
    for (let i = 0; i < 3; i++) {
      const shot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 1.4), new THREE.MeshStandardMaterial({ color: CORAL, emissive: CORAL, emissiveIntensity: 0.8 }));
      shot.visible = false;
      this.scene.add(shot);
      this.shots.push(shot);
    }
  }

  /** The shapes drawn on the floor before an attack lands: an outline, and a fill that grows to meet it. */
  private buildTells() {
    const mat = (o: number) => new THREE.MeshBasicMaterial({ color: CORAL, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    const disc = (n: number, kind: Kind) => {
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        const edge = new THREE.RingGeometry(0.95, 1, 48);
        edge.rotateX(-Math.PI / 2);
        const body = new THREE.CircleGeometry(1, 48);
        body.rotateX(-Math.PI / 2);
        const fill = new THREE.Mesh(body, mat(0.42));
        g.add(new THREE.Mesh(edge, mat(0.9)), fill);
        g.position.y = 0.03;
        g.visible = false;
        this.scene.add(g);
        this.pools[kind].push({ mesh: g, fill });
      }
    };
    disc(2, "slam");
    disc(12, "drop");
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const lane = new THREE.PlaneGeometry(1, 1);
      lane.rotateX(-Math.PI / 2);
      lane.translate(0, 0, -0.5);
      const fill = new THREE.Mesh(lane, mat(0.42));
      g.add(new THREE.Mesh(lane, mat(0.2)), fill);
      g.position.y = 0.03;
      g.visible = false;
      this.scene.add(g);
      this.pools.line.push({ mesh: g, fill });
    }
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const band = new THREE.RingGeometry(0.92, 1, 72);
      band.rotateX(-Math.PI / 2);
      const fill = new THREE.Mesh(band, mat(0.85));
      g.add(fill);
      g.position.y = 0.04;
      g.visible = false;
      this.scene.add(g);
      this.pools.ring.push({ mesh: g, fill });
    }
  }

  /* ---------- public ---------- */

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const tall = Math.min(1, Math.max(0, (1.5 - w / h) / 0.75));
    this.camera.fov = 42 + tall * 14;
    this.rig = { h: 11 + tall * 7, d: 10 + tall * 3.5 };
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.p = { x: 0, z: 7, face: Math.PI, hp: 100, stamina: 100, flasks: 2, mode: "free", t: 0, dx: 0, dz: -1, combo: 0, struck: false, safeUntil: 0, spentAt: 0, endedAt: -9 };
    this.b = { x: 0, z: -2, face: 0, hp: BOSS_HP, mode: "recover", t: 0, dur: 1.4, tele: 0, attack: "", last: "", repeats: 0, lift: 0, flash: 0, shown: BLOCKS };
    for (const h of this.hazards) h.mesh.visible = false;
    this.hazards = [];
    this.later = [];
    for (const s of this.shots) s.visible = false;
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
    this.blocks.forEach((blk, i) => {
      blk.visible = true;
      blk.position.set(0, 0.33 + i * 0.66, 0);
    });
    this.tower.visible = true;
    this.hero.visible = true;
    this.hero.rotation.set(0, 0, 0);
    this.want = { attack: -9, roll: -9, heal: -9 };
    this.state = { phase: "fight", hp: 100, stamina: 100, flasks: 2, boss: 1, stage: 1, time: 0, hits: 0, call: "" };
    this.paused = false;
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

  /** Which way to walk, in screen terms: x right, y up. */
  setMove(x: number, y: number) {
    const len = Math.hypot(x, y);
    this.move.x = len > 1 ? x / len : x;
    this.move.z = len > 1 ? -y / len : -y;
  }

  attack() {
    this.want.attack = this.now;
  }

  roll() {
    this.want.roll = this.now;
  }

  heal() {
    this.want.heal = this.now;
  }

  /** For the automated check. */
  debug() {
    return {
      p: { ...this.p },
      b: { ...this.b },
      now: this.now,
      hazards: this.hazards.map((h) => ({ kind: h.kind, x: h.x, z: h.z, r: h.r, ang: h.ang, left: h.dur - h.t, live: h.live })),
    };
  }

  /* ---------- combat ---------- */

  private burst(x: number, y: number, z: number, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const p = this.sparkNext * 7;
      this.sparkNext = (this.sparkNext + 1) % SPARKS;
      const a = Math.random() * Math.PI * 2;
      this.sparkData.set([x, y, z, Math.cos(a) * speed * Math.random(), 2 + Math.random() * speed, Math.sin(a) * speed * Math.random(), 0.5 + Math.random() * 0.3], p);
    }
  }

  /** Something hits the player, unless they are mid-roll or just got hit. */
  private hurt(dmg: number, fromX: number, fromZ: number) {
    const p = this.p;
    if (p.mode === "dead" || this.now < p.safeUntil || this.state.phase !== "fight") return;
    p.hp = Math.max(0, p.hp - dmg);
    this.state.hits++;
    const d = Math.hypot(p.x - fromX, p.z - fromZ) || 1;
    p.dx = (p.x - fromX) / d;
    p.dz = (p.z - fromZ) / d;
    p.mode = "hurt";
    p.t = 0;
    p.safeUntil = this.now + 0.75;
    this.shake = 0.5;
    this.stop = 0.07;
    this.burst(p.x, 1, p.z, 10, 4);
    sound.bad();
    if (p.hp <= 0) {
      p.mode = "dead";
      this.state.phase = "lost";
      sound.end();
    }
    this.push();
  }

  /** The sword connects. */
  private strike(dmg: number) {
    const b = this.b;
    b.hp = Math.max(0, b.hp - dmg);
    b.flash = 1;
    this.stop = 0.05;
    this.shake = Math.max(this.shake, 0.18);
    const top = 0.4 + b.shown * 0.5;
    this.burst(b.x + (this.p.x - b.x) * 0.5, top * 0.6, b.z + (this.p.z - b.z) * 0.5, 9, 5);
    sound.hit();
    // A block comes off the top for every slice of health.
    const should = Math.max(b.hp > 0 ? 1 : 0, Math.ceil((b.hp / BOSS_HP) * BLOCKS));
    while (b.shown > should) {
      b.shown--;
      const src = this.blocks[b.shown];
      src.visible = false;
      const mesh = new THREE.Mesh(src.geometry, src.material);
      mesh.position.set(b.x, src.position.y, b.z);
      this.scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      this.debris.push({ mesh, vx: Math.cos(a) * 5, vy: 7, vz: Math.sin(a) * 5, spin: 4 + Math.random() * 4, life: 1.6 });
      sound.thud();
    }
    if (b.hp <= 0) {
      b.mode = "dead";
      b.t = 0;
      for (const h of this.hazards) h.mesh.visible = false;
      this.hazards = [];
      this.later = [];
      for (const s of this.shots) s.visible = false;
      this.state.phase = "won";
      this.state.call = "";
      this.burst(b.x, 1, b.z, 40, 8);
      sound.end();
    }
    this.push();
  }

  private stage(): 1 | 2 | 3 {
    const r = this.b.hp / BOSS_HP;
    return r > 0.6 ? 1 : r > 0.28 ? 2 : 3;
  }

  private tell(kind: Kind, x: number, z: number, r: number, ang: number, dur: number) {
    const slot = this.pools[kind].find((s) => !s.mesh.visible);
    if (!slot) return;
    slot.mesh.visible = true;
    this.hazards.push({ kind, x, z, r, ang, t: 0, dur, live: 0, hit: false, mesh: slot.mesh, fill: slot.fill });
  }

  /** The boss picks what to do next from how far away you are, and avoids doing one thing three times. */
  private choose() {
    const b = this.b;
    const p = this.p;
    const stage = this.stage();
    const quick = [1, 0.85, 0.72][stage - 1];
    const dist = Math.hypot(p.x - b.x, p.z - b.z);
    const table: [Kind, number][] = dist < 3.8 ? [["slam", 5.5], ["ring", 2.5], ["line", 2]] : [["line", 4.5], ["drop", 3.5], ["ring", 2]];
    let pick: Kind = "slam";
    for (let tries = 0; tries < 6; tries++) {
      let at = Math.random() * table.reduce((a, [, w]) => a + w, 0);
      for (const [k, w] of table) {
        at -= w;
        if (at <= 0) {
          pick = k;
          break;
        }
      }
      if (!(pick === b.last && b.repeats >= 2)) break;
    }
    b.repeats = pick === b.last ? b.repeats + 1 : 1;
    b.last = pick;
    b.attack = pick;
    b.mode = "wind";
    b.t = 0;
    this.state.call = NAMES[pick];
    const aim = () => Math.atan2(p.x - b.x, -(p.z - b.z));

    b.tele = (pick === "slam" ? 0.85 : pick === "line" ? 0.75 : pick === "ring" ? 0.7 : 0.85) * quick;
    if (pick === "slam") {
      b.dur = 0.85 * quick + 1.15;
      this.tell("slam", b.x, b.z, 3.4, 0, 0.85 * quick);
      if (stage >= 2 && Math.random() < 0.5) this.later.push({ at: this.now + 0.85 * quick + 0.15, fn: () => this.tell("ring", b.x, b.z, 0, 0, 0.5) });
    } else if (pick === "line") {
      b.dur = 0.75 * quick + 0.9;
      const fan = stage === 3 ? [-0.4, 0, 0.4] : [0];
      for (const off of fan) this.tell("line", b.x, b.z, 13, aim() + off, 0.75 * quick);
      if (stage === 2) {
        b.dur += 0.45;
        this.later.push({ at: this.now + 0.45, fn: () => this.tell("line", b.x, b.z, 13, aim(), 0.75 * quick) });
      }
    } else if (pick === "ring") {
      b.dur = 0.7 * quick + 1;
      this.tell("ring", b.x, b.z, 0, 0, 0.7 * quick);
      if (stage === 3) this.later.push({ at: this.now + 0.6, fn: () => this.tell("ring", b.x, b.z, 0, 0, 0.7 * quick) });
    } else {
      const n = [5, 7, 9][stage - 1];
      b.dur = n * 0.28 + 0.9;
      for (let i = 0; i < n; i++) {
        this.later.push({
          at: this.now + i * 0.28,
          fn: () => {
            const a = Math.random() * Math.PI * 2;
            const far = i === 0 ? 0 : Math.random() * 1.7;
            this.tell("drop", p.x + Math.cos(a) * far, p.z + Math.sin(a) * far, 1.35, 0, 0.85 * quick);
          },
        });
      }
    }
    this.push();
  }

  /* ---------- loop ---------- */

  private frame = (time: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const real = Math.min(0.25, Math.max(0.001, (time - this.last) / 1000));
    this.last = time;
    if (!this.paused) {
      // A hit freezes the world for a few frames, which is most of what makes it feel like a hit.
      if (this.stop > 0) this.stop -= real;
      else {
        let left = real;
        while (left > 0) {
          const h = Math.min(left, 1 / 90);
          this.update(h);
          left -= h;
        }
      }
    }
    this.draw(real);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    this.now += dt;
    const s = this.state;
    const p = this.p;
    const b = this.b;
    if (s.phase === "fight") s.time += dt;

    /* The player. */
    p.t += dt;
    const fresh = (at: number) => this.now - at < 0.2;
    const toBoss = Math.hypot(b.x - p.x, b.z - p.z);
    if (p.mode === "free" && s.phase === "fight") {
      const mv = Math.hypot(this.move.x, this.move.z);
      if (fresh(this.want.roll) && p.stamina >= 18) {
        this.want.roll = -9;
        p.mode = "roll";
        p.t = 0;
        if (mv > 0.2) {
          p.dx = this.move.x / mv;
          p.dz = this.move.z / mv;
        } else {
          p.dx = Math.sin(p.face);
          p.dz = -Math.cos(p.face);
        }
        p.stamina -= 26;
        p.spentAt = this.now;
        p.safeUntil = Math.max(p.safeUntil, this.now + 0.34);
        sound.swing();
      } else if (fresh(this.want.attack) && p.stamina >= 10) {
        this.want.attack = -9;
        p.mode = "attack";
        p.t = 0;
        p.struck = false;
        p.combo = this.now - p.endedAt < 0.45 ? (p.combo % 3) + 1 : 1;
        // A soft lock-on: swing toward the boss when it is close enough to matter.
        if (toBoss < 6) p.face = Math.atan2(b.x - p.x, -(b.z - p.z));
        else if (mv > 0.2) p.face = Math.atan2(this.move.x, -this.move.z);
        p.stamina = Math.max(0, p.stamina - 16);
        p.spentAt = this.now;
        sound.swing();
      } else if (fresh(this.want.heal) && p.flasks > 0 && p.hp < 100) {
        this.want.heal = -9;
        p.mode = "heal";
        p.t = 0;
        p.struck = false;
        p.flasks--;
      } else if (mv > 0.05) {
        p.x += this.move.x * 5.4 * dt;
        p.z += this.move.z * 5.4 * dt;
        p.face = Math.atan2(this.move.x, -this.move.z);
      }
    } else if (p.mode === "roll") {
      const k = 1 - p.t / 0.44;
      p.x += p.dx * (5 + 11 * k) * dt;
      p.z += p.dz * (5 + 11 * k) * dt;
      p.face = Math.atan2(p.dx, -p.dz);
      if (p.t >= 0.44) p.mode = "free";
    } else if (p.mode === "attack") {
      p.x += Math.sin(p.face) * 1.6 * dt;
      p.z -= Math.cos(p.face) * 1.6 * dt;
      if (!p.struck && p.t >= 0.12) {
        p.struck = true;
        const ang = Math.atan2(b.x - p.x, -(b.z - p.z));
        const off = Math.abs(Math.atan2(Math.sin(ang - p.face), Math.cos(ang - p.face)));
        if (b.mode !== "dead" && toBoss < BOSS_R + 1.55 && off < 1.25) this.strike(p.combo === 3 ? 17 : 10);
      }
      if (p.t >= 0.3) {
        p.mode = "free";
        p.endedAt = this.now;
      }
    } else if (p.mode === "heal") {
      if (!p.struck && p.t >= 0.6) {
        p.struck = true;
        p.hp = Math.min(100, p.hp + 45);
        this.burst(p.x, 1.2, p.z, 12, 2);
        sound.good();
      }
      if (p.t >= 0.8) p.mode = "free";
    } else if (p.mode === "hurt") {
      const k = Math.max(0, 1 - p.t / 0.24);
      p.x += p.dx * 9 * k * dt;
      p.z += p.dz * 9 * k * dt;
      if (p.t >= 0.24) p.mode = "free";
    }
    if (this.now - p.spentAt > 0.55) p.stamina = Math.min(100, p.stamina + 30 * dt);
    // Stay on the arena and out of the boss.
    const out = Math.hypot(p.x, p.z);
    if (out > ARENA - 0.4) {
      p.x *= (ARENA - 0.4) / out;
      p.z *= (ARENA - 0.4) / out;
    }
    const gap = Math.hypot(p.x - b.x, p.z - b.z);
    if (b.mode !== "dead" && gap < BOSS_R + 0.45 && gap > 0.001) {
      p.x = b.x + ((p.x - b.x) / gap) * (BOSS_R + 0.45);
      p.z = b.z + ((p.z - b.z) / gap) * (BOSS_R + 0.45);
    }

    /* Things the boss set in motion. */
    for (let i = this.later.length - 1; i >= 0; i--) {
      if (this.now >= this.later[i].at) {
        const [job] = this.later.splice(i, 1);
        if (s.phase === "fight") job.fn();
      }
    }
    let shot = 0;
    for (const s2 of this.shots) s2.visible = false;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      let done = false;
      if (h.t >= h.dur) {
        const first = h.live === 0;
        h.live += dt;
        if (h.kind === "slam" || h.kind === "drop") {
          if (Math.hypot(p.x - h.x, p.z - h.z) < h.r) this.hurt(h.kind === "slam" ? 26 : 16, h.x, h.z);
          this.shake = Math.max(this.shake, h.kind === "slam" ? 0.6 : 0.2);
          this.burst(h.x, 0.2, h.z, h.kind === "slam" ? 26 : 8, h.kind === "slam" ? 7 : 4);
          if (first) sound.thud();
          done = true;
        } else if (h.kind === "line") {
          // A block flies down the lane. It hits whatever it reaches.
          const along = h.live * 30;
          const fx = Math.sin(h.ang);
          const fz = -Math.cos(h.ang);
          const rx = p.x - h.x;
          const rz = p.z - h.z;
          const on = rx * fx + rz * fz;
          const side = Math.abs(rx * fz - rz * fx);
          if (!h.hit && side < 1.0 && Math.abs(on - along) < 1.3) {
            h.hit = true;
            this.hurt(20, h.x + fx * (on - 1), h.z + fz * (on - 1));
          }
          if (first) sound.shot();
          const mesh = this.shots[shot++ % this.shots.length];
          mesh.visible = true;
          mesh.position.set(h.x + fx * along, 0.5, h.z + fz * along);
          mesh.rotation.y = -h.ang + h.live * 9;
          done = along > h.r;
        } else {
          // The ring spreads from where it started. Roll through it.
          // It cannot hurt in its first instant, so standing right against the boss is not a free hit for it.
          h.r = BOSS_R + 0.2 + h.live * 7.5;
          if (!h.hit && h.live > 0.12 && Math.abs(Math.hypot(p.x - h.x, p.z - h.z) - h.r) < 0.5) {
            if (this.now < p.safeUntil) h.hit = true;
            else {
              h.hit = true;
              this.hurt(18, h.x, h.z);
            }
          }
          if (first) sound.swing();
          done = h.r > ARENA + 2.5;
        }
      }
      if (done) {
        h.mesh.visible = false;
        this.hazards.splice(i, 1);
      }
    }

    /* The boss. */
    if (b.mode === "dead" || s.phase !== "fight") return;
    b.t += dt;
    const stage = this.stage();
    if (stage !== s.stage) {
      s.stage = stage;
      this.shake = 0.7;
      sound.thud();
      this.push();
    }
    const want = Math.atan2(p.x - b.x, -(p.z - b.z));
    const turn = Math.atan2(Math.sin(want - b.face), Math.cos(want - b.face));
    if (b.mode === "idle") {
      b.face += turn * Math.min(1, dt * 5);
      if (gap > 2.9) {
        const v = [1.6, 2.1, 2.6][stage - 1];
        b.x += ((p.x - b.x) / gap) * v * dt;
        b.z += ((p.z - b.z) / gap) * v * dt;
      }
      if (b.t >= [1.0, 0.75, 0.55][stage - 1]) this.choose();
    } else if (b.t >= b.dur) {
      b.mode = "idle";
      b.t = 0;
      b.attack = "";
      s.call = "";
      this.push();
    } else {
      b.face += turn * Math.min(1, dt * 1.5);
    }

    if (this.now - this.statsAt > 0.1) {
      this.statsAt = this.now;
      this.push();
    }
  }

  private draw(dt: number) {
    const p = this.p;
    const b = this.b;
    const s = this.state;

    // The player.
    this.hero.position.set(p.x, 0, p.z);
    this.hero.rotation.set(0, -p.face, 0);
    this.heroShadow.position.set(p.x, 0.02, p.z);
    this.heroArm.rotation.set(0, 0.5, 0);
    if (p.mode === "roll") this.hero.rotateX(-(p.t / 0.44) * Math.PI * 2);
    else if (p.mode === "attack") {
      const k = Math.min(1, p.t / 0.3);
      const dir = p.combo === 2 ? -1 : 1;
      this.heroArm.rotation.y = dir * (1.5 - k * 3.2);
      if (p.combo === 3) this.heroArm.rotation.x = -0.9 + k * 1.4;
    } else if (p.mode === "heal") this.heroArm.rotation.x = 1.2;
    else if (p.mode === "dead") this.hero.rotation.set(Math.PI / 2, 0, 0);
    // Blink while untouchable after a hit, so you know the grace is running.
    this.hero.visible = !(p.mode !== "roll" && p.mode !== "dead" && this.now < p.safeUntil && Math.floor(this.now * 18) % 2 === 0);

    // The boss.
    const telling = b.mode === "wind" && b.t < b.tele;
    const winding = telling && b.attack === "slam";
    const k = winding ? Math.min(1, b.t / b.tele) : 0;
    const target = winding && k < 1 ? Math.sin(k * Math.PI * 0.5) * 1.5 : 0;
    b.lift += (target - b.lift) * Math.min(1, dt * (target ? 9 : 30));
    b.flash = Math.max(0, b.flash - dt * 6);
    this.tower.position.set(b.x, b.lift, b.z);
    this.tower.rotation.y = -b.face;
    const glow = telling ? 0.25 + Math.sin(this.now * 18) * 0.15 : 0;
    this.blocks.forEach((blk, i) => {
      this.blockMat[i].emissiveIntensity = glow + b.flash * 0.9;
      blk.position.x = Math.sin(this.now * 1.7 + i * 0.9) * 0.05 * i;
      if (b.mode === "dead") blk.position.y = Math.max(0.33 + i * 0.1, blk.position.y - dt * (2 + i));
    });
    const eyes = this.tower.getObjectByName("eyes");
    if (eyes) {
      const top = this.blocks[Math.max(0, b.shown - 1)];
      const half = (2.3 - (b.shown - 1) * 0.07) / 2 + 0.02;
      eyes.position.set(top.position.x - Math.sin(top.rotation.y) * half, top.position.y + 0.02, -Math.cos(top.rotation.y) * half);
      eyes.rotation.y = top.rotation.y;
      eyes.visible = b.mode !== "dead";
    }

    // Tells on the floor.
    for (const h of this.hazards) {
      const f = Math.min(1, h.t / h.dur);
      h.mesh.position.set(h.x, h.mesh.position.y, h.z);
      if (h.kind === "slam" || h.kind === "drop") {
        h.mesh.scale.setScalar(h.r);
        h.fill.scale.setScalar(Math.max(0.001, f));
      } else if (h.kind === "line") {
        h.mesh.rotation.y = -h.ang;
        h.mesh.scale.set(2, 1, h.r);
        h.fill.scale.set(1, 1, Math.max(0.001, f));
      } else {
        // Before it goes, the ring draws in toward the boss. It leaves the moment it gets there.
        h.mesh.scale.setScalar(h.t < h.dur ? BOSS_R + 0.2 + (1 - f) * 4.5 : h.r);
      }
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vy -= 18 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.spin * dt;
      d.mesh.rotation.z += d.spin * 0.7 * dt;
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        this.debris.splice(i, 1);
      }
    }

    for (let i = 0; i < SPARKS; i++) {
      const q = i * 7;
      const life = this.sparkData[q + 6];
      if (life <= 0) continue;
      this.sparkData[q + 4] -= 14 * dt;
      this.sparkData[q] += this.sparkData[q + 3] * dt;
      this.sparkData[q + 1] = Math.max(0.05, this.sparkData[q + 1] + this.sparkData[q + 4] * dt);
      this.sparkData[q + 2] += this.sparkData[q + 5] * dt;
      this.sparkData[q + 6] = life - dt;
      this.dummy.position.set(this.sparkData[q], this.sparkData[q + 1], this.sparkData[q + 2]);
      this.dummy.scale.setScalar(Math.max(0, life - dt) * 2);
      this.dummy.rotation.set(life * 9, life * 7, 0);
      this.dummy.updateMatrix();
      this.sparks.setMatrixAt(i, this.dummy.matrix);
    }
    this.sparks.instanceMatrix.needsUpdate = true;

    // The camera keeps you and the boss in frame, and shakes when something lands.
    const fx = s.phase === "idle" ? 0 : p.x + (b.x - p.x) * 0.3;
    const fz = s.phase === "idle" ? 2 : p.z + (b.z - p.z) * 0.3;
    this.focus.x += (fx - this.focus.x) * Math.min(1, dt * 4);
    this.focus.z += (fz - this.focus.z) * Math.min(1, dt * 4);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const j = this.shake * this.shake;
    this.camera.position.set(this.focus.x + (Math.random() - 0.5) * j, this.rig.h + (Math.random() - 0.5) * j, this.focus.z + this.rig.d + (Math.random() - 0.5) * j);
    this.camera.lookAt(this.focus.x, 0.8, this.focus.z);
  }

  private push() {
    const s = this.state;
    s.hp = Math.round(this.p.hp);
    s.stamina = Math.round(this.p.stamina);
    s.flasks = this.p.flasks;
    s.boss = this.b.hp / BOSS_HP;
    this.onState({ ...s });
  }
}
