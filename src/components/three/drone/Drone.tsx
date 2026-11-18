"use client";

import { useFrame } from "@react-three/fiber";
import { forwardRef, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { PAINTS, type PaintId } from "@/domain/config";
import { ARM_ROOTS, boltMatrices, getDroneGeometries, ROTOR_POSITIONS } from "./geometry";
import { useDroneMaterials } from "./materials";

/**
 * Mutable animation inputs, written by the owning scene every frame (no React
 * re-render). `time` is the scene clock — frozen in benchmark mode.
 */
export interface DroneRig {
  /** Rotor angular speed (rad/s). */
  rotorSpeed: number;
  /** Exploded-view factor for inspection, 0–1. */
  explode: number;
  /** Scene time in seconds (drives strobes / pulses). */
  time: number;
  /** Seconds since the previous frame (0 when frozen). */
  dt: number;
  /** Airframe pitch, used to stabilise the camera gimbal. */
  pitch: number;
}

export const createDroneRig = (rotorSpeed = 600): DroneRig => ({ rotorSpeed, explode: 0, time: 0, dt: 0, pitch: 0 });

interface DroneProps {
  paint: PaintId;
  lights: boolean;
  rig: DroneRig;
  castShadow?: boolean;
  /** Show the underglow point light (hangar only — saves a light in flight). */
  underglow?: boolean;
}

export const Drone = forwardRef<THREE.Group, DroneProps>(function Drone(
  { paint, lights, rig, castShadow = true, underglow = false },
  ref,
) {
  const g = getDroneGeometries();
  const m = useDroneMaterials(paint, lights);
  const props = useRef<(THREE.Mesh | null)[]>([]);
  const rotors = useRef<(THREE.Group | null)[]>([]);
  const canopy = useRef<THREE.Group>(null);
  const battery = useRef<THREE.Group>(null);
  const gear = useRef<THREE.Group>(null);
  const gimbal = useRef<THREE.Group>(null);
  const gimbalHead = useRef<THREE.Group>(null);
  const bolts = useRef<THREE.InstancedMesh>(null);
  const angles = useRef([0, 0.9, 1.7, 2.6]);
  const accentColor = PAINTS[paint].accent;

  const arms = useMemo(
    () =>
      ARM_ROOTS.map((root, i) => {
        const rotor = ROTOR_POSITIONS[i];
        const dx = rotor[0] - root[0];
        const dz = rotor[2] - root[2];
        const len = Math.hypot(dx, dz);
        return { root, yaw: Math.atan2(-dz, dx), dir: new THREE.Vector3(dx / len, 0, dz / len) };
      }),
    [],
  );

  const boltList = useMemo(() => boltMatrices(), []);
  useLayoutEffect(() => {
    const mesh = bolts.current;
    if (!mesh) return;
    boltList.forEach((mat, i) => mesh.setMatrixAt(i, mat));
    mesh.instanceMatrix.needsUpdate = true;
  }, [boltList]);

  useFrame(() => {
    const { rotorSpeed, explode, time, dt } = rig;
    for (let i = 0; i < 4; i++) {
      // Diagonal pairs counter-rotate, as on a real quadrotor.
      const dir = i === 0 || i === 3 ? 1 : -1;
      angles.current[i] += dir * rotorSpeed * dt;
      const p = props.current[i];
      if (p) p.rotation.y = angles.current[i];
      const r = rotors.current[i];
      if (r) {
        const [x, y, z] = ROTOR_POSITIONS[i];
        const d = arms[i].dir;
        r.position.set(x + d.x * explode * 0.14, y + explode * 0.05, z + d.z * explode * 0.14);
      }
    }
    m.blur.opacity = Math.min(0.42, Math.max(0, (rotorSpeed - 4) / 30));
    if (canopy.current) canopy.current.position.y = explode * 0.1;
    if (battery.current) battery.current.position.y = -explode * 0.09;
    if (gear.current) gear.current.position.y = -explode * 0.07;
    if (gimbal.current) gimbal.current.position.z = -explode * 0.09;
    if (gimbalHead.current) gimbalHead.current.rotation.x = -rig.pitch * 0.9;
    if (lights) {
      const phase = time % 1.4;
      m.strobe.emissiveIntensity = phase < 0.06 || (phase > 0.18 && phase < 0.24) ? 6 : 0;
      m.accent.emissiveIntensity = 2.1 + Math.sin(time * 2.2) * 0.35;
    }
  });

  return (
    <group ref={ref} dispose={null}>
      {/* Fuselage */}
      <mesh geometry={g.hullLower} material={m.hull} castShadow={castShadow} receiveShadow />
      <mesh geometry={g.waistRing} material={m.accent} />
      <mesh geometry={g.hullUpper} material={m.hullUpper} castShadow={castShadow} receiveShadow />
      <mesh geometry={g.seams} material={m.darkMetal} />
      <mesh geometry={g.vents} material={m.darkMetal} />
      <mesh geometry={g.spine} material={m.darkMetal} castShadow={castShadow} />
      <mesh geometry={g.lidarBase} material={m.darkMetal} />
      <mesh geometry={g.lidarBand} material={m.accent} />
      <mesh geometry={g.noseSensor} material={m.darkMetal} />
      <mesh geometry={g.eye} material={m.accent} position={[-0.022, 0.012, -0.412]} />
      <mesh geometry={g.eye} material={m.accent} position={[0.022, 0.012, -0.412]} />
      <instancedMesh ref={bolts} args={[g.bolt, m.metal, boltList.length]} />

      <group ref={canopy}>
        <mesh geometry={g.canopy} material={m.glass} castShadow={castShadow} />
      </group>

      <group ref={battery}>
        <mesh geometry={g.battery} material={m.darkMetal} castShadow={castShadow} />
        <mesh geometry={g.fins} material={m.metal} />
        <mesh position={[0, -0.074, 0.141]} material={m.accent}>
          <boxGeometry args={[0.1, 0.008, 0.002]} />
        </mesh>
      </group>

      {/* Arms */}
      {arms.map((a, i) => (
        <group key={`arm-${i}`} position={a.root} rotation={[0, a.yaw, 0]}>
          <mesh geometry={g.arm} material={m.frame} castShadow={castShadow} receiveShadow />
          <mesh geometry={g.armStrip} material={m.accent} />
          <mesh geometry={g.armHub} material={m.darkMetal} castShadow={castShadow} />
        </group>
      ))}

      {/* Rotor assemblies */}
      {ROTOR_POSITIONS.map((pos, i) => {
        const front = i < 2;
        const port = i % 2 === 0;
        const navMat = front ? (port ? m.navRed : m.navGreen) : m.strobe;
        const outward = arms[i].dir;
        return (
          <group key={`rotor-${i}`} ref={(el) => void (rotors.current[i] = el)} position={pos}>
            <mesh geometry={g.motorBase} material={m.darkMetal} castShadow={castShadow} />
            <mesh geometry={g.bell} material={m.metal} castShadow={castShadow} />
            <mesh geometry={g.motorRing} material={m.accent} />
            <mesh geometry={g.guard} material={m.frame} castShadow={castShadow} />
            <mesh
              ref={(el) => void (props.current[i] = el)}
              geometry={i === 0 || i === 3 ? g.propCW : g.propCCW}
              material={m.prop}
              castShadow={castShadow}
            />
            <mesh geometry={g.blurDisc} material={m.blur} renderOrder={2} />
            <mesh
              geometry={g.led}
              material={navMat}
              position={[outward.x * 0.272, 0.03, outward.z * 0.272]}
            />
          </group>
        );
      })}

      {/* Landing gear */}
      <group ref={gear}>
        <mesh geometry={g.struts} material={m.darkMetal} castShadow={castShadow} />
        {[-1, 1].map((side) => (
          <group key={`skid-${side}`} position={[side * 0.17, 0, 0]}>
            <mesh geometry={g.skid} material={m.frame} castShadow={castShadow} />
            <mesh geometry={g.footPad} material={m.rubber} position={[0, -0.281, -0.17]} />
            <mesh geometry={g.footPad} material={m.rubber} position={[0, -0.281, 0.17]} />
          </group>
        ))}
      </group>

      {/* Camera gimbal */}
      <group ref={gimbal} position={[0, -0.02, -0.25]}>
        <mesh geometry={g.gimbalYoke} material={m.darkMetal} castShadow={castShadow} />
        <group ref={gimbalHead} position={[0, -0.1, 0]}>
          <mesh geometry={g.gimbalBall} material={m.darkMetal} castShadow={castShadow} />
          <mesh geometry={g.lens} material={m.lens} />
          <mesh geometry={g.lensRing} material={m.accent} />
        </group>
      </group>

      {/* Antennas */}
      {[-1, 1].map((side) => (
        <group key={`ant-${side}`} position={[side * 0.075, 0.1, 0.3]} rotation={[0.55, 0, side * 0.15]}>
          <mesh geometry={g.antenna} material={m.darkMetal} />
          <mesh geometry={g.led} material={m.strobe} position={[0, 0.13, 0]} scale={0.6} />
        </group>
      ))}

      {underglow && lights && (
        <pointLight position={[0, -0.25, 0]} color={accentColor} intensity={1.6} distance={3} decay={2} />
      )}
    </group>
  );
});

