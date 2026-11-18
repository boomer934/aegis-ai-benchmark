"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DustParticles } from "@/components/three/Atmosphere";
import { createDroneRig, Drone } from "@/components/three/drone/Drone";
import { frameTime } from "@/components/three/sceneTime";
import { QUALITY_PROFILES, type PaintId, type QualityId } from "@/domain/config";
import { ARENA } from "@/sim/arena";
import { NEUTRAL_INPUT, type FlightInput } from "@/sim/physics";
import { ENGINE_PROFILES } from "@/sim/profiles";
import { useFlight } from "@/stores/flightStore";
import type { FlightController } from "../controller";
import { readInput } from "../input";
import { Arena } from "./Arena";

/** Chase-camera offset behind and above the drone (course runs toward −Z). */
export const CHASE_OFFSET = new THREE.Vector3(0, 2.1, 5.2);
const LOOK_AHEAD = new THREE.Vector3(0, 0.75, -8);

interface Props {
  controller: FlightController;
  paint: PaintId;
  lights: boolean;
  quality: QualityId;
  seed: number;
  reducedMotion: boolean;
  portrait: boolean;
}

export function FlightScene({ controller, paint, lights, quality, seed, reducedMotion, portrait }: Props) {
  const q = QUALITY_PROFILES[quality];
  const droneRef = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const rig = useMemo(() => createDroneRig(), []);
  const input = useRef<FlightInput>({ ...NEUTRAL_INPUT });
  const camPos = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const shake = useRef(0);
  const first = useRef(true);
  const nextGate = useFlight((s) => s.checkpoints);
  // Re-render when a staged benchmark view is released so animations resume.
  const staged = useFlight((s) => s.staged);
  const scene = useThree((s) => s.scene);
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), target: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useEffect(() => {
    scene.fog = new THREE.Fog("#070b10", 40, 190);
    scene.background = new THREE.Color("#06090d");
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((state, delta) => {
    const frozen = controller.frozen;
    const ft = frameTime(state.clock.elapsedTime, delta, frozen);
    readInput(input.current);
    const events = controller.frame(delta, input.current);
    if (events.some((e) => e.type === "collision") && !reducedMotion) shake.current = 0.35;

    const w = controller.world;
    const d = w.drone;
    // Interpolate between physics steps for smooth rendering at any refresh rate.
    const a = frozen ? 1 : controller.alpha;
    tmp.p.set(
      d.prevPosition.x + (d.position.x - d.prevPosition.x) * a,
      d.prevPosition.y + (d.position.y - d.prevPosition.y) * a,
      d.prevPosition.z + (d.position.z - d.prevPosition.z) * a,
    );

    const g = droneRef.current;
    if (g) {
      g.position.copy(tmp.p);
      g.rotation.set(d.pitch, 0, d.roll, "YXZ");
    }

    const profile = ENGINE_PROFILES[w.profile.id];
    const base = (profile.rotorRpm / 60) * 2 * Math.PI * 0.012;
    rig.rotorSpeed = base * (1 + d.throttle * 1.6 + (d.boosting ? 0.8 : 0));
    rig.time = ft.t;
    rig.dt = ft.dt;
    rig.pitch = d.pitch;

    // Chase camera: critically damped follow; snaps on first frame / when frozen.
    const offset = tmp.target.copy(CHASE_OFFSET);
    if (portrait) offset.multiplyScalar(1.35);
    const desired = offset.add(tmp.p);
    const look = lookAt.current;
    if (first.current || frozen) {
      camPos.current.copy(desired);
      look.copy(tmp.p).add(LOOK_AHEAD);
      first.current = false;
    } else {
      const k = 1 - Math.exp(-5 * ft.dt);
      camPos.current.lerp(desired, k);
      look.lerp(tmp.look.copy(tmp.p).add(LOOK_AHEAD), 1 - Math.exp(-8 * ft.dt));
    }
    const cam = state.camera;
    cam.position.copy(camPos.current);
    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - ft.dt);
      const s = shake.current * 0.35;
      cam.position.x += (Math.sin(ft.t * 90) * s) / 2;
      cam.position.y += (Math.cos(ft.t * 77) * s) / 2;
    }
    cam.lookAt(look);

    // Keep the shadow frustum centred on the drone.
    const l = sun.current;
    if (l) {
      l.position.set(tmp.p.x + 18, tmp.p.y + 40, tmp.p.z + 22);
      l.target.position.copy(tmp.p);
      l.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <hemisphereLight args={["#46607a", "#0b0f14", 1.1]} />
      <directionalLight
        ref={sun}
        intensity={2.4}
        color="#dcecff"
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={5}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <pointLight position={[ARENA.start.x, 4, ARENA.start.z]} color="#4fe3fb" intensity={40} distance={20} decay={2} />
      <Environment resolution={q.envResolution} frames={1} background={false}>
        <color attach="background" args={["#06090d"]} />
        <Lightformer form="rect" intensity={2.5} color="#e9f6ff" position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#4fe3fb" position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[10, 1, 1]} />
        <Lightformer form="rect" intensity={1} color="#ff9f1c" position={[10, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 1, 1]} />
      </Environment>

      <Arena nextGate={nextGate} frozen={staged} seed={seed} />
      <Drone ref={droneRef} paint={paint} lights={lights} rig={rig} castShadow={q.shadows} />
      <DustParticles
        count={Math.round(q.particles * 1.2)}
        seed={seed}
        frozen={staged}
        box={{ min: [ARENA.bounds.minX, 0.5, ARENA.bounds.minZ], max: [ARENA.bounds.maxX, 24, ARENA.bounds.maxZ] }}
        size={0.12}
        color="#7fd8f0"
      />
    </>
  );
}
