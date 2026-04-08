"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, extend, useThree, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, Html } from "@react-three/drei";
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

extend({ MeshLineGeometry, MeshLineMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    meshLineGeometry: object;
    meshLineMaterial: object & Record<string, unknown>;
  }
}

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
          <Lightformer intensity={2} color="white" position={[0, -1, 5]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="#5bb8d4" position={[-1, -1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={3} color="#a78bfa" position={[1, 1, 1]} rotation={[0, 0, Math.PI / 3]} scale={[100, 0.1, 1]} />
          <Lightformer intensity={10} color="white" position={[-10, 0, 14]} rotation={[0, Math.PI / 2, Math.PI / 3]} scale={[100, 10, 1]} />
        </Environment>
      </Canvas>
    </div>
  );
}

/** The HTML content rendered on the 3D card face via drei's <Html> */
function CardFace() {
  return (
    <div
      style={{
        width: 280,
        height: 400,
        background: "linear-gradient(135deg, rgba(17,17,23,0.97) 0%, rgba(22,22,30,0.95) 50%, rgba(15,15,20,0.97) 100%)",
        borderRadius: 16,
        border: "1px solid rgba(91,184,212,0.25)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        color: "#e8e8ec",
        overflow: "hidden",
        position: "relative",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(91,184,212,0.06), 0 0 80px rgba(167,139,250,0.03)",
      }}
    >
      {/* Iridescent sheen overlay */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 16, pointerEvents: "none",
        background: "linear-gradient(135deg, rgba(91,184,212,0.08) 0%, transparent 40%, rgba(167,139,250,0.06) 70%, transparent 100%)",
      }} />

      {/* CLEARED badge */}
      <div style={{
        position: "absolute", top: 12, right: 12,
        padding: "2px 8px", borderRadius: 3,
        background: "rgba(91,184,212,0.1)", border: "1px solid rgba(91,184,212,0.25)",
        fontSize: 7, fontFamily: "monospace", letterSpacing: 2, color: "#5bb8d4",
      }}>CLEARED</div>

      {/* Photo */}
      <div style={{
        width: "100%", height: 140, borderRadius: 10, overflow: "hidden",
        background: "linear-gradient(135deg, rgba(91,184,212,0.12), rgba(167,139,250,0.1))",
        marginBottom: 14, flexShrink: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/profile-card.jpg"
          alt="Franklin Cheng"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>

      {/* Name */}
      <div style={{ fontSize: 20, fontFamily: "Georgia, serif", fontWeight: 400, lineHeight: 1.1 }}>
        Franklin Cheng
      </div>
      <div style={{
        fontSize: 8, fontFamily: "monospace", letterSpacing: 2,
        color: "#8a8a95", marginTop: 4, textTransform: "uppercase",
      }}>
        Strategist & Product Builder
      </div>

      {/* Divider */}
      <div style={{
        width: "100%", height: 1, margin: "12px 0",
        background: "linear-gradient(90deg, transparent, rgba(120,200,255,0.2), transparent)",
      }} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px", flex: 1 }}>
        {[
          ["ORG", "Sia Partners"],
          ["DEGREE", "UPenn PPE"],
          ["FOCUS", "AI + GTM"],
          ["CLIENTS", "F500"],
          ["LOCATION", "Los Angeles"],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 6, fontFamily: "monospace", letterSpacing: 1.5, color: "#55555f" }}>{label}</div>
            <div style={{ fontSize: 10, color: "#b0b0b8", marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Bottom */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "auto",
      }}>
        <span style={{ fontSize: 7, fontFamily: "monospace", letterSpacing: 2, color: "#55555f" }}>ID-FC-2025</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[1,2,3,4,0].map((filled, i) => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: "50%",
              background: filled ? "#5bb8d4" : "#55555f",
            }} />
          ))}
        </div>
      </div>
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

  const vec = new THREE.Vector3();
  const ang = new THREE.Vector3();
  const rot = new THREE.Vector3();
  const dir = new THREE.Vector3();

  const segmentProps = {
    type: "dynamic" as const,
    canSleep: true,
    colliders: false as const,
    angularDamping: 4,
    linearDamping: 4,
  };

  const { width, height } = useThree((state) => state.size);

  const [curve] = useState(
    () => new THREE.CatmullRomCurve3([
      new THREE.Vector3(), new THREE.Vector3(),
      new THREE.Vector3(), new THREE.Vector3(),
    ])
  );

  const [dragged, drag] = useState<THREE.Vector3 | false>(false);
  const [hovered, hover] = useState(false);

  // Band texture
  const [bandTexture, setBandTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1a1a22";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(91,184,212,0.15)";
    ctx.fillRect(0, 0, 64, 2);
    ctx.fillRect(0, 30, 64, 2);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    setBandTexture(tex);
  }, []);

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], 1]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], 1]);
  useSphericalJoint(j3, card, [[0, 0, 0], [0, 1.45, 0]]);

  useEffect(() => {
    if (hovered) {
      document.body.style.cursor = dragged ? "grabbing" : "grab";
      return () => { document.body.style.cursor = "auto"; };
    }
  }, [hovered, dragged]);

  useFrame((state, delta) => {
    if (dragged) {
      vec.set(state.pointer.x, state.pointer.y, 0.5).unproject(state.camera);
      dir.copy(vec).sub(state.camera.position).normalize();
      vec.add(dir.multiplyScalar(state.camera.position.length()));
      [card, j1, j2, j3, fixed].forEach((ref) => ref.current?.wakeUp());
      card.current?.setNextKinematicTranslation({
        x: vec.x - dragged.x, y: vec.y - dragged.y, z: vec.z - dragged.z,
      });
    }
    if (fixed.current) {
      [j1, j2].forEach((ref) => {
        if (!ref.current) return;
        const curr = ref.current as RapierRigidBody & { lerped?: THREE.Vector3 };
        if (!curr.lerped) curr.lerped = new THREE.Vector3().copy(curr.translation() as unknown as THREE.Vector3);
        const d = Math.max(0.1, Math.min(1, curr.lerped.distanceTo(curr.translation() as unknown as THREE.Vector3)));
        curr.lerped.lerp(curr.translation() as unknown as THREE.Vector3, delta * (minSpeed + d * (maxSpeed - minSpeed)));
      });
      const j1c = j1.current as RapierRigidBody & { lerped?: THREE.Vector3 };
      const j2c = j2.current as RapierRigidBody & { lerped?: THREE.Vector3 };
      curve.points[0].copy(j3.current!.translation() as unknown as THREE.Vector3);
      curve.points[1].copy(j2c.lerped || (j2c.translation() as unknown as THREE.Vector3));
      curve.points[2].copy(j1c.lerped || (j1c.translation() as unknown as THREE.Vector3));
      curve.points[3].copy(fixed.current.translation() as unknown as THREE.Vector3);
      if (band.current) {
        const geom = band.current.geometry as unknown as { setPoints: (pts: THREE.Vector3[]) => void };
        geom.setPoints(curve.getPoints(32));
      }
      ang.copy(card.current!.angvel() as unknown as THREE.Vector3);
      rot.copy(card.current!.rotation() as unknown as THREE.Vector3);
      card.current!.setAngvel({ x: ang.x, y: ang.y - rot.y * 0.25, z: ang.z }, true);
    }
  });

  curve.curveType = "chordal";
  const cardW = 1.6;
  const cardH = 2.25;

  return (
    <>
      <group position={[2, 4, 0]}>
        <RigidBody ref={fixed} {...segmentProps} type="fixed" />
        <RigidBody position={[0.5, 0, 0]} ref={j1} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1, 0, 0]} ref={j2} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
        <RigidBody position={[1.5, 0, 0]} ref={j3} {...segmentProps}><BallCollider args={[0.1]} /></RigidBody>
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
              drag(new THREE.Vector3().copy(e.point).sub(vec.copy(card.current!.translation() as unknown as THREE.Vector3)));
            }}
          >
            {/* Card body - white-ish so content is visible */}
            <mesh position={[0, 0.5, 0]}>
              <planeGeometry args={[cardW, cardH]} />
              <meshStandardMaterial
                color="#1a1a22"
                roughness={0.4}
                metalness={0.1}
                side={THREE.DoubleSide}
              />
            </mesh>

            {/* HTML overlay - the actual card content */}
            <Html
              position={[0, 0.5, 0.01]}
              transform
              distanceFactor={1.8}
              pointerEvents="none"
            >
              <CardFace />
            </Html>

            {/* Clip at top */}
            <mesh position={[0, 0.5 + cardH / 2 + 0.12, 0]}>
              <boxGeometry args={[0.3, 0.25, 0.06]} />
              <meshStandardMaterial color="#666" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.5 + cardH / 2 + 0.02, 0]}>
              <boxGeometry args={[0.2, 0.08, 0.08]} />
              <meshStandardMaterial color="#555" metalness={0.9} roughness={0.15} />
            </mesh>
          </group>
        </RigidBody>
      </group>

      {/* Lanyard */}
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
