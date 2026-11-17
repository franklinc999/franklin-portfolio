import * as THREE from "three";
import { disposeScene, makeIsland, makeKit, type CastKind, type Loose } from "./figures";

/** How far apart the islands sit. */
const GAP = 9.5;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => v * v * v * (v * (v * 6 - 15) + 10);

/**
 * The scroll tour: four floating islands, one for each game, and one camera that travels past them
 * as the page scrolls. It is a single unbroken move, so it reads the same forwards and backwards.
 * The page hands in how far through the section it is; nothing here listens to scrolling itself.
 */
export class TourEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  private kit = makeKit();
  private islands: { group: THREE.Group; loose: Loose[] }[] = [];
  private raf = 0;
  private last = 0;
  private clock = 0;
  private want = 0;
  private at = 0;
  private still = false;
  private visible = false;
  private dirty = true;

  constructor(
    private canvas: HTMLCanvasElement,
    kinds: CastKind[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f9a, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 6, 5);
    this.scene.add(sun);
    kinds.forEach((kind, i) => {
      const island = makeIsland(this.kit, kind);
      island.group.position.x = i * GAP;
      this.scene.add(island.group);
      this.islands.push(island);
    });
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  resize() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // The words sit to the left on a wide screen and along the bottom on a tall one, so the island
    // is framed off-centre, away from them.
    if (w / h > 1.15) this.camera.setViewOffset(w, h, -0.17 * w, 0.02 * h, w, h);
    else this.camera.setViewOffset(w, h, 0, 0.15 * h, w, h);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** How far through the tour the page has scrolled, 0 to 1. */
  setProgress(p: number) {
    this.want = clamp01(p);
  }

  /** No motion of its own: the islands stop bobbing. The camera still follows the scroll. */
  setStill(value: boolean) {
    this.still = value;
    this.dirty = true;
  }

  setVisible(value: boolean) {
    this.visible = value;
    this.last = performance.now();
    this.dirty = true;
  }

  /** For the automated check. */
  debug() {
    return { want: this.want, at: this.at, cameraX: this.camera.position.x, stops: this.islands.map((i) => i.group.position.x) };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    disposeScene(this.scene);
    this.kit.dispose();
    this.renderer.dispose();
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    if (!this.visible) return;
    this.clock += dt;

    // The camera chases the scroll position rather than snapping to it, which irons out the
    // steps of a mouse wheel.
    const gap = this.want - this.at;
    const chasing = Math.abs(gap) > 0.0004;
    this.at = chasing ? this.at + gap * (1 - Math.exp(-dt * 9)) : this.want;
    if (!chasing && this.still && !this.dirty) return;
    this.dirty = false;

    // Linger at each island, then glide to the next in a low arc.
    const last = this.islands.length - 1;
    const t = this.at * last;
    const i = Math.min(last - 1, Math.floor(t));
    const e = ease(clamp01((t - i - 0.17) / 0.66));
    const arc = Math.sin(Math.PI * e);
    const x = (i + e) * GAP;
    const back = Math.max(11.5, 6.1 / (0.573 * this.camera.aspect)) + arc * 1.8;
    this.camera.position.set(x, 2.1 + back * 0.09 + arc * 0.9, back);
    this.camera.lookAt(x, 0.7, 0);

    const time = this.still ? 0 : this.clock;
    this.islands.forEach((island, n) => {
      // Only the island in front of the camera and the one it is heading for get drawn.
      island.group.visible = Math.abs(n * GAP - x) < GAP * 1.25;
      if (!island.group.visible) return;
      island.group.rotation.y = -0.32 + Math.sin(time * 0.38 + n * 1.4) * 0.2;
      island.group.position.y = Math.sin(time * 0.9 + n * 1.7) * 0.07;
      for (const l of island.loose) {
        if (l.move === "sway") {
          l.obj.rotation.z = Math.sin(time * 1.9) * 0.16;
          l.obj.position.y = 1.42 + Math.sin(time * 1.3) * 0.04;
        } else if (l.move === "peel") {
          l.obj.rotation.z = 0.2 + (Math.sin(time * 1.2) * 0.5 + 0.5) * 0.34;
        } else {
          l.obj.position.y = 0.09 + Math.sin(time * 1.6 + l.at) * 0.025;
          l.obj.rotation.z = Math.sin(time * 1.2 + l.at) * 0.07;
        }
      }
    });
    this.renderer.render(this.scene, this.camera);
  };
}
