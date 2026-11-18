"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { frameTime } from "@/components/three/sceneTime";
import { hazardTexture, padMarkingTexture } from "@/components/three/textures";

/** Illuminated octagonal landing platform with a slow scanning ring. */
export function Platform({ frozen, accent }: { frozen: boolean; accent: string }) {
  const mats = useMemo(() => {
    const hz = hazardTexture().clone();
    hz.wrapS = hz.wrapT = THREE.RepeatWrapping;
    hz.repeat.set(18, 1);
    hz.needsUpdate = true;
    return {
      hz,
      base: new THREE.MeshStandardMaterial({ color: "#1b2129", metalness: 0.85, roughness: 0.35 }),
      top: new THREE.MeshStandardMaterial({
        color: "#0f1318",
        metalness: 0.6,
        roughness: 0.62,
        envMapIntensity: 0.35,
      }),
      hazard: new THREE.MeshStandardMaterial({ map: hz, metalness: 0.3, roughness: 0.5 }),
      decal: new THREE.MeshBasicMaterial({
        map: padMarkingTexture(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      glow: new THREE.MeshStandardMaterial({
        color: "#0b2a33",
        emissive: "#4fe3fb",
        emissiveIntensity: 0.85,
        toneMapped: false,
      }),
      scan: new THREE.MeshBasicMaterial({
        color: "#4fe3fb",
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
      light: new THREE.MeshStandardMaterial({
        color: "#fff",
        emissive: "#ffb64d",
        emissiveIntensity: 3,
        toneMapped: false,
      }),
    };
  }, []);

  useEffect(() => {
    mats.glow.emissive.set(accent);
    mats.scan.color.set(accent);
  }, [accent, mats]);

  useEffect(
    () => () => {
      mats.hz.dispose();
      Object.values(mats).forEach((m) => {
        if (m instanceof THREE.Material) m.dispose();
      });
    },
    [mats],
  );

  const scanRing = useRef<THREE.Mesh>(null);
  const rotor = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const { t } = frameTime(state.clock.elapsedTime, delta, frozen);
    if (rotor.current) rotor.current.rotation.y = t * 0.15;
    if (scanRing.current) {
      const k = (t * 0.35) % 1;
      scanRing.current.scale.setScalar(0.4 + k * 0.75);
      (scanRing.current.material as THREE.MeshBasicMaterial).opacity = 0.3 * (1 - k);
    }
  });

  const R = 2.6;
  return (
    <group>
      {/* Stepped octagonal plinth */}
      <mesh position={[0, 0.06, 0]} material={mats.base} castShadow receiveShadow>
        <cylinderGeometry args={[R + 0.35, R + 0.5, 0.12, 8]} />
      </mesh>
      <mesh position={[0, 0.16, 0]} material={mats.hazard} receiveShadow>
        <cylinderGeometry args={[R + 0.12, R + 0.3, 0.08, 8, 1, true]} />
      </mesh>
      <mesh position={[0, 0.17, 0]} material={mats.top} receiveShadow>
        <cylinderGeometry args={[R + 0.1, R + 0.12, 0.1, 8]} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 8]}
        position={[0, 0.222, 0]}
        material={mats.decal}
      >
        <circleGeometry args={[R, 64]} />
      </mesh>
      {/* Emissive inlay rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.224, 0]} material={mats.glow}>
        <ringGeometry args={[R - 0.06, R, 96]} />
      </mesh>
      {/* Edge marker lights */}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        return (
          <mesh
            key={`ml-${i}`}
            position={[Math.cos(a) * (R + 0.36), 0.13, Math.sin(a) * (R + 0.36)]}
            material={mats.light}
          >
            <boxGeometry args={[0.12, 0.05, 0.12]} />
          </mesh>
        );
      })}
      {/* Rotating holo-scanner ring + expanding scan pulse */}
      <group ref={rotor} position={[0, 0.25, 0]}>
        {Array.from({ length: 3 }, (_, i) => (
          <mesh
            key={`arc-${i}`}
            rotation={[-Math.PI / 2, 0, (i * Math.PI * 2) / 3]}
            material={mats.glow}
          >
            <ringGeometry args={[R + 0.55, R + 0.575, 48, 1, 0, Math.PI / 2.4]} />
          </mesh>
        ))}
      </group>
      <mesh
        ref={scanRing}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.23, 0]}
        material={mats.scan}
      >
        <ringGeometry args={[R * 0.98, R, 96]} />
      </mesh>
    </group>
  );
}
