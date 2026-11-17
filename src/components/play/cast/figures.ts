import * as THREE from "three";

/** Which game a figure comes from. */
export type CastKind = "range" | "ops" | "dink" | "backlog";

export const NAVY = 0x14213d;
export const TOMATO = 0xe4572e;
export const CREAM = 0xfff4dc;

/** A part that moves on its own. */
export type Loose = { obj: THREE.Object3D; move: "sway" | "peel" | "bob"; at: number };

/** The shared look: three flat steps of light and a drawn outline, like a vinyl toy. */
export type Kit = {
  toon(color: number): THREE.MeshToonMaterial;
  flat(color: number): THREE.MeshBasicMaterial;
  edge<T extends THREE.Mesh>(mesh: T, grow?: number): T;
  dispose(): void;
};

export function makeKit(): Kit {
  const steps = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 196, 196, 196, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  steps.minFilter = THREE.NearestFilter;
  steps.magFilter = THREE.NearestFilter;
  steps.needsUpdate = true;
  const rim = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide });
  return {
    toon: (color) => new THREE.MeshToonMaterial({ color, gradientMap: steps }),
    flat: (color) => new THREE.MeshBasicMaterial({ color }),
    // A dark shell just outside the mesh: the drawn outline.
    edge(mesh, grow = 1.07) {
      const shell = new THREE.Mesh(mesh.geometry, rim);
      shell.scale.setScalar(grow);
      mesh.add(shell);
      return mesh;
    },
    dispose() {
      steps.dispose();
      rim.dispose();
    },
  };
}

/** Free everything a scene holds. */
export function disposeScene(scene: THREE.Object3D) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** One figure from a game. With `withStand` it gets the disc it stands on in the cast row. */
export function makeFigure(kit: Kit, kind: CastKind, withStand = true): { root: THREE.Group; loose: Loose[] } {
  const root = new THREE.Group();
  const loose: Loose[] = [];
  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rim = true, to: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, kit.toon(color));
    m.position.set(x, y, z);
    if (rim) kit.edge(m);
    to.add(m);
    return m;
  };
  // Every figure stands on a disc in its game's own colour.
  const stand = (color: number) => {
    if (withStand) kit.edge(add(new THREE.CylinderGeometry(0.78, 0.84, 0.12, 40), color, 0, -0.06, 0, false), 1.035);
  };

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
    kit.edge(add(disc, 0xf26b21, 0, 0, 0, false, clay), 1.06);
    for (const face of [1, -1]) {
      for (const [r, color] of [
        [0.34, 0xffe2c4],
        [0.2, 0xffe2c4],
      ] as const) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.028, r, 40), kit.flat(color));
        ring.position.z = face * 0.047;
        if (face < 0) ring.rotation.y = Math.PI;
        clay.add(ring);
      }
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), kit.flat(0x7a2c0a));
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
    kit.edge(add(new THREE.CylinderGeometry(0.2, 0.31, 0.98, 24), CREAM, 0, 0.66, 0, false), 1.05);
    add(new THREE.CylinderGeometry(0.262, 0.286, 0.2, 24), 0xd9483b, 0, 0.62, 0, false);
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 24), NAVY, 0, 1.17, 0, false);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16), kit.flat(0xffd166));
    lamp.position.y = 1.29;
    root.add(lamp);
    kit.edge(add(new THREE.ConeGeometry(0.25, 0.24, 24), 0xd9483b, 0, 1.51, 0, false), 1.08);
    const kite = new THREE.Group();
    kite.position.set(0.62, 1.42, 0.1);
    const sail = new THREE.OctahedronGeometry(0.2, 0);
    sail.scale(0.78, 1.15, 0.12);
    kit.edge(add(sail, 0xffd166, 0, 0, 0, false, kite), 1.12);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), kit.flat(NAVY));
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
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), kit.flat(0xffffff));
      white.position.set(s * 0.1, 1.24, 0.25);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), kit.flat(NAVY));
      pupil.position.set(s * 0.1, 1.24, 0.305);
      root.add(white, pupil);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), kit.flat(NAVY));
      leg.position.set(s * 0.11, 0.25, 0);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.22), kit.flat(0xffffff));
      shoe.position.set(s * 0.11, 0.04, 0.04);
      root.add(leg, shoe);
    }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), kit.flat(NAVY));
    arm.position.set(0.42, 1.08, 0.04);
    arm.rotation.z = -0.95;
    root.add(arm);
    const face = new THREE.CylinderGeometry(0.19, 0.19, 0.035, 26);
    face.rotateX(Math.PI / 2);
    kit.edge(add(face, TOMATO, 0.68, 1.34, 0.06, false), 1.1);
    const ball = add(new THREE.SphereGeometry(0.075, 14, 10), 0xffe066, -0.5, 0.075, 0.34, false);
    kit.edge(ball, 1.14);
  } else {
    stand(0xb58a5c);
    // The Backlog itself: a tower of sticky pads with a temper, and the pencil that takes it down.
    const pads = [0xffe066, 0xff8fab, 0x8ecae6, 0xffe066, 0xb5e48c, 0xff8fab];
    pads.forEach((color, i) => {
      const pad = add(new THREE.BoxGeometry(0.66, 0.15, 0.66), color, (i % 2 ? 0.03 : -0.03), 0.075 + i * 0.152, 0, false);
      pad.rotation.y = [0.1, -0.16, 0.06, -0.08, 0.14, -0.04][i];
      kit.edge(pad, 1.05);
    });
    const top = 0.075 + 5 * 0.152;
    for (const s of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), kit.flat(0xffffff));
      white.position.set(s * 0.15, top - 0.16, 0.34);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), kit.flat(NAVY));
      pupil.position.set(s * 0.15, top - 0.165, 0.4);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.04), kit.flat(NAVY));
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
  return { root, loose };
}

/**
 * A whole small world for one game: a floating island with the figure on it and a few things from
 * the game around it. The scroll tour on the home page flies past four of these.
 */
export function makeIsland(kit: Kit, kind: CastKind): { group: THREE.Group; loose: Loose[] } {
  const group = new THREE.Group();
  const loose: Loose[] = [];
  const R = 2.3;
  const add = (geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rim: number | false = false, to: THREE.Object3D = group) => {
    const m = new THREE.Mesh(geo, kit.toon(color));
    m.position.set(x, y, z);
    if (rim) kit.edge(m, rim);
    to.add(m);
    return m;
  };
  const land = (top: number, under: number) => {
    add(new THREE.CylinderGeometry(R, R * 0.95, 0.3, 56), top, 0, -0.15, 0, 1.025);
    const rock = new THREE.ConeGeometry(R * 0.95, 1.5, 9);
    rock.rotateX(Math.PI);
    add(rock, under, 0, -1.05, 0, 1.04);
  };
  const figure = (k: CastKind, x: number, z: number, scale: number, turn = 0) => {
    const f = makeFigure(kit, k, false);
    f.root.position.set(x, 0, z);
    f.root.scale.setScalar(scale);
    f.root.rotation.y = turn;
    group.add(f.root);
    loose.push(...f.loose);
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

  if (kind === "range") {
    land(0xe6d5b0, 0x8a6238);
    figure("range", 0, 0.1, 1.5);
    add(box(3.5, 0.75, 0.5), 0x7a5230, 0, 0.37, -1.55, 1.04);
    for (const [x, z, h] of [
      [-1.35, -0.55, 0.95],
      [1.3, -0.8, 1.5],
    ]) {
      add(new THREE.CylinderGeometry(0.02, 0.02, h, 6), 0x1c1a17, x, h / 2, z);
      const disc = new THREE.CylinderGeometry(0.34, 0.34, 0.07, 32);
      disc.rotateX(Math.PI / 2);
      add(disc, 0xf26b21, x, h + 0.3, z, 1.07);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 32), kit.flat(0xffe2c4));
      ring.position.set(x, h + 0.3, z + 0.04);
      group.add(ring);
    }
    for (const x of [-1.8, 1.8]) {
      add(box(0.08, 0.5, 0.08), 0x8a6238, x, 0.25, 1.0);
      add(box(0.09, 0.08, 0.09), 0xf26b21, x, 0.54, 1.0);
    }
  } else if (kind === "ops") {
    land(0x2f8f9d, 0x1d5f6b);
    figure("ops", -0.2, -0.2, 1.5);
    for (const [x, z, turn, sail] of [
      [-1.45, 0.75, 0.5, TOMATO],
      [1.4, 0.2, -0.8, 0xffd166],
    ]) {
      const boat = new THREE.Group();
      boat.position.set(x, 0.09, z);
      boat.rotation.y = turn;
      add(box(0.6, 0.18, 0.26), CREAM, 0, 0, 0, 1.08, boat);
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), NAVY, 0, 0.3, 0, false, boat);
      add(new THREE.ConeGeometry(0.2, 0.42, 3), sail, 0.07, 0.34, 0, 1.1, boat);
      group.add(boat);
      loose.push({ obj: boat, move: "bob", at: x });
    }
    add(new THREE.SphereGeometry(0.1, 12, 8), 0xd9483b, 0.95, 0.06, 1.35, 1.14);
  } else if (kind === "dink") {
    land(0xd9643a, 0x8f3d22);
    add(box(3.5, 0.05, 2.3), 0x1f8a8a, 0, 0.025, 0);
    for (const x of [-1.75, -0.62, 0.62, 1.75]) add(box(0.05, 0.012, 2.3), CREAM, x, 0.056, 0);
    for (const z of [-1.15, 1.15]) add(box(3.5, 0.012, 0.05), CREAM, 0, 0.056, z);
    add(box(0.05, 0.4, 2.36), CREAM, 0, 0.25, 0, 1.03);
    figure("dink", -1.05, 0.2, 1.25, 0.7);
    // The onion across the net, Dill's first rival.
    const onion = new THREE.Group();
    onion.position.set(1.1, 0, -0.15);
    onion.rotation.y = -0.7;
    const bulb = add(new THREE.SphereGeometry(0.44, 20, 16), 0xc58bd6, 0, 0.62, 0, 1.06, onion);
    bulb.scale.set(1, 0.9, 1);
    for (const s of [-0.5, 0, 0.5]) add(new THREE.ConeGeometry(0.07, 0.42, 8), 0x5a9e3f, s * 0.14, 1.2, 0, false, onion).rotation.z = -s * 0.7;
    add(new THREE.TorusGeometry(0.4, 0.05, 8, 22), CREAM, 0, 0.8, 0, false, onion).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), kit.flat(0xffffff));
      white.position.set(s * 0.13, 0.68, 0.4);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 6), kit.flat(NAVY));
      pupil.position.set(s * 0.13, 0.68, 0.455);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), kit.flat(NAVY));
      leg.position.set(s * 0.14, 0.13, 0);
      onion.add(white, pupil, leg);
    }
    group.add(onion);
  } else {
    land(0xb58a5c, 0x7a5a38);
    add(box(3.0, 0.04, 2.1), 0x2f7d5b, 0, 0.02, 0, 1.02);
    for (const z of [-0.95, 0.95]) add(box(2.8, 0.01, 0.025), 0x9fd6b8, 0, 0.045, z);
    for (const x of [-1.4, 1.4]) add(box(0.025, 0.01, 1.9), 0x9fd6b8, x, 0.045, 0);
    figure("backlog", 0.1, -0.1, 1.5);
    add(new THREE.CylinderGeometry(0.22, 0.19, 0.4, 24), CREAM, -1.4, 0.22, 0.62, 1.07);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), kit.flat(0x5a3a22));
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.set(-1.4, 0.425, 0.62);
    group.add(coffee);
    add(new THREE.TorusGeometry(0.11, 0.03, 8, 16), CREAM, -1.65, 0.22, 0.62);
    for (const [x, z, turn, color] of [
      [1.2, 0.72, 0.3, 0xff8fab],
      [-0.55, 0.82, -0.2, 0x8ecae6],
      [1.35, -0.6, -0.4, 0xffe066],
    ]) {
      add(box(0.44, 0.016, 0.44), color, x, 0.055, z).rotation.y = turn;
    }
  }
  return { group, loose };
}
