"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useLightShaftMaterial } from "@/components/three/Atmosphere";
import { frameTime } from "@/components/three/sceneTime";
import { hangarFloorTextures, hazardTexture, holoLabelTexture, wallPanelTexture } from "@/components/three/textures";
import { createRng, deriveSeed } from "@/sim/rng";

/** Architectural shell: floor, walls, ceiling trusses, lamps and blast door. */

const ROOM = { halfX: 16, halfZ: 14, height: 11 };

/** Instanced boxes from a list of transforms — one draw call per group. */
function InstancedBoxes({
  items,
  material,
  castShadow = false,
  receiveShadow = false,
}: {
  items: { p: [number, number, number]; s: [number, number, number]; r?: number }[];
  material: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(0, it.r ?? 0, 0));
      m.compose(new THREE.Vector3(...it.p), q, new THREE.Vector3(...it.s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh
      ref={ref}
      args={[geo, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    />
  );
}

export function HangarRoom({ seed, frozen, volumetrics }: { seed: number; frozen: boolean; volumetrics: boolean }) {
  const { mats, clones } = useMemo(() => {
    const floor = hangarFloorTextures(seed);
    const wall = wallPanelTexture(seed);
    const wallSide = wall.clone();
    wallSide.wrapS = wallSide.wrapT = THREE.RepeatWrapping;
    wallSide.repeat.set(6, 1);
    wallSide.needsUpdate = true;
    const wallBack = wall.clone();
    wallBack.wrapS = wallBack.wrapT = THREE.RepeatWrapping;
    wallBack.repeat.set(7, 1);
    wallBack.needsUpdate = true;
    const hazard = hazardTexture().clone();
    hazard.wrapS = hazard.wrapT = THREE.RepeatWrapping;
    hazard.repeat.set(24, 1);
    hazard.needsUpdate = true;
    const clones = [wallSide, wallBack, hazard];
    const mats = {
      floor: new THREE.MeshStandardMaterial({
        map: floor.map,
        roughnessMap: floor.rough,
        roughness: 0.75,
        metalness: 0.55,
        envMapIntensity: 0.6,
      }),
      wallSide: new THREE.MeshStandardMaterial({ map: wallSide, roughness: 0.62, metalness: 0.3 }),
      wallBack: new THREE.MeshStandardMaterial({ map: wallBack, roughness: 0.62, metalness: 0.3 }),
      structure: new THREE.MeshStandardMaterial({ color: "#20272f", roughness: 0.55, metalness: 0.75 }),
      truss: new THREE.MeshStandardMaterial({ color: "#161b21", roughness: 0.6, metalness: 0.7 }),
      door: new THREE.MeshStandardMaterial({ color: "#262d35", roughness: 0.45, metalness: 0.8 }),
      hazard: new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6, metalness: 0.2 }),
      lampCyan: new THREE.MeshStandardMaterial({ color: "#c9f7ff", emissive: "#7fe9ff", emissiveIntensity: 3, toneMapped: false }),
      lampWarm: new THREE.MeshStandardMaterial({ color: "#fff3df", emissive: "#ffe3b8", emissiveIntensity: 4, toneMapped: false }),
      stripAmber: new THREE.MeshStandardMaterial({ color: "#ff9f1c", emissive: "#ff8a00", emissiveIntensity: 2.2, toneMapped: false }),
      doorStrip: new THREE.MeshStandardMaterial({ color: "#ff9f1c", emissive: "#ff8a00", emissiveIntensity: 2, toneMapped: false }),
      sign: new THREE.MeshBasicMaterial({
        map: holoLabelTexture("door-sign", ["BAY 07 · FLIGHT TEST", "CLEARANCE 4.2 M", "PRESSURE SEAL: ARMED"], "#ffbe4d"),
        transparent: true,
        toneMapped: false,
      }),
    };
    return { mats, clones };
  }, [seed]);

  useLayoutEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      clones.forEach((t) => t.dispose());
    },
    [mats, clones],
  );

  const { pillars, trusses, girders, lamps, cableTrays } = useMemo(() => {
    const rng = createRng(deriveSeed(seed, "room"));
    const pillars: { p: [number, number, number]; s: [number, number, number] }[] = [];
    for (let x = -14; x <= 14; x += 4) {
      pillars.push({ p: [x, ROOM.height / 2, -ROOM.halfZ + 0.4], s: [0.7, ROOM.height, 0.8] });
    }
    for (let z = -10; z <= 10; z += 5) {
      pillars.push({ p: [-ROOM.halfX + 0.4, ROOM.height / 2, z], s: [0.8, ROOM.height, 0.7] });
      pillars.push({ p: [ROOM.halfX - 0.4, ROOM.height / 2, z], s: [0.8, ROOM.height, 0.7] });
    }
    const trusses: { p: [number, number, number]; s: [number, number, number] }[] = [];
    for (let z = -12; z <= 12; z += 3) {
      trusses.push({ p: [0, ROOM.height - 0.5, z], s: [ROOM.halfX * 2, 0.35, 0.25] });
      trusses.push({ p: [0, ROOM.height - 1.2, z], s: [ROOM.halfX * 2, 0.12, 0.12] });
      // Diagonal web members.
      for (let x = -14; x <= 14; x += 2) {
        trusses.push({ p: [x, ROOM.height - 0.85, z], s: [0.08, 0.75, 0.08] });
      }
    }
    const girders: { p: [number, number, number]; s: [number, number, number] }[] = [];
    for (const x of [-8, 0, 8]) girders.push({ p: [x, ROOM.height - 0.3, 0], s: [0.3, 0.3, ROOM.halfZ * 2] });
    const lamps: [number, number, number][] = [];
    for (const x of [-6, 0, 6]) for (const z of [-6, 0, 6]) lamps.push([x + (rng() - 0.5) * 0.2, ROOM.height - 1.5, z]);
    const cableTrays: { p: [number, number, number]; s: [number, number, number] }[] = [
      { p: [-ROOM.halfX + 1.2, 7.2, 0], s: [0.5, 0.12, ROOM.halfZ * 2 - 2] },
      { p: [ROOM.halfX - 1.2, 7.2, 0], s: [0.5, 0.12, ROOM.halfZ * 2 - 2] },
      { p: [0, 7.6, -ROOM.halfZ + 1.2], s: [ROOM.halfX * 2 - 2, 0.12, 0.5] },
    ];
    return { pillars, trusses, girders, lamps, cableTrays };
  }, [seed]);

  const shaftMat = useLightShaftMaterial("#9fe6ff", 0.07);
  const shaftGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.5, 2.4, 9, 24, 1, true);
    g.translate(0, -4.5, 0);
    return g;
  }, []);

  const doorStrip = useRef<THREE.Mesh>(null);
  useFrame((state, delta) => {
    const { t } = frameTime(state.clock.elapsedTime, delta, frozen);
    if (doorStrip.current) {
      const m = doorStrip.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.6 + Math.sin(t * 1.4) * 0.6;
    }
  });

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.floor}>
        <planeGeometry args={[ROOM.halfX * 2, ROOM.halfZ * 2]} />
      </mesh>
      {/* Hazard walkway border */}
      {[-1, 1].map((s) => (
        <mesh key={`hz-${s}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, s * 7.5]} material={mats.hazard} receiveShadow>
          <planeGeometry args={[ROOM.halfX * 2, 0.35]} />
        </mesh>
      ))}

      {/* Walls */}
      <mesh position={[0, ROOM.height / 2, -ROOM.halfZ]} material={mats.wallBack} receiveShadow>
        <planeGeometry args={[ROOM.halfX * 2, ROOM.height]} />
      </mesh>
      <mesh position={[-ROOM.halfX, ROOM.height / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.wallSide} receiveShadow>
        <planeGeometry args={[ROOM.halfZ * 2, ROOM.height]} />
      </mesh>
      <mesh position={[ROOM.halfX, ROOM.height / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={mats.wallSide} receiveShadow>
        <planeGeometry args={[ROOM.halfZ * 2, ROOM.height]} />
      </mesh>
      <mesh position={[0, ROOM.height / 2, ROOM.halfZ]} rotation={[0, Math.PI, 0]} material={mats.wallBack}>
        <planeGeometry args={[ROOM.halfX * 2, ROOM.height]} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, ROOM.height, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.halfX * 2, ROOM.halfZ * 2]} />
        <meshStandardMaterial color="#07090c" roughness={0.9} />
      </mesh>

      <InstancedBoxes items={pillars} material={mats.structure} castShadow receiveShadow />
      <InstancedBoxes items={trusses} material={mats.truss} />
      <InstancedBoxes items={girders} material={mats.truss} />
      <InstancedBoxes items={cableTrays} material={mats.structure} />

      {/* Blast door in the back wall */}
      <group position={[0, 0, -ROOM.halfZ + 0.15]}>
        <mesh position={[0, 4, 0]} material={mats.door} receiveShadow castShadow>
          <boxGeometry args={[11, 8, 0.3]} />
        </mesh>
        {[-2.75, 2.75].map((x) => (
          <mesh key={`dp-${x}`} position={[x, 4, 0.17]} material={mats.structure}>
            <boxGeometry args={[5.2, 7.6, 0.06]} />
          </mesh>
        ))}
        <mesh ref={doorStrip} position={[0, 4, 0.22]} material={mats.doorStrip}>
          <boxGeometry args={[0.06, 7.6, 0.04]} />
        </mesh>
        <mesh position={[0, 8.25, 0.1]} material={mats.hazard}>
          <boxGeometry args={[11.6, 0.5, 0.3]} />
        </mesh>
        <mesh position={[3.2, 6.6, 0.22]} material={mats.sign}>
          <planeGeometry args={[2.6, 1.3]} />
        </mesh>
        {/* Door status lamps */}
        {[-5.9, 5.9].map((x) => (
          <mesh key={`dl-${x}`} position={[x, 7.4, 0.25]} material={mats.stripAmber}>
            <boxGeometry args={[0.18, 0.5, 0.08]} />
          </mesh>
        ))}
      </group>

      {/* Cyan wall light bands */}
      {[-1, 1].map((s) => (
        <mesh key={`band-${s}`} position={[s * (ROOM.halfX - 0.05), 3.2, 0]} rotation={[0, (-s * Math.PI) / 2, 0]} material={mats.lampCyan}>
          <planeGeometry args={[ROOM.halfZ * 2 - 1, 0.07]} />
        </mesh>
      ))}
      {[-10.5, 10.5].map((x) => (
        <mesh key={`bband-${x}`} position={[x, 3.2, -ROOM.halfZ + 0.9]} material={mats.lampCyan}>
          <boxGeometry args={[7, 0.07, 0.05]} />
        </mesh>
      ))}

      {/* Ceiling lamp fixtures + light shafts */}
      {lamps.map((p, i) => (
        <group key={`lamp-${i}`} position={p}>
          <mesh material={mats.structure}>
            <boxGeometry args={[1.6, 0.18, 0.7]} />
          </mesh>
          <mesh position={[0, -0.1, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.lampWarm}>
            <planeGeometry args={[1.4, 0.5]} />
          </mesh>
          {volumetrics && <mesh geometry={shaftGeo} material={shaftMat} position={[0, -0.1, 0]} />}
        </group>
      ))}
    </group>
  );
}

export const HANGAR_ROOM = ROOM;
