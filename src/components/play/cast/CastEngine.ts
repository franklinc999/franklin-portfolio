import * as THREE from "three";
import { disposeScene, makeFigure, makeKit, type CastKind, type Loose } from "./figures";

export type { CastKind };

type Figure = {
  scene: THREE.Scene;
  root: THREE.Group;
  /** Parts that move on their own: [object, kind of motion, phase]. */
  loose: Loose[];
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
  private kit = makeKit();
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
    for (const f of this.figures) disposeScene(f.scene);
    this.kit.dispose();
    this.renderer.dispose();
  }

  /* ---------- building ---------- */

  private build(kind: CastKind): Figure {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f9a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2.2, 4, 3.4);
    scene.add(sun);
    const { root, loose } = makeFigure(this.kit, kind);
    scene.add(root);
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
        } else if (l.move === "peel") {
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
