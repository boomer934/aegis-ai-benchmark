"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { frameTime } from "@/components/three/sceneTime";
import { arenaFloorTexture, gateNumberTexture, hazardTexture } from "@/components/three/textures";
import { ARENA, GATE_FRAME_THICKNESS, type BoxObstacle, type CylinderObstacle, type Gate } from "@/sim/arena";
import { createRng, deriveSeed } from "@/sim/rng";

/**
 * Flight-test arena rendered from the same ARENA definition the physics uses:
 * every pillar, block and gate frame drawn here is exactly a collision volume.
 */

const B = ARENA.bounds;
const SIZE_X = B.maxX - B.minX;
const SIZE_Z = B.maxZ - B.minZ;
const CENTER_X = (B.maxX + B.minX) / 2;
const CENTER_Z = (B.maxZ + B.minZ) / 2;

function useArenaMaterials() {
  const mats = useMemo(() => {
    const hz = hazardTexture().clone();
    hz.wrapS = hz.wrapT = THREE.RepeatWrapping;
    hz.repeat.set(4, 1);
    hz.needsUpdate = true;
    return {
      hz,
      floor: new THREE.MeshStandardMaterial({ map: arenaFloorTexture(), roughness: 0.82, metalness: 0.35 }),
      pillar: new THREE.MeshStandardMaterial({ color: "#2a323b", roughness: 0.5, metalness: 0.7 }),
      block: new THREE.MeshStandardMaterial({ color: "#232a32", roughness: 0.55, metalness: 0.6 }),
      hazard: new THREE.MeshStandardMaterial({ map: hz, roughness: 0.6, metalness: 0.2 }),
      edge: new THREE.LineBasicMaterial({ color: "#ff9f1c", transparent: true, opacity: 0.85, toneMapped: false }),
      bandAmber: new THREE.MeshStandardMaterial({ color: "#ff9f1c", emissive: "#ff8a00", emissiveIntensity: 1.8, toneMapped: false }),
      bandCyan: new THREE.MeshStandardMaterial({ color: "#4fe3fb", emissive: "#4fe3fb", emissiveIntensity: 1.6, toneMapped: false }),
      tower: new THREE.MeshStandardMaterial({ color: "#10151b", roughness: 0.7, metalness: 0.5 }),
      gateFrame: new THREE.MeshStandardMaterial({ color: "#1c2228", roughness: 0.35, metalness: 0.85 }),
    };
  }, []);
  useEffect(
    () => () => {
      mats.hz.dispose();
      Object.values(mats).forEach((m) => {
        if (m instanceof THREE.Material) m.dispose();
      });
    },
    [mats],
  );
  return mats;
}

/** Energy-field boundary walls: grid shader fading upward. */
function BoundaryField({ frozen }: { frozen: boolean }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#4fe3fb") } },
        vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
          void main(){
            vec2 g = abs(fract(vec2(vW.x + vW.z, vW.y) / 4.0) - 0.5);
            float line = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
            float base = 1.0 - smoothstep(0.0, 0.5, vUv.y);
            float sweep = smoothstep(0.96, 1.0, fract(vUv.y * 1.0 - uTime * 0.08));
            float a = (line * 0.12 + base * 0.22 + sweep * 0.12) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
            gl_FragColor = vec4(uColor, a);
          }
        `,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((state, delta) => {
    mat.uniforms.uTime.value = frameTime(state.clock.elapsedTime, delta, frozen).t;
  });
  const h = B.ceilingY;
  return (
    <group>
      <mesh position={[CENTER_X, h / 2, B.minZ]} material={mat}>
        <planeGeometry args={[SIZE_X, h]} />
      </mesh>
      <mesh position={[CENTER_X, h / 2, B.maxZ]} material={mat}>
        <planeGeometry args={[SIZE_X, h]} />
      </mesh>
      <mesh position={[B.minX, h / 2, CENTER_Z]} rotation={[0, Math.PI / 2, 0]} material={mat}>
        <planeGeometry args={[SIZE_Z, h]} />
      </mesh>
      <mesh position={[B.maxX, h / 2, CENTER_Z]} rotation={[0, Math.PI / 2, 0]} material={mat}>
        <planeGeometry args={[SIZE_Z, h]} />
      </mesh>
    </group>
  );
}

/** Instanced exterior towers and ceiling trusses for depth outside the field. */
function Surroundings({ seed, mats }: { seed: number; mats: ReturnType<typeof useArenaMaterials> }) {
  const towers = useRef<THREE.InstancedMesh>(null);
  const trusses = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const data = useMemo(() => {
    const rng = createRng(deriveSeed(seed, "towers"));
    const towers: THREE.Matrix4[] = [];
    const lamps: THREE.Matrix4[] = [];
    const add = (x: number, z: number) => {
      const w = 6 + rng() * 10;
      const h = 18 + rng() * 40;
      const d = 6 + rng() * 10;
      towers.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d)));
      lamps.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.3, z), new THREE.Quaternion(), new THREE.Vector3(w * 0.6, 0.25, 0.25)));
    };
    for (let z = B.minZ; z <= B.maxZ; z += 22) {
      add(B.minX - 14 - rng() * 10, z + rng() * 8);
      add(B.maxX + 14 + rng() * 10, z + rng() * 8);
    }
    for (let x = B.minX; x <= B.maxX; x += 24) add(x + rng() * 8, B.minZ - 16 - rng() * 10);
    const trusses: THREE.Matrix4[] = [];
    for (let z = B.minZ + 8; z < B.maxZ; z += 16) {
      trusses.push(new THREE.Matrix4().compose(new THREE.Vector3(CENTER_X, B.ceilingY + 0.6, z), new THREE.Quaternion(), new THREE.Vector3(SIZE_X, 0.6, 0.5)));
    }
    for (let x = B.minX + 15; x < B.maxX; x += 30) {
      trusses.push(new THREE.Matrix4().compose(new THREE.Vector3(x, B.ceilingY + 0.9, CENTER_Z), new THREE.Quaternion(), new THREE.Vector3(0.5, 0.6, SIZE_Z)));
    }
    return { towers, lamps, trusses };
  }, [seed]);
  useLayoutEffect(() => {
    const apply = (mesh: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => {
      if (!mesh) return;
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    apply(towers.current, data.towers);
    apply(trusses.current, data.trusses);
    apply(lamps.current, data.lamps);
  }, [data]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <instancedMesh ref={towers} args={[geo, mats.tower, data.towers.length]} receiveShadow />
      <instancedMesh ref={lamps} args={[geo, mats.bandAmber, data.lamps.length]} />
      <instancedMesh ref={trusses} args={[geo, mats.tower, data.trusses.length]} />
    </group>
  );
}

function Pillar({ o, mats }: { o: CylinderObstacle; mats: ReturnType<typeof useArenaMaterials> }) {
  const h = o.maxY - o.minY;
  const mast = o.role === "mast";
  return (
    <group position={[o.x, o.minY, o.z]}>
      <mesh position={[0, h / 2, 0]} material={mats.pillar} castShadow receiveShadow>
        <cylinderGeometry args={[o.radius, o.radius * 1.04, h, mast ? 12 : 24]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={mats.hazard}>
        <cylinderGeometry args={[o.radius + 0.02, o.radius + 0.02, 1.6, mast ? 12 : 24, 1, true]} />
      </mesh>
      {[0.3, 0.62].map((f) => (
        <mesh key={f} position={[0, h * f, 0]} material={mast ? mats.bandAmber : mats.bandCyan}>
          <cylinderGeometry args={[o.radius + 0.03, o.radius + 0.03, 0.18, mast ? 12 : 24, 1, true]} />
        </mesh>
      ))}
      {mast && (
        <mesh position={[0, h + 0.3, 0]} material={mats.bandAmber}>
          <sphereGeometry args={[0.35, 12, 8]} />
        </mesh>
      )}
    </group>
  );
}

function Block({ o, mats }: { o: BoxObstacle; mats: ReturnType<typeof useArenaMaterials> }) {
  const size: [number, number, number] = [o.half.x * 2, o.half.y * 2, o.half.z * 2];
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size[0], size[1], size[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group position={[o.center.x, o.center.y, o.center.z]} rotation={[0, o.yaw, 0]}>
      <mesh material={o.role === "beam" ? mats.pillar : mats.block} castShadow receiveShadow>
        <boxGeometry args={size} />
      </mesh>
      <lineSegments geometry={edges} material={mats.edge} />
      {o.role === "wall" && (
        <mesh position={[0, -o.half.y + 0.5, o.half.z + 0.01]} material={mats.hazard}>
          <planeGeometry args={[size[0], 0.5]} />
        </mesh>
      )}
    </group>
  );
}

export type GateState = "cleared" | "next" | "pending";

const GATE_COLORS: Record<GateState, string> = { cleared: "#3df2a5", next: "#4fe3fb", pending: "#ff9f1c" };

function GateMesh({
  gate,
  state,
  frozen,
  mats,
}: {
  gate: Gate;
  state: GateState;
  frozen: boolean;
  mats: ReturnType<typeof useArenaMaterials>;
}) {
  const t = GATE_FRAME_THICKNESS;
  const hw = gate.halfWidth;
  const hh = gate.halfHeight;
  const local = useMemo(() => {
    const strip = new THREE.MeshStandardMaterial({ color: "#000", emissive: "#fff", emissiveIntensity: 2, toneMapped: false });
    const membrane = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color("#fff") }, uTime: { value: 0 }, uStrength: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uTime; uniform float uStrength; varying vec2 vUv;
        void main(){
          vec2 d = abs(vUv - 0.5) * 2.0;
          float edge = smoothstep(0.75, 1.0, max(d.x, d.y));
          float scan = smoothstep(0.0, 0.08, 0.08 - abs(fract(vUv.y - uTime * 0.35) - 0.5) + 0.42) * 0.25;
          float hex = step(0.94, fract((vUv.x + vUv.y * 0.5) * 18.0)) * 0.12;
          gl_FragColor = vec4(uColor, (edge * 0.4 + scan * 0.5 + hex + 0.02) * uStrength);
        }
      `,
    });
    const number = new THREE.MeshBasicMaterial({ map: gateNumberTexture(gate.number), toneMapped: false });
    return { strip, membrane, number };
  }, [gate.number]);
  useEffect(
    () => () => {
      local.strip.dispose();
      local.membrane.dispose();
      local.number.dispose();
    },
    [local],
  );
  useEffect(() => {
    const c = new THREE.Color(GATE_COLORS[state]);
    local.strip.emissive.copy(c);
    local.strip.emissiveIntensity = state === "pending" ? 0.9 : 2.2;
    local.membrane.uniforms.uColor.value.copy(c);
    local.membrane.uniforms.uStrength.value = state === "next" ? 1 : state === "cleared" ? 0.35 : 0.3;
    local.number.color.set(state === "pending" ? "#ffcf8a" : GATE_COLORS[state]);
  }, [state, local]);
  useFrame((s, delta) => {
    const ft = frameTime(s.clock.elapsedTime, delta, frozen);
    local.membrane.uniforms.uTime.value = ft.t;
    if (state === "next") local.strip.emissiveIntensity = 2 + Math.sin(ft.t * 5) * 0.8;
  });

  return (
    <group position={[gate.center.x, gate.center.y, gate.center.z]} rotation={[0, gate.yaw, 0]}>
      {/* Frame: same boxes as the collision volumes */}
      {[-1, 1].map((s) => (
        <mesh key={`post${s}`} position={[s * (hw + t / 2), 0, 0]} material={mats.gateFrame} castShadow>
          <boxGeometry args={[t, hh * 2 + t * 2, t]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`bar${s}`} position={[0, s * (hh + t / 2), 0]} material={mats.gateFrame} castShadow>
          <boxGeometry args={[hw * 2, t, t]} />
        </mesh>
      ))}
      {/* Emissive inner edge strips (both faces) */}
      {[-1, 1].map((face) => (
        <group key={`f${face}`} position={[0, 0, face * (t / 2 + 0.005)]}>
          {[-1, 1].map((s) => (
            <mesh key={`sv${s}`} position={[s * (hw + 0.04), 0, 0]} material={local.strip}>
              <boxGeometry args={[0.08, hh * 2, 0.01]} />
            </mesh>
          ))}
          {[-1, 1].map((s) => (
            <mesh key={`sh${s}`} position={[0, s * (hh + 0.04), 0]} material={local.strip}>
              <boxGeometry args={[hw * 2, 0.08, 0.01]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Support legs to the floor */}
      {[-1, 1].map((s) => {
        const legH = gate.center.y - hh - t;
        return legH > 0.2 ? (
          <mesh key={`leg${s}`} position={[s * (hw + t / 2), -hh - t - legH / 2, 0]} material={mats.pillar}>
            <boxGeometry args={[0.22, legH, 0.22]} />
          </mesh>
        ) : null;
      })}
      <mesh material={local.membrane} renderOrder={2}>
        <planeGeometry args={[hw * 2, hh * 2]} />
      </mesh>
      {/* Number plates, readable from the approach side */}
      <mesh position={[0, hh + t + 0.75, t / 2 + 0.02]} material={local.number}>
        <planeGeometry args={[1.3, 1.3]} />
      </mesh>
      <mesh position={[0, hh + t + 0.75, 0]} material={mats.gateFrame}>
        <boxGeometry args={[1.45, 1.45, t * 0.8]} />
      </mesh>
      <mesh position={[0, hh + t + 0.75, -t / 2 - 0.02]} rotation={[0, Math.PI, 0]} material={local.number}>
        <planeGeometry args={[1.3, 1.3]} />
      </mesh>
    </group>
  );
}

/** Beacon column above the next gate. */
function Beacon({ gate, frozen }: { gate: Gate | undefined; frozen: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#4fe3fb",
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((s, delta) => {
    const { t } = frameTime(s.clock.elapsedTime, delta, frozen);
    mat.opacity = 0.14 + Math.sin(t * 3) * 0.05;
  });
  if (!gate) return null;
  const top = B.ceilingY;
  const bottom = gate.center.y + gate.halfHeight + 1.6;
  return (
    <mesh ref={ref} position={[gate.center.x, (top + bottom) / 2, gate.center.z]} material={mat}>
      <cylinderGeometry args={[0.35, 0.9, top - bottom, 16, 1, true]} />
    </mesh>
  );
}

/** Flowing dashed guide line through the gates in order. */
function FlightPath({ nextGate, frozen }: { nextGate: number; frozen: boolean }) {
  const { geometry, material, segments } = useMemo(() => {
    const pts: THREE.Vector3[] = [new THREE.Vector3(ARENA.start.x, 1.2, ARENA.start.z)];
    const segments: number[] = [0];
    for (const g of ARENA.gates) {
      const n = g.normal;
      pts.push(new THREE.Vector3(g.center.x - n.x * 5, g.center.y, g.center.z - n.z * 5));
      pts.push(new THREE.Vector3(g.center.x, g.center.y, g.center.z));
      pts.push(new THREE.Vector3(g.center.x + n.x * 4, g.center.y, g.center.z + n.z * 4));
      segments.push(pts.length - 2);
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const geometry = new THREE.TubeGeometry(curve, 600, 0.045, 6, false);
    // Map each gate's control-point index to its curve parameter (uv.x).
    const segT = segments.map((i) => i / (pts.length - 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDone: { value: 0 },
        uNext: { value: segT[1] },
        uColor: { value: new THREE.Color("#4fe3fb") },
        uAmber: { value: new THREE.Color("#ff9f1c") },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uDone; uniform float uNext; uniform vec3 uColor; uniform vec3 uAmber; varying vec2 vUv;
        void main(){
          float dash = step(0.45, fract(vUv.x * 220.0 - uTime * 1.6));
          float act = step(uDone, vUv.x) * step(vUv.x, uNext);
          float future = step(uNext, vUv.x);
          vec3 col = mix(uAmber, uColor, act);
          float a = dash * (act * 0.95 + future * 0.28) + (1.0 - step(uDone, vUv.x)) * 0.04;
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    return { geometry, material, segments: segT };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useEffect(() => {
    material.uniforms.uDone.value = segments[Math.min(nextGate, segments.length - 1)];
    material.uniforms.uNext.value = segments[Math.min(nextGate + 1, segments.length - 1)] + (nextGate >= 5 ? 1 : 0);
  }, [nextGate, material, segments]);
  useFrame((s, delta) => {
    material.uniforms.uTime.value = frameTime(s.clock.elapsedTime, delta, frozen).t;
  });
  return <mesh geometry={geometry} material={material} renderOrder={1} />;
}

function StartPad({ mats }: { mats: ReturnType<typeof useArenaMaterials> }) {
  return (
    <group position={[ARENA.start.x, 0, ARENA.start.z]}>
      <mesh position={[0, 0.03, 0]} material={mats.block} receiveShadow>
        <cylinderGeometry args={[2.2, 2.4, 0.06, 8]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.065, 0]} material={mats.bandCyan}>
        <ringGeometry args={[1.9, 2.0, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.065, 0]} material={mats.bandAmber}>
        <ringGeometry args={[0.9, 0.95, 48, 1, 0, Math.PI * 1.5]} />
      </mesh>
    </group>
  );
}

export function Arena({ nextGate, frozen, seed }: { nextGate: number; frozen: boolean; seed: number }) {
  const mats = useArenaMaterials();
  const course = useMemo(() => ARENA.obstacles.filter((o) => o.kind === "cylinder" || o.role !== "gate-frame"), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, 0, CENTER_Z]} material={mats.floor} receiveShadow>
        <planeGeometry args={[SIZE_X, SIZE_Z]} />
      </mesh>
      {/* Outer apron beyond the field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CENTER_X, -0.02, CENTER_Z]}>
        <planeGeometry args={[SIZE_X + 160, SIZE_Z + 160]} />
        <meshStandardMaterial color="#07090c" roughness={0.95} />
      </mesh>
      <BoundaryField frozen={frozen} />
      <Surroundings seed={seed} mats={mats} />
      <StartPad mats={mats} />
      {course.map((o) =>
        o.kind === "cylinder" ? <Pillar key={o.id} o={o} mats={mats} /> : <Block key={o.id} o={o} mats={mats} />,
      )}
      {ARENA.gates.map((g, i) => (
        <GateMesh
          key={g.number}
          gate={g}
          frozen={frozen}
          mats={mats}
          state={i < nextGate ? "cleared" : i === nextGate ? "next" : "pending"}
        />
      ))}
      <Beacon gate={ARENA.gates[nextGate]} frozen={frozen} />
      <FlightPath nextGate={nextGate} frozen={frozen} />
    </group>
  );
}
