import * as THREE from "three";

/** Which game a figure comes from. */
export type CastKind = "range" | "ops" | "dink" | "backlog";

const NAVY = 0x14213d;
const TOMATO = 0xe4572e;
const CREAM = 0xfff4dc;

type Figure = {
  scene: THREE.Scene;
  root: THREE.Group;
  /** Parts that move on their own: [object, kind of motion, phase]. */
  loose: { obj: THREE.Object3D; move: "sway" | "peel"; at: number }[];
  yaw: number;
  vel: number;
  hop: number;
  held: boolean;
};

/**
 * Four small figures, one from each game, drawn by a single renderer. The canvas lies over the
 * whole row and each figure is painted into the rectangle of its own slot in the page, so the
 * layout stays ordinary HTML and CSS: a row on a wide screen, two by two on a phone.
 *
 * Plain three.js, like the games. It knows nothing about React.
 */
export class CastEngine {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  private steps: THREE.DataTexture;
  private rim = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide });
  private figures: Figure[] = [];
  private raf = 0;
  private last = 0;
  private clock = 0;
  private still = false;
  private visible = true;
  private dirty = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private slots: HTMLElement[],
    kinds: CastKind[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Three flat steps of light, the look of a vinyl toy.
    this.steps = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 196, 196, 196, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    this.steps.minFilter = THREE.NearestFilter;
    this.steps.magFilter = THREE.NearestFilter;
    this.steps.needsUpdate = true;

    this.camera.position.set(0, 1.5, 6.4);
    this.camera.lookAt(0, 0.78, 0);

    for (const kind of kinds) this.figures.push(this.build(kind));
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ---------- public ---------- */

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.dirty = true;
  }

  /** No motion of its own: the figures hold a pose until someone turns one. */
  setStill(value: boolean) {
    this.still = value;
    this.dirty = true;
  }

  setVisible(value: boolean) {
    this.visible = value;
    this.last = performance.now();
    this.dirty = true;
  }

  /** A hand on a figure: it stops turning by itself and follows the drag. */
  hold(i: number) {
    const f = this.figures[i];
    if (!f) return;
    f.held = true;
    f.vel = 0;
  }

  /** Turn a held figure by a drag of `dx` css pixels. */
  drag(i: number, dx: number) {
    const f = this.figures[i];
    if (!f) return;
    f.yaw += dx * 0.012;
    this.dirty = true;
  }

  /** Let go, with the speed the hand was moving at, in css pixels a second. */
  release(i: number, speed: number) {
    const f = this.figures[i];
    if (!f) return;
    f.held = false;
    f.vel = Math.max(-14, Math.min(14, speed * 0.012));
  }

  /** A little jump, for when the pointer or the keyboard lands on a figure. */
  hop(i: number) {
    const f = this.figures[i];
    if (!f || f.hop > 0 || this.still) return;
    f.hop = 0.0001;
  }

  /** For the automated check. */
  debug() {
    return this.figures.map((f) => ({ yaw: f.yaw, vel: f.vel, y: f.root.position.y, held: f.held }));
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    for (const f of this.figures) {
      f.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    }
    this.steps.dispose();
    this.rim.dispose();
    this.renderer.dispose();
  }

  /* ---------- building ---------- */

  private toon(color: number) {
    return new THREE.MeshToonMaterial({ color, gradientMap: this.steps });
  }

  private flat(color: number) {
    return new THREE.MeshBasicMaterial({ color });
  }

  /** A dark shell just outside the mesh: the drawn outline. */
  private edge<T extends THREE.Mesh>(mesh: T, grow = 1.07) {
    const shell = new THREE.Mesh(mesh.geometry, this.rim);
    shell.scale.setScalar(grow);
    mesh.add(shell);
    return mesh;
  }

  private build(kind: CastKind): Figure {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f9a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2.2, 4, 3.4);
    scene.add(sun);

    const root = new THREE.Group();
    scene.add(root);
    const loose: Figure["loose"] = [];
    const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rim = true, to: THREE.Object3D = root) => {
      const m = new THREE.Mesh(geo, this.toon(color));
      m.position.set(x, y, z);
      if (rim) this.edge(m);
      to.add(m);
      return m;
    };
    // Every figure stands on a disc in its game's own colour.
    const stand = (color: number) => this.edge(add(new THREE.CylinderGeometry(0.78, 0.84, 0.12, 40), color, 0, -0.06, 0, false), 1.035);

    if (kind === "range") {
      stand(0x2a2622);
      // A mound of sand, a rod, and a clay with its rings.
      const sand = add(new THREE.SphereGeometry(0.46, 20, 12), 0xe6d5b0, 0, 0, 0, false);
      sand.scale.set(1, 0.24, 1);
      add(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 8), 0x1c1a17, 0, 0.52, 0, false);
      const clay = new THREE.Group();
      clay.position.set(0, 1.12, 0);
      const disc = new THREE.CylinderGeometry(0.46, 0.46, 0.09, 40);
      disc.rotateX(Math.PI / 2);
      this.edge(add(disc, 0xf26b21, 0, 0, 0, false, clay), 1.06);
      for (const face of [1, -1]) {
        for (const [r, color] of [
          [0.34, 0xffe2c4],
          [0.2, 0xffe2c4],
        ] as const) {
          const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.028, r, 40), this.flat(color));
          ring.position.z = face * 0.047;
          if (face < 0) ring.rotation.y = Math.PI;
          clay.add(ring);
        }
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), this.flat(0x7a2c0a));
        dot.position.z = face * 0.047;
        if (face < 0) dot.rotation.y = Math.PI;
        clay.add(dot);
      }
      root.add(clay);
      // One of the range's stakes, with its orange cap.
      add(new THREE.BoxGeometry(0.07, 0.42, 0.07), 0x8a6238, 0.46, 0.2, 0.16, false);
      add(new THREE.BoxGeometry(0.075, 0.07, 0.075), 0xf26b21, 0.46, 0.44, 0.16, false);
    } else if (kind === "ops") {
      stand(0x2f8f9d);
      // The lighthouse of Pocket Harbor, in the season of kites.
      const rock = add(new THREE.IcosahedronGeometry(0.5, 0), 0x6f7f8c, 0, 0.05, 0, false);
      rock.scale.set(1.15, 0.38, 1);
      rock.rotation.y = 0.5;
      this.edge(add(new THREE.CylinderGeometry(0.2, 0.31, 0.98, 24), CREAM, 0, 0.66, 0, false), 1.05);
      add(new THREE.CylinderGeometry(0.262, 0.286, 0.2, 24), 0xd9483b, 0, 0.62, 0, false);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), NAVY, 0, 1.17, 0, false);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), this.flat(0xffd166));
      lamp.position.y = 1.29;
      root.add(lamp);
      this.edge(add(new THREE.ConeGeometry(0.25, 0.24, 24), 0xd9483b, 0, 1.51, 0, false), 1.08);
      const kite = new THREE.Group();
      kite.position.set(0.62, 1.42, 0.1);
      const sail = new THREE.OctahedronGeometry(0.2, 0);
      sail.scale(0.78, 1.15, 0.12);
      this.edge(add(sail, 0xffd166, 0, 0, 0, false, kite), 1.12);
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), this.flat(NAVY));
      line.position.set(-0.19, -0.29, -0.03);
      line.rotation.z = -0.62;
      kite.add(line);
      root.add(kite);
      loose.push({ obj: kite, move: "sway", at: 0 });
    } else if (kind === "dink") {
      stand(TOMATO);
      // Dill, as he appears on court, turned to face the page.
      add(new THREE.CapsuleGeometry(0.27, 0.62, 8, 18), 0x6aa84f, 0, 1.0, 0);
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4 + 2;
        add(new THREE.SphereGeometry(0.045, 8, 6), 0x4f8a3a, Math.cos(a) * 0.26, 0.62 + (i % 5) * 0.17, Math.sin(a) * 0.26, false);
      }
      add(new THREE.TorusGeometry(0.26, 0.055, 8, 22), TOMATO, 0, 1.42, 0, false).rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) {
        const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), this.flat(0xffffff));
        white.position.set(s * 0.1, 1.24, 0.25);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), this.flat(NAVY));
        pupil.position.set(s * 0.1, 1.24, 0.305);
        root.add(white, pupil);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), this.flat(NAVY));
        leg.position.set(s * 0.11, 0.25, 0);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.22), this.flat(0xffffff));
        shoe.position.set(s * 0.11, 0.04, 0.04);
        root.add(leg, shoe);
      }
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), this.flat(NAVY));
      arm.position.set(0.42, 1.08, 0.04);
      arm.rotation.z = -0.95;
      root.add(arm);
      const face = new THREE.CylinderGeometry(0.19, 0.19, 0.035, 26);
      face.rotateX(Math.PI / 2);
      this.edge(add(face, TOMATO, 0.68, 1.34, 0.06, false), 1.1);
      const ball = add(new THREE.SphereGeometry(0.075, 14, 10), 0xffe066, -0.5, 0.075, 0.34, false);
      this.edge(ball, 1.14);
    } else {
      stand(0xb58a5c);
      // The Backlog itself: a tower of sticky pads with a temper, and the pencil that takes it down.
      const pads = [0xffe066, 0xff8fab, 0x8ecae6, 0xffe066, 0xb5e48c, 0xff8fab];
      pads.forEach((color, i) => {
        const pad = add(new THREE.BoxGeometry(0.66, 0.15, 0.66), color, (i % 2 ? 0.03 : -0.03), 0.075 + i * 0.152, 0, false);
        pad.rotation.y = [0.1, -0.16, 0.06, -0.08, 0.14, -0.04][i];
        this.edge(pad, 1.05);
      });
      const top = 0.075 + 5 * 0.152;
      for (const s of [-1, 1]) {
        const white = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), this.flat(0xffffff));
        white.position.set(s * 0.15, top - 0.16, 0.34);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), this.flat(NAVY));
        pupil.position.set(s * 0.15, top - 0.165, 0.4);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), this.flat(NAVY));
        brow.position.set(s * 0.16, top - 0.055, 0.4);
        brow.rotation.z = -s * 0.42;
        root.add(white, pupil, brow);
      }
      // A note working loose from the top of the pile.
      const note = new THREE.Group();
      note.position.set(-0.33, top + 0.08, 0);
      const sheet = new THREE.BoxGeometry(0.62, 0.012, 0.62);
      sheet.translate(0.31, 0, 0);
      add(sheet, 0xffe066, 0, 0, 0, false, note);
      root.add(note);
      loose.push({ obj: note, move: "peel", at: 0 });
      const pencil = new THREE.Group();
      pencil.position.set(0.62, 0.02, 0.28);
      pencil.rotation.z = 0.2;
      add(new THREE.CylinderGeometry(0.045, 0.045, 0.82, 6), 0xf6c443, 0, 0.5, 0, true, pencil);
      const tip = new THREE.ConeGeometry(0.045, 0.12, 6);
      tip.rotateX(Math.PI);
      add(tip, 0x2b2b2b, 0, 0.03, 0, false, pencil);
      add(new THREE.CylinderGeometry(0.047, 0.047, 0.09, 6), 0xff8fab, 0, 0.955, 0, false, pencil);
      root.add(pencil);
    }

    // Each one starts at a three-quarter turn, so the first look is not flat on.
    return { scene, root, loose, yaw: -0.5, vel: 0, hop: 0, held: false };
  }

  /* ---------- loop ---------- */

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (!this.visible) return;
    this.clock += dt;

    let moving = !this.still;
    this.figures.forEach((f, i) => {
      // Left alone, a figure eases back to a slow turn (or to rest, when motion is off).
      const cruise = this.still ? 0 : 0.42;
      if (!f.held) {
        // Pause means stop now, not coast to a stop.
        f.vel += (cruise - f.vel) * Math.min(1, dt * (this.still ? 9 : 1.6));
        f.yaw += f.vel * dt;
        if (Math.abs(f.vel) > 0.01) moving = true;
      } else {
        moving = true;
      }
      let lift = this.still ? 0 : Math.sin(this.clock * 1.5 + i * 1.3) * 0.018;
      let squash = 1;
      if (f.hop > 0) {
        f.hop += dt / 0.46;
        if (f.hop >= 1) f.hop = 0;
        const arc = Math.sin(Math.PI * f.hop);
        lift += arc * 0.3;
        squash = 1 + arc * 0.06 - Math.max(0, 0.18 - f.hop) * 0.5;
        moving = true;
      }
      f.root.rotation.y = f.yaw;
      f.root.position.y = lift;
      f.root.scale.set(2 - squash, squash, 2 - squash);
      for (const l of f.loose) {
        const t = this.still ? 0 : this.clock;
        if (l.move === "sway") {
          l.obj.rotation.z = Math.sin(t * 1.9) * 0.16;
          l.obj.position.y = 1.42 + Math.sin(t * 1.3) * 0.04;
        } else {
          l.obj.rotation.z = 0.2 + (Math.sin(t * 1.2) * 0.5 + 0.5) * 0.34;
        }
      }
    });

    if (!moving && !this.dirty) return;
    this.dirty = false;
    this.paint();
  };

  private paint() {
    const r = this.renderer;
    const box = this.canvas.getBoundingClientRect();
    r.setScissorTest(false);
    r.clear();
    r.setScissorTest(true);
    this.figures.forEach((f, i) => {
      const s = this.slots[i]?.getBoundingClientRect();
      if (!s || s.width < 2 || s.height < 2) return;
      const x = s.left - box.left;
      const y = box.bottom - s.bottom;
      r.setViewport(x, y, s.width, s.height);
      r.setScissor(x, y, s.width, s.height);
      this.camera.aspect = s.width / s.height;
      this.camera.updateProjectionMatrix();
      r.render(f.scene, this.camera);
    });
  }
}
