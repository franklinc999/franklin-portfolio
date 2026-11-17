import * as THREE from "three";
import { sound } from "@/components/play/sound";

/**
 * The Backlog: a boss fight on a desk.
 *
 * You are about three centimetres tall and standing on a cutting mat. The boss is a stack of sticky
 * note pads that loses a pad for every slice of its health and speeds up as it shrinks. Everything it
 * does shows on the mat before it lands, as something a desk would have on it: a stamp, a highlighter
 * stroke, a coffee ring, the shadow of a falling note. You have a pencil, a roll that makes you
 * untouchable for a third of a second, and two coffees. All combat is worked out on the ground plane.
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
type Slot = { mesh: THREE.Group; fill: THREE.Object3D; note?: THREE.Mesh };
type Hazard = { kind: Kind; x: number; z: number; r: number; ang: number; t: number; dur: number; live: number; hit: boolean; mesh: THREE.Group; fill: THREE.Object3D; note?: THREE.Mesh };
type Mark = { mesh: THREE.Mesh; life: number; kind: Kind };
type Debris = { mesh: THREE.Mesh; vx: number; vy: number; vz: number; spin: number; life: number };

const ARENA = 11;
const BOSS_R = 1.25;
const BOSS_HP = 440;
const BLOCKS = 7;
const SPARKS = 120;
const STAMP = 0xd7263d;
const MARKER = 0xf4ff3a;
const DESK = 0x8a6646;
/** Sticky note colours, bottom pad to top. */
const NOTE = [0xffe66d, 0xff8fab, 0x8ecae6, 0xb5e48c, 0xffb347, 0xcdb4db, 0xffe66d];

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
  private camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 240);
  private focus = new THREE.Vector3();
  private rig = { h: 16.5, d: 14.5 };
  private hero = new THREE.Group();
  private heroArm = new THREE.Group();
  private tower = new THREE.Group();
  private blocks: THREE.Mesh[] = [];
  private blockMat: THREE.MeshStandardMaterial[] = [];
  private tops: THREE.MeshStandardMaterial[] = [];
  private marks: Mark[] = [];
  private shots: THREE.Mesh[] = [];
  private pools: Record<Kind, Slot[]> = { slam: [], line: [], ring: [], drop: [] };
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(DESK);
    this.scene.fog = new THREE.Fog(DESK, 46, 110);

    this.buildArena();
    this.buildHero();
    this.buildTower();
    this.buildTells();

    // Scraps of note paper, thrown up whenever something connects.
    const scrap = new THREE.PlaneGeometry(0.2, 0.2);
    this.sparks = new THREE.InstancedMesh(scrap, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), SPARKS);
    this.sparks.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    const tint = new THREE.Color();
    for (let i = 0; i < SPARKS; i++) {
      this.sparks.setMatrixAt(i, this.dummy.matrix);
      this.sparks.setColorAt(i, tint.set(NOTE[i % NOTE.length]));
    }
    this.scene.add(this.sparks);

    this.resize();
    this.focus.set(0, 0, 2);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- scene ---------- */

  /** A flat shape lying on the mat. */
  private lay(geo: THREE.BufferGeometry, mat: THREE.Material, y = 0.03) {
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    return mesh;
  }

  /** Everything in the room throws a shadow under the desk lamp. That is most of what makes it read as small. */
  private solid(o: THREE.Object3D) {
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.scene.add(o);
    return o;
  }

  private buildArena() {
    // The desk.
    const wood = tex(1024, (c, s) => {
      c.fillStyle = "#c9a178";
      c.fillRect(0, 0, s, s);
      for (let i = 0; i < 300; i++) {
        const y = Math.random() * s;
        c.strokeStyle = `rgba(${96 + Math.random() * 40},${58 + Math.random() * 30},${30 + Math.random() * 20},${0.05 + Math.random() * 0.13})`;
        c.lineWidth = 1 + Math.random() * 3;
        c.beginPath();
        c.moveTo(0, y);
        c.bezierCurveTo(s * 0.3, y + (Math.random() - 0.5) * 20, s * 0.65, y + (Math.random() - 0.5) * 20, s, y + (Math.random() - 0.5) * 8);
        c.stroke();
      }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(3, 3);
    const desk = this.lay(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.78 }), -0.12);
    desk.receiveShadow = true;
    this.scene.add(desk);

    // The cutting mat. One square of its grid is one step, and the white circle is the edge of the fight.
    const W = 34;
    const D = 30;
    const print = tex(2048, (c, s) => {
      const ux = s / W;
      const uz = s / D;
      c.fillStyle = "#2c6956";
      c.fillRect(0, 0, s, s);
      for (let i = 0; i <= W; i++) {
        c.fillStyle = i % 5 === 2 ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.15)";
        c.fillRect(i * ux - 1, 0, i % 5 === 2 ? 3 : 2, s);
      }
      for (let i = 0; i <= D; i++) {
        c.fillStyle = i % 5 === 0 ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.15)";
        c.fillRect(0, i * uz - 1, s, i % 5 === 0 ? 3 : 2);
      }
      c.strokeStyle = "rgba(255,255,255,0.3)";
      c.lineWidth = 2;
      for (const a of [30, 45, 60]) {
        const t = Math.tan((a * Math.PI) / 180);
        c.beginPath();
        c.moveTo(2 * ux, s - 2 * uz);
        c.lineTo(2 * ux + 12 * ux, s - 2 * uz - 12 * uz * t * (ux / uz) * (uz / ux));
        c.stroke();
      }
      c.strokeStyle = "#f6f3ea";
      c.lineWidth = 7;
      c.beginPath();
      c.ellipse(s / 2, s / 2, ARENA * ux, ARENA * uz, 0, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 3;
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const far = i % 6 === 0 ? 0.7 : 0.35;
        c.beginPath();
        c.moveTo(s / 2 + Math.cos(a) * ARENA * ux, s / 2 + Math.sin(a) * ARENA * uz);
        c.lineTo(s / 2 + Math.cos(a) * (ARENA + far) * ux, s / 2 + Math.sin(a) * (ARENA + far) * uz);
        c.stroke();
      }
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 4;
      c.strokeRect(ux, uz, s - 2 * ux, s - 2 * uz);
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.font = `${Math.round(uz * 0.62)}px ui-monospace, Menlo, monospace`;
      for (let i = 2; i < W; i += 5) c.fillText(String(i - 2), i * ux + 6, s - uz * 1.25);
      c.font = `${Math.round(uz * 0.5)}px ui-monospace, Menlo, monospace`;
      c.fillText("SELF HEALING MAT   A2", s - 11 * ux, uz * 1.75);
    });
    const edge = new THREE.MeshStandardMaterial({ color: 0x24574a, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ map: print, roughness: 0.92 });
    const mat = new THREE.Mesh(new THREE.BoxGeometry(W, 0.12, D), [edge, edge, top, edge, edge, edge]);
    mat.position.y = -0.06;
    mat.receiveShadow = true;
    this.scene.add(mat);

    // What else is on the desk, at the size it would be if you were three centimetres tall.
    const paint = (color: number, roughness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness });
    const mug = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.5, 4.8, 40), paint(0xf4f1ea, 0.3));
    cup.position.y = 2.4;
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.1, 40), paint(0x3a2315, 0.2));
    coffee.position.y = 4.7;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.36, 12, 28), paint(0xf4f1ea, 0.3));
    handle.position.set(-2.9, 2.5, 0);
    mug.add(cup, coffee, handle);
    mug.position.set(-16.2, 0, -10.5);
    mug.rotation.y = 0.5;
    this.solid(mug);

    const pencil = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 13, 6), paint(0xf2b705, 0.5));
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 12), new THREE.MeshStandardMaterial({ color: 0xb9bcc2, roughness: 0.3, metalness: 0.8 }));
    ferrule.position.y = 6.9;
    const rubber = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.8, 12), paint(0xf28ca0, 0.8));
    rubber.position.y = 7.7;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.3, 6), paint(0xe6c79a, 0.8));
    cone.position.y = -7.15;
    cone.rotation.x = Math.PI;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.42, 6), paint(0x2b2d33, 0.4));
    lead.position.y = -7.6;
    lead.rotation.x = Math.PI;
    pencil.add(shaft, ferrule, rubber, cone, lead);
    pencil.rotation.set(0, 0.16, Math.PI / 2);
    pencil.position.set(5, 0.34, -16.4);
    this.solid(pencil);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.8, 3.6), paint(0xffe66d, 0.85));
    pad.position.set(19.4, 0.4, 4);
    pad.rotation.y = 0.22;
    const pad2 = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 3.6), paint(0xff8fab, 0.85));
    pad2.position.set(19.1, 1.05, 3.7);
    pad2.rotation.y = -0.12;
    this.solid(pad);
    this.solid(pad2);

    const ruler = new THREE.Mesh(
      new THREE.BoxGeometry(26, 0.1, 1.8),
      new THREE.MeshStandardMaterial({
        roughness: 0.4,
        map: tex(1024, (c, s) => {
          c.fillStyle = "#efe6c8";
          c.fillRect(0, 0, s, s);
          c.fillStyle = "#3a3329";
          for (let i = 0; i <= 130; i++) c.fillRect((i / 130) * s, 0, 2, i % 10 === 0 ? s * 0.5 : i % 5 === 0 ? s * 0.36 : s * 0.22);
        }),
      }),
    );
    ruler.position.set(-2, 0.05, 16.4);
    ruler.rotation.y = -0.04;
    this.solid(ruler);

    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 15; i++) {
        const key = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.9, 1.95), paint(row ? 0x2b2d33 : 0x34373e, 0.55));
        key.position.set(-15.4 + i * 2.2 + row * 0.9, 0.45, -19.6 - row * 2.2);
        this.solid(key);
      }
    }

    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x7a5c44, 1.2));
    const lamp = new THREE.DirectionalLight(0xffe7c2, 2.5);
    lamp.position.set(-13, 24, 9);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    const cam = lamp.shadow.camera;
    cam.left = cam.bottom = -24;
    cam.right = cam.top = 24;
    cam.near = 1;
    cam.far = 80;
    lamp.shadow.bias = -0.0005;
    lamp.shadow.normalBias = 0.04;
    this.scene.add(lamp);
  }

  /** You: three centimetres tall, in a red hoodie, with a pencil. */
  private buildHero() {
    const paint = (color: number, roughness = 0.7) => new THREE.MeshStandardMaterial({ color, roughness });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.46, 6, 14), paint(0xe63946));
    body.position.y = 0.82;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), paint(0xf1c9a5));
    head.position.y = 1.5;
    // A yellow beanie, so you can find yourself on a green mat from a long way up.
    const hair = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), paint(0xf2b705));
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), paint(0xfbf8ef));
    pom.position.y = 0.23;
    hair.add(cap, pom);
    hair.position.set(0, 1.53, 0);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 8, 18), paint(0xc92f3b));
    hood.rotation.x = Math.PI / 2;
    hood.position.y = 1.3;
    const feet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.32, 12), paint(0x2b2d42));
    feet.position.y = 0.2;
    this.heroArm.position.set(0.3, 1.02, 0);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 6), paint(0xf2b705, 0.5));
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.72;
    const rubber = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.14, 8), paint(0xf28ca0));
    rubber.rotation.x = Math.PI / 2;
    rubber.position.z = -0.14;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), paint(0x2b2d33, 0.4));
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -1.34;
    this.heroArm.add(shaft, rubber, tip);
    this.hero.add(body, head, hair, hood, feet, this.heroArm);
    this.solid(this.hero);
  }

  /** The Backlog: seven pads of sticky notes, with something scrawled on each. */
  private buildTower() {
    const edges = tex(64, (c, s) => {
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, s, s);
      c.fillStyle = "rgba(0,0,0,0.13)";
      for (let y = 3; y < s; y += 5) c.fillRect(0, y, s, 1);
    });
    for (let i = 0; i < BLOCKS; i++) {
      const side = new THREE.MeshStandardMaterial({ color: NOTE[i], map: edges, roughness: 0.9, emissive: 0xff3b2f, emissiveIntensity: 0 });
      const top = new THREE.MeshStandardMaterial({ color: NOTE[i], roughness: 0.9, emissive: 0xff3b2f, emissiveIntensity: 0 });
      const w = 2.3 - i * 0.07;
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, 0.62, w), [side, side, top, side, side, side]);
      block.position.y = 0.33 + i * 0.66;
      block.rotation.y = (i % 2 ? 0.16 : -0.12) + i * 0.05;
      this.blocks.push(block);
      this.blockMat.push(side, top);
      this.tops.push(top);
      this.tower.add(block);
    }
    // A face on whichever pad is on top: drawn on its front, and again on its lid where you can see it from above.
    const ink = new THREE.MeshBasicMaterial({ color: 0x1f1b16 });
    const eyes = new THREE.Group();
    eyes.name = "eyes";
    for (const s of [-1, 1]) {
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.05), ink);
      front.position.set(s * 0.42, 0, 0);
      front.rotation.z = s * -0.28;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.2), ink);
      // On the lid the face is laid out for someone looking down from in front: mouth nearest the edge.
      lid.position.set(s * 0.42, 0.33, 0.78);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.03, 0.09), ink);
      brow.position.set(s * 0.44, 0.33, 1.08);
      brow.rotation.y = s * 0.4;
      eyes.add(front, lid, brow);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.09), ink);
    mouth.position.set(0, 0.33, 0.34);
    eyes.add(mouth);
    this.tower.add(eyes);
    this.solid(this.tower);

    // What it throws: a paper plane.
    const plane = new THREE.BufferGeometry();
    const nose = [0, 0, -1];
    const l = [-0.62, 0.14, 0.7];
    const r = [0.62, 0.14, 0.7];
    const up = [0, 0.1, 0.7];
    const keel = [0, -0.3, 0.7];
    plane.setAttribute("position", new THREE.Float32BufferAttribute([...nose, ...up, ...l, ...nose, ...r, ...up, ...nose, ...keel, ...up], 3));
    plane.computeVertexNormals();
    for (let i = 0; i < 3; i++) {
      const shot = new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ color: 0xfbf8ef, roughness: 0.8, side: THREE.DoubleSide, flatShading: true }));
      shot.scale.setScalar(1.7);
      shot.castShadow = true;
      shot.visible = false;
      this.scene.add(shot);
      this.shots.push(shot);
    }
  }

  /** Write on the pads once the marker face has loaded. */
  ink(family: string) {
    const words = ["v2?", "pls fix", "TODO", "blocked", "follow up", "ASAP", ""];
    // Ask for the marker face alone. The stand-in listed after it is a system font that may not exist.
    const face = family.split(",")[0].trim() || "cursive";
    const write = () => {
      this.tops.forEach((top, i) => {
        if (!words[i]) return;
        top.map = tex(256, (c, s) => {
          c.fillStyle = "#ffffff";
          c.fillRect(0, 0, s, s);
          c.fillStyle = "#26221c";
          c.font = `${words[i].length > 6 ? 46 : 62}px ${face}, cursive`;
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.translate(s / 2, s / 2);
          c.rotate(Math.PI + (i % 2 ? 0.1 : -0.08));
          c.fillText(words[i], 0, 0);
        });
        top.needsUpdate = true;
      });
    };
    // If the face cannot be fetched, the pads are still written on, in whatever the browser has.
    document.fonts.load(`64px ${face}`).then(write, write);
  }

  /**
   * What an attack looks like before it lands, all of it something that could be on a desk: a stamp
   * about to come down, a highlighter stroke, a coffee ring, the shadow of a falling note.
   */
  private buildTells() {
    const flat = (color: number, o: number) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    const group = (kind: Kind, parts: THREE.Object3D[], fill: THREE.Object3D, y: number, note?: THREE.Mesh) => {
      const g = new THREE.Group();
      g.add(...parts);
      if (note) g.add(note);
      g.position.y = y;
      g.visible = false;
      this.scene.add(g);
      this.pools[kind].push({ mesh: g, fill, note });
    };
    for (let i = 0; i < 2; i++) {
      const rim = this.lay(new THREE.RingGeometry(0.93, 1, 56), flat(STAMP, 0.95), 0);
      const rim2 = this.lay(new THREE.RingGeometry(0.86, 0.885, 56), flat(STAMP, 0.9), 0);
      const fill = this.lay(new THREE.CircleGeometry(0.84, 56), flat(STAMP, 0.45), 0);
      group("slam", [rim, rim2, fill], fill, 0.03);
    }
    for (let i = 0; i < 12; i++) {
      const rim = this.lay(new THREE.RingGeometry(0.94, 1, 40), flat(0x14110d, 0.55), 0);
      const fill = this.lay(new THREE.CircleGeometry(1, 40), flat(0x14110d, 0.34), 0);
      const note = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.05, 1.25), new THREE.MeshStandardMaterial({ color: NOTE[i % NOTE.length], roughness: 0.9 }));
      note.castShadow = true;
      group("drop", [rim, fill], fill, 0.03, note);
    }
    for (let i = 0; i < 4; i++) {
      const lane = new THREE.PlaneGeometry(1, 1);
      lane.rotateX(-Math.PI / 2);
      lane.translate(0, 0, -0.5);
      const fill = new THREE.Mesh(lane, flat(MARKER, 0.62));
      group("line", [new THREE.Mesh(lane, flat(MARKER, 0.22)), fill], fill, 0.03);
    }
    for (let i = 0; i < 3; i++) {
      const fill = this.lay(new THREE.RingGeometry(0.9, 1, 80), flat(0x5a3a26, 0.8), 0);
      const inner = this.lay(new THREE.RingGeometry(0.975, 1, 80), flat(0x2f1c10, 0.9), 0);
      group("ring", [fill, inner], fill, 0.04);
    }

    // Marks left on the mat for a moment after something lands.
    const urgent = tex(512, (c, s) => {
      c.clearRect(0, 0, s, s);
      c.translate(s / 2, s / 2);
      c.rotate(-0.2);
      c.strokeStyle = c.fillStyle = "#d7263d";
      c.lineWidth = 16;
      c.beginPath();
      c.arc(0, 0, s * 0.45, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 6;
      c.beginPath();
      c.arc(0, 0, s * 0.4, 0, Math.PI * 2);
      c.stroke();
      c.font = `900 ${s * 0.2}px Impact, "Arial Black", sans-serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("URGENT", 0, 6);
      c.fillRect(-s * 0.3, -s * 0.16, s * 0.6, 8);
      c.fillRect(-s * 0.3, s * 0.15, s * 0.6, 8);
      // Worn rubber: knock a few holes in the ink.
      c.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 500; i++) c.fillRect((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 2 + Math.random() * 5, 2 + Math.random() * 3);
    });
    for (let i = 0; i < 2; i++) {
      const m = this.lay(new THREE.PlaneGeometry(7.2, 7.2), new THREE.MeshBasicMaterial({ map: urgent, transparent: true, opacity: 0, depthWrite: false }), 0.022);
      m.visible = false;
      this.scene.add(m);
      this.marks.push({ mesh: m, life: 0, kind: "slam" });
    }
    for (let i = 0; i < 12; i++) {
      const m = this.lay(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ color: NOTE[i % NOTE.length], transparent: true, opacity: 0, depthWrite: false }), 0.024 + i * 0.0005);
      m.visible = false;
      this.scene.add(m);
      this.marks.push({ mesh: m, life: 0, kind: "drop" });
    }
  }

  /** Leave a mark where something landed. It fades on its own. */
  private mark(kind: Kind, x: number, z: number) {
    const m = this.marks.filter((k) => k.kind === kind).reduce((a, b) => (a.life <= b.life ? a : b));
    m.life = 1;
    m.mesh.visible = true;
    m.mesh.position.set(x, m.mesh.position.y, z);
    m.mesh.rotation.y = kind === "drop" ? Math.random() * 1.2 - 0.6 : 0;
  }

  /* ---------- public ---------- */

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const tall = Math.min(1, Math.max(0, (1.5 - w / h) / 0.75));
    // A long lens from high up, the way you would photograph something small on a desk.
    this.camera.fov = 34 + tall * 12;
    this.rig = { h: 16.5 + tall * 8, d: 14.5 + tall * 4 };
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.p = { x: 0, z: 7, face: Math.PI, hp: 100, stamina: 100, flasks: 2, mode: "free", t: 0, dx: 0, dz: -1, combo: 0, struck: false, safeUntil: 0, spentAt: 0, endedAt: -9 };
    this.b = { x: 0, z: -2, face: 0, hp: BOSS_HP, mode: "recover", t: 0, dur: 1.4, tele: 0, attack: "", last: "", repeats: 0, lift: 0, flash: 0, shown: BLOCKS };
    for (const h of this.hazards) h.mesh.visible = false;
    this.hazards = [];
    this.later = [];
    for (const s of this.shots) s.visible = false;
    for (const m of this.marks) {
      m.life = 0;
      m.mesh.visible = false;
    }
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
      mesh.castShadow = true;
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
    this.hazards.push({ kind, x, z, r, ang, t: 0, dur, live: 0, hit: false, mesh: slot.mesh, fill: slot.fill, note: slot.note });
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
          this.mark(h.kind, h.x, h.z);
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
          mesh.position.set(h.x + fx * along, 0.9 + Math.sin(h.live * 14) * 0.12, h.z + fz * along);
          mesh.rotation.set(0, -h.ang, Math.sin(h.live * 11) * 0.25);
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
    for (const m of this.blockMat) m.emissiveIntensity = glow + b.flash * 0.7;
    this.blocks.forEach((blk, i) => {
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
        // The note itself, on its way down.
        if (h.note) {
          h.note.position.y = 11 * (1 - f) * (1 - f) + 0.04;
          h.note.rotation.set((1 - f) * 2.4, h.x * 3 + (1 - f) * 3, (1 - f) * 1.3);
        }
      } else if (h.kind === "line") {
        h.mesh.rotation.y = -h.ang;
        h.mesh.scale.set(2, 1, h.r);
        h.fill.scale.set(1, 1, Math.max(0.001, f));
      } else {
        // Before it goes, the ring draws in toward the boss. It leaves the moment it gets there.
        h.mesh.scale.setScalar(h.t < h.dur ? BOSS_R + 0.2 + (1 - f) * 4.5 : h.r);
      }
    }

    for (const m of this.marks) {
      if (m.life <= 0) continue;
      m.life -= dt * (m.kind === "slam" ? 0.45 : 0.7);
      (m.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, Math.max(0, m.life) * 2.2) * (m.kind === "slam" ? 0.8 : 0.95);
      if (m.life <= 0) m.mesh.visible = false;
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
