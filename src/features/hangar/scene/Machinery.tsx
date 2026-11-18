"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { frameTime } from "@/components/three/sceneTime";
import { hazardTexture, holoLabelTexture } from "@/components/three/textures";
import { createRng, deriveSeed } from "@/sim/rng";

/** Decorative facility equipment: robot arm, gantry crane, server racks, crates, gas cylinders, workstation. */

function useMachineMaterials() {
  const mats = useMemo(
    () => ({
      paintedOrange: new THREE.MeshStandardMaterial({ color: "#c96a12", metalness: 0.5, roughness: 0.45 }),
      steel: new THREE.MeshStandardMaterial({ color: "#3a434d", metalness: 0.85, roughness: 0.35 }),
      dark: new THREE.MeshStandardMaterial({ color: "#14191f", metalness: 0.6, roughness: 0.5 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#c4ccd4", metalness: 1, roughness: 0.18 }),
      rack: new THREE.MeshStandardMaterial({ color: "#0d1116", metalness: 0.5, roughness: 0.6 }),
      crate: new THREE.MeshStandardMaterial({ color: "#2b3138", metalness: 0.3, roughness: 0.7 }),
      crateHazard: new THREE.MeshStandardMaterial({ map: hazardTexture(), metalness: 0.2, roughness: 0.6 }),
      gas: new THREE.MeshStandardMaterial({ color: "#5b6670", metalness: 0.7, roughness: 0.3 }),
      gasBand: new THREE.MeshStandardMaterial({ color: "#ff9f1c", emissive: "#ff7a00", emissiveIntensity: 0.6 }),
      led: new THREE.MeshBasicMaterial({ toneMapped: false }),
      screenA: new THREE.MeshBasicMaterial({
        map: holoLabelTexture("ws-a", ["TELEMETRY LINK", "CH 07  ▮▮▮▮▮▯", "LATENCY 4 ms", "PACKET LOSS 0.00%"]),
        toneMapped: false,
      }),
      screenB: new THREE.MeshBasicMaterial({
        map: holoLabelTexture("ws-b", ["ROTOR BALANCE", "M1 0.02g  M2 0.03g", "M3 0.02g  M4 0.01g", "STATUS NOMINAL"], "#ffbe4d"),
        toneMapped: false,
      }),
    }),
    [],
  );
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

function RobotArm({ frozen, mats }: { frozen: boolean; mats: ReturnType<typeof useMachineMaterials> }) {
  const turret = useRef<THREE.Group>(null);
  const shoulder = useRef<THREE.Group>(null);
  const elbow = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const { t } = frameTime(state.clock.elapsedTime, delta, frozen);
    if (turret.current) turret.current.rotation.y = 0.9 + Math.sin(t * 0.25) * 0.35;
    if (shoulder.current) shoulder.current.rotation.z = -0.55 + Math.sin(t * 0.33) * 0.12;
    if (elbow.current) elbow.current.rotation.z = 1.25 + Math.sin(t * 0.41 + 1) * 0.15;
  });
  return (
    <group position={[7.5, 0, -9.5]} rotation={[0, -0.6, 0]}>
      <mesh position={[0, 0.2, 0]} material={mats.dark} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.05, 0.4, 24]} />
      </mesh>
      <group ref={turret} position={[0, 0.4, 0]}>
        <mesh position={[0, 0.35, 0]} material={mats.paintedOrange} castShadow>
          <cylinderGeometry args={[0.55, 0.65, 0.7, 24]} />
        </mesh>
        <group ref={shoulder} position={[0, 0.85, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.steel} castShadow>
            <cylinderGeometry args={[0.32, 0.32, 0.7, 20]} />
          </mesh>
          <mesh position={[0, 1.3, 0]} material={mats.paintedOrange} castShadow>
            <boxGeometry args={[0.42, 2.6, 0.45]} />
          </mesh>
          <group ref={elbow} position={[0, 2.6, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.steel} castShadow>
              <cylinderGeometry args={[0.26, 0.26, 0.55, 20]} />
            </mesh>
            <mesh position={[0, 1.05, 0]} material={mats.paintedOrange} castShadow>
              <boxGeometry args={[0.32, 2.1, 0.34]} />
            </mesh>
            <group position={[0, 2.15, 0]}>
              <mesh material={mats.chrome} castShadow>
                <cylinderGeometry args={[0.16, 0.2, 0.25, 16]} />
              </mesh>
              {[-1, 1].map((s) => (
                <mesh key={s} position={[s * 0.1, 0.25, 0]} material={mats.dark} castShadow>
                  <boxGeometry args={[0.05, 0.3, 0.12]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function GantryCrane({ frozen, mats }: { frozen: boolean; mats: ReturnType<typeof useMachineMaterials> }) {
  const bridge = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const { t } = frameTime(state.clock.elapsedTime, delta, frozen);
    if (bridge.current) bridge.current.position.z = -4 + Math.sin(t * 0.08) * 3;
    if (trolley.current) trolley.current.position.x = Math.sin(t * 0.13) * 4;
  });
  return (
    <group position={[0, 8.6, 0]}>
      {[-9, 9].map((x) => (
        <mesh key={x} position={[x, 0, 0]} material={mats.steel} castShadow>
          <boxGeometry args={[0.35, 0.45, 26]} />
        </mesh>
      ))}
      <group ref={bridge}>
        <mesh material={mats.paintedOrange} castShadow>
          <boxGeometry args={[18.4, 0.6, 0.7]} />
        </mesh>
        <mesh position={[0, -0.36, 0]} material={mats.crateHazard}>
          <boxGeometry args={[18.4, 0.12, 0.72]} />
        </mesh>
        <group ref={trolley} position={[0, -0.55, 0]}>
          <mesh material={mats.dark} castShadow>
            <boxGeometry args={[1.1, 0.5, 1.1]} />
          </mesh>
          <mesh position={[0, -1.8, 0]} material={mats.steel}>
            <cylinderGeometry args={[0.02, 0.02, 3.2, 6]} />
          </mesh>
          <mesh position={[0, -3.5, 0]} material={mats.paintedOrange} castShadow>
            <boxGeometry args={[0.5, 0.35, 0.5]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function ServerRacks({ seed, mats }: { seed: number; mats: ReturnType<typeof useMachineMaterials> }) {
  const leds = useRef<THREE.InstancedMesh>(null);
  const ledData = useMemo(() => {
    const rng = createRng(deriveSeed(seed, "rack-leds"));
    const out: { p: THREE.Vector3; c: THREE.Color }[] = [];
    const palette = ["#4fe3fb", "#3df2a5", "#ff9f1c", "#4fe3fb", "#4fe3fb"];
    for (let r = 0; r < 4; r++) {
      for (let row = 0; row < 14; row++) {
        for (let col = 0; col < 4; col++) {
          if (rng() < 0.35) continue;
          out.push({
            p: new THREE.Vector3(r * 1.1 - 1.65 + (col - 1.5) * 0.14, 0.5 + row * 0.16, 0.36),
            c: new THREE.Color(palette[Math.floor(rng() * palette.length)]).multiplyScalar(0.6 + rng() * 1.4),
          });
        }
      }
    }
    return out;
  }, [seed]);
  const ledGeo = useMemo(() => new THREE.BoxGeometry(0.06, 0.025, 0.01), []);
  useLayoutEffect(() => {
    const mesh = leds.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    ledData.forEach((d, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(d.p.x, d.p.y, d.p.z));
      mesh.setColorAt(i, d.c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [ledData]);
  useEffect(() => () => ledGeo.dispose(), [ledGeo]);
  return (
    <group position={[-13.8, 0, 6.5]} rotation={[0, Math.PI / 2, 0]}>
      {Array.from({ length: 4 }, (_, r) => (
        <mesh key={r} position={[r * 1.1 - 1.65, 1.3, 0]} material={mats.rack} castShadow receiveShadow>
          <boxGeometry args={[1, 2.6, 0.7]} />
        </mesh>
      ))}
      <instancedMesh ref={leds} args={[ledGeo, mats.led, ledData.length]} />
    </group>
  );
}

function Storage({ seed, mats }: { seed: number; mats: ReturnType<typeof useMachineMaterials> }) {
  const crates = useMemo(() => {
    const rng = createRng(deriveSeed(seed, "crates"));
    const out: { p: [number, number, number]; s: [number, number, number]; r: number; hazard: boolean }[] = [];
    const stacks: [number, number][] = [
      [10.5, -8],
      [12.2, -6.2],
      [11, -3.8],
      [-11.5, -10.5],
    ];
    for (const [x, z] of stacks) {
      let y = 0;
      const levels = 1 + Math.floor(rng() * 3);
      for (let l = 0; l < levels; l++) {
        const w = 1.1 + rng() * 0.6;
        const h = 0.6 + rng() * 0.5;
        out.push({ p: [x + (rng() - 0.5) * 0.2, y + h / 2, z + (rng() - 0.5) * 0.2], s: [w, h, w * 0.8], r: (rng() - 0.5) * 0.3, hazard: rng() > 0.6 });
        y += h;
      }
    }
    return out;
  }, [seed]);
  return (
    <group>
      {crates.map((c, i) => (
        <group key={i} position={c.p} rotation={[0, c.r, 0]}>
          <mesh material={mats.crate} castShadow receiveShadow>
            <boxGeometry args={c.s} />
          </mesh>
          {c.hazard && (
            <mesh position={[0, c.s[1] * 0.3, c.s[2] / 2 + 0.005]} material={mats.crateHazard}>
              <planeGeometry args={[c.s[0] * 0.9, 0.12]} />
            </mesh>
          )}
        </group>
      ))}
      {/* Gas cylinder bank */}
      <group position={[13.2, 0, 3]}>
        {Array.from({ length: 6 }, (_, i) => (
          <group key={i} position={[(i % 2) * 0.55, 0, Math.floor(i / 2) * 0.55]}>
            <mesh position={[0, 0.9, 0]} material={mats.gas} castShadow>
              <cylinderGeometry args={[0.22, 0.22, 1.8, 18]} />
            </mesh>
            <mesh position={[0, 1.85, 0]} material={mats.gas}>
              <sphereGeometry args={[0.22, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh position={[0, 1.4, 0]} material={mats.gasBand}>
              <cylinderGeometry args={[0.225, 0.225, 0.12, 18]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0.27, 1.2, -0.35]} material={mats.steel}>
          <boxGeometry args={[1.2, 0.05, 0.05]} />
        </mesh>
      </group>
    </group>
  );
}

function Workstation({ mats }: { mats: ReturnType<typeof useMachineMaterials> }) {
  return (
    <group position={[-7.5, 0, -8.5]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.9, 0]} material={mats.steel} castShadow receiveShadow>
        <boxGeometry args={[2.6, 0.08, 1]} />
      </mesh>
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]} material={mats.dark} castShadow>
          <boxGeometry args={[0.08, 0.9, 0.9]} />
        </mesh>
      ))}
      {[
        [-0.65, mats.screenA],
        [0.65, mats.screenB],
      ].map(([x, mat], i) => (
        <group key={i} position={[x as number, 1.45, -0.25]} rotation={[-0.08, i === 0 ? 0.18 : -0.18, 0]}>
          <mesh material={mats.dark} castShadow>
            <boxGeometry args={[1.15, 0.7, 0.05]} />
          </mesh>
          <mesh position={[0, 0, 0.028]} material={mat as THREE.Material}>
            <planeGeometry args={[1.05, 0.6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Machinery({ seed, frozen }: { seed: number; frozen: boolean }) {
  const mats = useMachineMaterials();
  return (
    <group>
      <RobotArm frozen={frozen} mats={mats} />
      <GantryCrane frozen={frozen} mats={mats} />
      <ServerRacks seed={seed} mats={mats} />
      <Storage seed={seed} mats={mats} />
      <Workstation mats={mats} />
    </group>
  );
}
