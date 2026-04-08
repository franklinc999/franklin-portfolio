"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, extend, useThree, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import * as THREE from "three";
import { createCardTexture } from "./CardTexture";

extend({ MeshLineGeometry, MeshLineMaterial });

/* eslint-disable @typescript-eslint/no-namespace */
declare module "@react-three/fiber" {
  interface ThreeElements {
    meshLineGeometry: object;
    meshLineMaterial: object & {
      color?: string;
      depthTest?: boolean;
      resolution?: [number, number];
      useMap?: boolean;
      map?: THREE.Texture | null;
      repeat?: [number, number];
      lineWidth?: number;
      transparent?: boolean;
      opacity?: number;
    };
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export default function Badge3D() {
  return (
    <div className="w-full h-full" style={{ minHeight: "500px" }}>
      <Canvas camera={{ position: [0, 0, 15], fov: 25 }} dpr={[1, 2]}>
        <ambientLight intensity={Math.PI} />
        <Physics interpolate gravity={[0, -40, 0]} timeStep={1 / 60}>
          <Band />
        </Physics>
        <Environment background blur={0.75}>
          <color attach="background" args={["#0a0a0c"]} />
          <Lightformer
            intensity={2}
            color="white"
            position={[0, -1, 5]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="#5bb8d4"
            position={[-1, -1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={3}
            color="#a78bfa"
            position={[1, 1, 1]}
            rotation={[0, 0, Math.PI / 3]}
            scale={[100, 0.1, 1]}
          />
          <Lightformer
            intensity={10}
            color="white"
            position={[-10, 0, 14]}
            rotation={[0, Math.PI / 2, Math.PI / 3]}
            scale={[100, 10, 1]}
          />
        </Environment>
      </Canvas>
    </div>
  );
}

function Band({ maxSpeed = 50, minSpeed = 10 }) {
  const band = useRef<THREE.Mesh>(null!);
  const fixed = useRef<RapierRigidBody>(null!);
  const j1 = useRef<RapierRigidBody>(null!);
  const j2 = useRef<RapierRigidBody>(null!);
  const j3 = useRef<RapierRigidBody>(null!);
  const card = useRef<RapierRigidBody>(null!);

  const vec = useMemo(() => new THREE.Vector3(), []);
  const ang = useMemo(() => new THREE.Vector3(), []);
  const rot = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const segmentProps = {
    type: "dynamic" as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  const { width, height } = useThree((state) => state.size);

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ])
  );

  const [dragged, drag] = useState<THREE.Vector3 | false>(false);
  const [hovered, hover] = useState(false);

  // Create the card face texture
  const cardTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    return createCardTexture();
  }, []);

  // Create a band texture (subtle dashed line pattern)
  const bandTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    // Subtle lanyard pattern
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(91,184,212,0.15)";
    ctx.fillRect(0, 0, 64, 2);
    ctx.fillRect(0, 30, 64, 2);
    ctx.fillStyle = "rgba(167,139,250,0.1)";
    ctx.fillRect(0, 15, 64, 1);
    ctx.fillRect(0, 45, 64, 1);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => {
        document.body.style.cursor = "auto";
      };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x,
        y: vec.y - dragged.y,
        z: vec.z - dragged.z,
      });
    }

    if (fixed.current) {
      // Lerp joint positions for smooth band
      [j1, j2].forEach((ref) => {
        if (!ref.current) return;
        const curr = ref.current as RapierRigidBody & { lerped?: THREE.Vector3 };
        if (!curr.lerped)
          curr.lerped = new THREE.Vector3().copy(curr.translation() as unknown as THREE.Vector3);
        const clampedDistance = Math.max(
          0.1,
          Math.min(1, curr.lerped.distanceTo(curr.translation() as unknown as THREE.Vector3))
        );
        curr.lerped.lerp(
          curr.translation() as unknown as THREE.Vector3,
          delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed))
        );
      });

      const j1c = j1.current as RapierRigidBody & { lerped?: THREE.Vector3 };
      const j2c = j2.current as RapierRigidBody & { lerped?: THREE.Vector3 };

      curve.points[0].copy(j3.current!.translation() as unknown as THREE.Vector3);
      curve.points[1].copy(j2c.lerped || (j2c.translation() as unknown as THREE.Vector3));
      curve.points[2].copy(j1c.lerped || (j1c.translation() as unknown as THREE.Vector3));
      curve.points[3].copy(fixed.current.translation() as unknown as THREE.Vector3);

      // Update band geometry
      if (band.current) {
        const geom = band.current.geometry as unknown as { setPoints: (pts: THREE.Vector3[]) => void };
        geom.setPoints(curve.getPoints(32));
      }

      // Dampen card rotation so it self-rights
      ang.copy(card.current!.angvel() as unknown as THREE.Vector3);
      rot.copy(card.current!.rotation() as unknown as THREE.Vector3);
      card.current!.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }
  });

  curve.curveType = "chordal";

  // Card dimensions matching the original aspect ratio
  const cardW = 1.6;
  const cardH = 2.25;

  return (
    <>
      <group position={[0, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}>
          <BallCollider args={[0.1]} />
        </RigidBody>
        <RigidBody
          position={[2, 0, 0]}
          ref={card}
          {...segmentProps}
          type={dragged ? "kinematicPosition" : "dynamic"}
        >
          <CuboidCollider args={[0.8, 1.125, 0.01]} />
          <group
            scale={1.8}
            position={[0, -1.0, -0.05]}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
            onPointerUp={(e) => {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              drag(false);
            }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              drag(
                new THREE.Vector3()
                  .copy(e.point)
                  .sub(vec.copy(card.current!.translation() as unknown as THREE.Vector3))
              );
            }}
          >
            {/* Card face - front */}
            <mesh position={[0, 0.5, 0]}>
              <planeGeometry args={[cardW, cardH]} />
              <meshPhysicalMaterial
                map={cardTexture}
                transparent
                opacity={0.95}
                clearcoat={1}
                clearcoatRoughness={0.1}
                roughness={0.15}
                metalness={0.3}
                envMapIntensity={1.5}
                side={THREE.FrontSide}
              />
            </mesh>

            {/* Card face - back (dark mirror) */}
            <mesh position={[0, 0.5, -0.01]}>
              <planeGeometry args={[cardW, cardH]} />
              <meshPhysicalMaterial
                color="#111115"
                clearcoat={1}
                clearcoatRoughness={0.15}
                roughness={0.2}
                metalness={0.5}
                envMapIntensity={0.8}
                side={THREE.BackSide}
              />
            </mesh>

            {/* Edge glow (thin border geometry) */}
            <mesh position={[0, 0.5, -0.005]}>
              <boxGeometry args={[cardW + 0.02, cardH + 0.02, 0.02]} />
              <meshPhysicalMaterial
                color="#1a1a22"
                clearcoat={1}
                clearcoatRoughness={0.3}
                roughness={0.4}
                metalness={0.6}
              />
            </mesh>

            {/* Clip/clamp at top */}
            <mesh position={[0, 0.5 + cardH / 2 + 0.12, 0]}>
              <boxGeometry args={[0.3, 0.25, 0.06]} />
              <meshStandardMaterial color="#555560" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.5 + cardH / 2 + 0.02, 0]}>
              <boxGeometry args={[0.2, 0.08, 0.08]} />
              <meshStandardMaterial color="#444450" metalness={0.9} roughness={0.15} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      {/* Lanyard band */}
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          color="#5bb8d4"
          depthTest={false}
          resolution={[width, height]}
          useMap={!!bandTexture}
          map={bandTexture}
          repeat={[-4, 1]}
          lineWidth={1}
          transparent
          opacity={0.6}
        />
      </mesh>
    </>
  );
}
