"use client";

import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { DustParticles } from "@/components/three/Atmosphere";
import { createDroneRig, Drone } from "@/components/three/drone/Drone";
import { frameTime } from "@/components/three/sceneTime";
import { holoLabelTexture } from "@/components/three/textures";
import { PAINTS, QUALITY_PROFILES, type PaintId, type QualityId } from "@/domain/config";
import type { HangarCamera } from "@/lib/runtime";
import { ENGINE_PROFILES, type EngineId } from "@/sim/profiles";
import { hangarStore, INSPECTION_DURATION_S } from "../hangarStore";
import { HangarRoom } from "./HangarRoom";
import { Machinery } from "./Machinery";
import { Platform } from "./Platform";

export const DRONE_TARGET = new THREE.Vector3(0, 1.2, 0);

export const CAMERA_PRESETS: Record<
  HangarCamera,
  { position: [number, number, number]; target: [number, number, number]; shift: number }
> = {
  hero: { position: [2.2, 1.68, 2.6], target: [0, 1.02, 0], shift: 0.5 },
  side: { position: [3.3, 1.3, 0.001], target: [0, 1.12, 0], shift: 0.55 },
  top: { position: [0.001, 4.9, 0.6], target: [0, 0.8, 0], shift: 0.9 },
};

/**
 * Resolve a preset for the current viewport: on wide layouts the drone is
 * framed left of centre (the configuration panel covers the right side); on
 * portrait screens the camera backs off so the whole airframe fits.
 */
export function framePreset(preset: HangarCamera, width: number, height: number) {
  const p = CAMERA_PRESETS[preset];
  const pos = new THREE.Vector3(...p.position);
  const target = new THREE.Vector3(...p.target);
  const aspect = width / Math.max(1, height);
  if (aspect < 1.1) {
    const k = Math.min(1.9, 1.25 / Math.max(0.45, aspect));
    pos.sub(target).multiplyScalar(k).add(target);
  }
  if (width >= 1024) {
    const dir = new THREE.Vector3().subVectors(target, pos).normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    pos.addScaledVector(right, p.shift);
    target.addScaledVector(right, p.shift);
  }
  return { position: pos, target };
}

/** Smoothly flies the camera to the requested preset; user orbiting interrupts. */
function CameraRig({ preset, nonce, instant }: { preset: HangarCamera; nonce: number; instant: boolean }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const anim = useRef<{ t: number; fromP: THREE.Vector3; fromT: THREE.Vector3 } | null>(null);
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!controls) return;
    const framed = framePreset(preset, width, height);
    goal.current = framed;
    if (instant) {
      camera.position.copy(framed.position);
      controls.target.copy(framed.target);
      controls.update();
      anim.current = null;
    } else {
      anim.current = { t: 0, fromP: camera.position.clone(), fromT: controls.target.clone() };
    }
    const cancel = () => (anim.current = null);
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [preset, nonce, instant, controls, camera, width, height]);

  useFrame((_, delta) => {
    const a = anim.current;
    const g = goal.current;
    if (!a || !g || !controls) return;
    a.t = Math.min(1, a.t + delta / 1.1);
    const k = a.t < 0.5 ? 4 * a.t ** 3 : 1 - (-2 * a.t + 2) ** 3 / 2;
    camera.position.lerpVectors(a.fromP, g.position, k);
    controls.target.lerpVectors(a.fromT, g.target, k);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

/** Spot light whose target is placed in world space (targets outside the scene graph need a manual matrix update). */
function AimedSpot({ aim, ...props }: { aim: [number, number, number] } & ThreeElements["spotLight"]) {
  const ref = useRef<THREE.SpotLight>(null);
  useLayoutEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.target.position.set(...aim);
    l.target.updateMatrixWorld();
  }, [aim]);
  return <spotLight ref={ref} {...props} />;
}

/** Horizontal scan plane that sweeps the airframe during inspection. */
function InspectionScanner({ active, frozen, color }: { active: boolean; frozen: boolean; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;
          void main(){
            float r = length(vUv - 0.5) * 2.0;
            float grid = step(0.92, fract(vUv.x * 28.0)) + step(0.92, fract(vUv.y * 28.0));
            float a = (1.0 - smoothstep(0.7, 1.0, r)) * (0.12 + grid * 0.35) + smoothstep(0.9, 0.97, r) * (1.0 - smoothstep(0.97, 1.0, r)) * 0.9;
            gl_FragColor = vec4(uColor, a * uOpacity);
          }
        `,
      }),
    // color updates are applied below without rebuilding the shader
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    mat.uniforms.uColor.value.set(color);
  }, [color, mat]);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame((state, delta) => {
    const { t, dt } = frameTime(state.clock.elapsedTime, delta, frozen);
    const target = active ? 1 : 0;
    const u = mat.uniforms.uOpacity;
    u.value = frozen ? target : u.value + (target - u.value) * Math.min(1, dt * 4);
    if (ref.current) {
      ref.current.visible = u.value > 0.01;
      ref.current.position.y = 1.2 + Math.sin(t * 1.6) * 0.55;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} material={mat} renderOrder={3}>
      <planeGeometry args={[2.2, 2.2]} />
    </mesh>
  );
}

function HoloPanel({ frozen, engine }: { frozen: boolean; engine: EngineId }) {
  const p = ENGINE_PROFILES[engine];
  const tex = holoLabelTexture(`spec-${engine}`, [
    "AX-7 KESTREL",
    `PROFILE  ${p.label}`,
    `VMAX     ${p.maxSpeed} m/s`,
    `THRUST   ${p.accel} m/s²`,
    `ROTOR    ${p.rotorRpm} rpm`,
  ]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => {
    mat.map = tex;
    mat.needsUpdate = true;
  }, [mat, tex]);
  useEffect(() => () => mat.dispose(), [mat]);
  const ref = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const { t } = frameTime(state.clock.elapsedTime, delta, frozen);
    if (ref.current) ref.current.position.y = 1.8 + Math.sin(t * 0.9) * 0.04;
    mat.opacity = 0.78 + Math.sin(t * 13) * 0.04;
  });
  return (
    <group ref={ref} position={[0.45, 1.75, -2.4]} rotation={[0, 0.42, 0]}>
      <mesh material={mat}>
        <planeGeometry args={[1.5, 0.75]} />
      </mesh>
      <mesh position={[0, -0.95, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 1.1, 4]} />
        <meshBasicMaterial color="#4fe3fb" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export interface HangarSceneProps {
  paint: PaintId;
  engine: EngineId;
  lights: boolean;
  quality: QualityId;
  preset: HangarCamera;
  presetNonce: number;
  inspecting: boolean;
  frozen: boolean;
  seed: number;
  reducedMotion: boolean;
}

export function HangarScene(props: HangarSceneProps) {
  const { paint, engine, lights, quality, preset, presetNonce, inspecting, frozen, seed, reducedMotion } = props;
  const q = QUALITY_PROFILES[quality];
  const accent = PAINTS[paint].accent;
  const rig = useMemo(() => createDroneRig(), []);
  const droneRef = useRef<THREE.Group>(null);
  const inspection = useRef({ progress: 0, explode: 0, lastPublish: 0 });
  const keyLight = useRef<THREE.SpotLight>(null);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    scene.fog = new THREE.FogExp2("#070a0e", 0.02);
    scene.background = new THREE.Color("#05070a");
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useEffect(() => {
    const light = keyLight.current;
    if (light) {
      light.target.position.copy(DRONE_TARGET);
      light.target.updateMatrixWorld();
    }
  }, []);

  useFrame((state, delta) => {
    const { t, dt } = frameTime(state.clock.elapsedTime, delta, frozen);
    const profile = ENGINE_PROFILES[engine];
    rig.time = t;
    rig.dt = dt;
    rig.rotorSpeed = (profile.rotorRpm / 60) * 2 * Math.PI * 0.012;

    // Inspection sequence progress + exploded view.
    const ins = inspection.current;
    if (inspecting) ins.progress = frozen ? 0.5 : Math.min(1, ins.progress + dt / INSPECTION_DURATION_S);
    else ins.progress = 0;
    const targetExplode = inspecting ? 1 : 0;
    ins.explode = frozen || reducedMotion ? targetExplode : ins.explode + (targetExplode - ins.explode) * Math.min(1, dt * 2.5);
    rig.explode = ins.explode;
    if (state.clock.elapsedTime - ins.lastPublish > 0.1) {
      ins.lastPublish = state.clock.elapsedTime;
      if (hangarStore.get().progress !== ins.progress) hangarStore.set({ progress: ins.progress });
    }

    const d = droneRef.current;
    if (d) {
      const bob = reducedMotion && !frozen ? 0 : Math.sin(t * 1.3) * 0.04;
      d.position.set(0, 1.2 + bob, 0);
      d.rotation.set(Math.sin(t * 0.7) * 0.015, Math.PI + (inspecting ? 0 : Math.sin(t * 0.21) * 0.06), Math.sin(t * 0.9) * 0.02);
    }
  });

  return (
    <>
      <CameraRig preset={preset} nonce={presetNonce} instant={frozen || reducedMotion} />
      <OrbitControls
        makeDefault
        target={CAMERA_PRESETS.hero.target}
        enableDamping={!frozen}
        dampingFactor={0.08}
        minDistance={1.8}
        maxDistance={13}
        maxPolarAngle={Math.PI * 0.49}
        enablePan={false}
        rotateSpeed={0.6}
      />

      <hemisphereLight args={["#3a5568", "#0a0d11", 1.1]} />
      <spotLight
        ref={keyLight}
        position={[3.5, 9.5, 5]}
        angle={0.42}
        penumbra={0.65}
        intensity={420}
        distance={30}
        decay={2}
        color="#e8f4ff"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
        shadow-camera-near={2}
        shadow-camera-far={25}
      />
      <spotLight position={[-4, 4.5, -5.5]} angle={0.6} penumbra={0.8} intensity={140} distance={20} decay={2} color="#3fdcff" />
      <pointLight position={[-6.5, 2.4, 3.5]} intensity={22} distance={14} decay={2} color="#ff9f1c" />
      <pointLight position={[6, 3, -6]} intensity={30} distance={16} decay={2} color="#4fe3fb" />
      {/* Wall washes so the architecture reads in the background. */}
      <AimedSpot position={[0, 9, 2]} angle={0.75} penumbra={1} intensity={1400} distance={26} decay={2} color="#b8d8ff" aim={[0, 2, -14]} />
      <AimedSpot position={[-2, 9, 4]} angle={0.8} penumbra={1} intensity={900} distance={24} decay={2} color="#9ccfff" aim={[-16, 2, -2]} />

      <Environment resolution={q.envResolution} frames={1} background={false}>
        <color attach="background" args={["#05070a"]} />
        <Lightformer form="rect" intensity={3.2} color="#e9f6ff" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#dceeff" position={[4, 3, 6]} rotation-y={Math.PI * 0.8} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#4fe3fb" position={[-8, 3, -3]} rotation-y={Math.PI / 2} scale={[8, 0.6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ff9f1c" position={[8, 2, 3]} rotation-y={-Math.PI / 2} scale={[6, 0.4, 1]} />
        <Lightformer form="ring" intensity={1.5} color="#8ff1ff" position={[0, 3, -9]} scale={4} />
      </Environment>

      <HangarRoom seed={seed} frozen={frozen} volumetrics={q.volumetrics} />
      <Platform frozen={frozen} accent={accent} />
      <Machinery seed={seed} frozen={frozen} />
      <HoloPanel frozen={frozen} engine={engine} />

      <Drone ref={droneRef} paint={paint} lights={lights} rig={rig} castShadow={q.shadows} underglow />
      <InspectionScanner active={inspecting} frozen={frozen} color={accent} />

      <DustParticles
        count={q.particles}
        seed={seed}
        frozen={frozen}
        box={{ min: [-9, 0.2, -9], max: [9, 8, 9] }}
      />
    </>
  );
}
