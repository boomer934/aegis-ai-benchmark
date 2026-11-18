"use client";
/* eslint-disable react-hooks/immutability -- Three.js scene objects are mutable renderer resources. */
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as Orbit } from "three-stdlib";
import * as T from "three";
import { airframe } from "./airframe";
import { Optics } from "./Optics";
import { room, gateSet } from "./facility";
import { release, facilityReflections } from "./fabrication";
import { PAINTS } from "@/features/flight/simulation";
import { useLayoutSettings, type Facility } from "@/stores/facility";
export interface Perf {
  fps: number;
  p5: number;
  p95: number;
  draws: number;
  triangles: number;
  frames: number;
  dpr: number;
}
export const percentile = (sorted: number[], q: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))];
function Instrument({
  report,
  ready,
  measure,
}: {
  report: (p: Perf) => void;
  ready: () => void;
  measure: boolean;
}) {
  const batches = useRef<number[]>([]),
    time = useRef(0),
    frames = useRef(0);
  useFrame(({ gl }, delta) => {
    frames.current++;
    if (frames.current === 4) ready();
    if (!measure || frames.current < 12 || delta <= 0) return;
    batches.current.push(1000 * delta);
    time.current += delta;
    if (time.current >= 1 && batches.current.length >= 2) {
      const list = batches.current.sort((a, b) => a - b);
      report({
        fps: 1000 / percentile(list, 0.5),
        p5: 1000 / percentile(list, 0.95),
        p95: percentile(list, 0.95),
        draws: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        frames: list.length,
        dpr: gl.getPixelRatio(),
      });
      batches.current = [];
      time.current = 0;
    }
  });
  return null;
}
function World({ s, reduced }: { s: Facility; reduced: boolean }) {
  useLayoutSettings(s);
  const { gl, scene, camera, size } = useThree(),
    flight = s.scene === "flight";
  const model = useMemo(() => airframe(), []),
    env = useMemo(() => room(flight, s.options.seed), [flight, s.options.seed]);
  const gates = useMemo(() => gateSet(), []);
  const orbit = useRef<Orbit>(null),
    base = useRef(new T.Vector3()),
    look = useRef(new T.Vector3()),
    animation = useRef(0),
    lastGate = useRef(-1);
  const quality = s.settings.quality;
  useEffect(
    () => () => {
      release(model.group);
      release(gates.group);
    },
    [model, gates],
  );
  useEffect(() => () => release(env.root), [env]);
  useLayoutEffect(() => {
    const reflection = facilityReflections(gl);
    scene.environment = reflection.texture;
    scene.environmentIntensity = 0.68;
    return () => {
      scene.environment = null;
      reflection.dispose();
    };
  }, [gl, scene]);
  useLayoutEffect(() => {
    const aspect = size.width / size.height;
    const dist = Math.max(1, 1.48 / aspect);
    const target = new T.Vector3(0, 1.65, 0);
    if (flight) {
      camera.position.set(0, 5.35, 27);
      camera.lookAt(0, 3, 13);
      lastGate.current = -1;
    } else {
      const dir = { hero: [4.85, 2.95, 6.25], side: [8.7, 2.65, 0.4], top: [0, 11.6, 0.04] }[
        s.settings.camera
      ];
      camera.position.set(dir[0] * dist, dir[1] * dist + target.y, dir[2] * dist);
      camera.lookAt(target);
      if (orbit.current) {
        orbit.current.target.copy(target);
        orbit.current.update();
      }
    }
  }, [camera, size.width, size.height, flight, s.settings.camera]);
  const seenZoom = useRef(s.zoomCommand.serial);
  useLayoutEffect(() => {
    if (flight || seenZoom.current === s.zoomCommand.serial || !orbit.current) return;
    seenZoom.current = s.zoomCommand.serial;
    const center = orbit.current.target,
      offset = camera.position.clone().sub(center);
    offset.setLength(T.MathUtils.clamp(offset.length() * s.zoomCommand.factor, 5, 19));
    camera.position.copy(center).add(offset);
    orbit.current.update();
  }, [s.zoomCommand, camera, flight]);
  useLayoutEffect(() => {
    model.armor.color.set(PAINTS[flight && s.sortie ? s.sortie.paint : s.settings.paint]);
    for (const [light, on] of [
      [model.lamp, "#89f2ff"],
      [model.tail, "#ff763d"],
    ] as const) {
      light.color.set(s.settings.lights ? on : "#354148");
      light.emissiveIntensity = s.settings.lights ? 2 : 0;
    }
  }, [model, s.settings.paint, s.settings.lights, s.sortie, flight]);
  useFrame((_, dt) => {
    const f = s.sim.state,
      fixed = s.options.benchmark && (s.scene === "hangar" || f.phase === "standby");
    if (!fixed && !reduced && (!flight || f.phase !== "paused"))
      animation.current += Math.min(dt, 0.05);
    const t = fixed ? 1.2 : animation.current;
    env.dust.rotation.y = t * 0.008;
    if (flight) {
      model.group.position.set(f.position.x, f.position.y, f.position.z);
      model.group.scale.setScalar(0.34);
      model.group.rotation.set(-f.pitch, Math.PI, -f.roll);
      base.current.set(f.position.x * 0.87, f.position.y + 2.15, f.position.z + 6.4);
      look.current.set(f.position.x * 0.9, f.position.y + 0.25, f.position.z - 5.5);
      camera.position.lerp(base.current, fixed ? 1 : 1 - Math.exp(-5 * dt));
      camera.lookAt(look.current);
      if (lastGate.current !== f.gates) {
        gates.lights.forEach((m, i) => {
          const color = i === f.gates ? "#ff9a41" : i < f.gates ? "#516c70" : "#75d9e8";
          m.color.set(color);
          m.emissive.set(color);
        });
        lastGate.current = f.gates;
      }
    } else {
      model.group.position.set(0, 1.91 + Math.sin(t * 1.3) * 0.045, 0);
      model.group.scale.setScalar(1);
      model.group.rotation.set(0, -0.12, 0);
    }
    model.rotors.forEach(
      (rotor, i) => (rotor.rotation.y = (i % 2 ? 1 : -1) * t * (flight ? 26 : 6) + i * 0.73),
    );
  });
  return (
    <>
      <color attach="background" args={["#263640"]} />
      <fog attach="fog" args={["#233a48", flight ? 26 : 10, flight ? 87 : 43]} />
      <hemisphereLight args={["#bbdbe6", "#39454e", 0.52]} />
      <directionalLight
        position={[4, 9, 5]}
        intensity={1.67}
        color="#ffdcbe"
        castShadow={quality === "HIGH"}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-normalBias={0.024}
      />
      <directionalLight position={[-5, 4, -4]} intensity={2.25} color="#49c5ed" />
      <pointLight
        position={[-4, 3.8, -2]}
        intensity={flight ? 65 : 44}
        distance={17}
        color="#33c8f9"
      />
      <pointLight
        position={[4.5, 3.6, 2]}
        intensity={flight ? 38 : 39}
        distance={12}
        color="#ffb073"
      />
      <primitive object={env.root} />
      <primitive object={model.group} />
      {flight && <primitive object={gates.group} />}
      {!flight && (
        <OrbitControls
          ref={orbit}
          makeDefault
          enableDamping={!s.options.benchmark}
          enablePan={false}
          minDistance={5}
          maxDistance={19}
          maxPolarAngle={Math.PI * 0.479}
          autoRotate={s.settings.inspect}
          autoRotateSpeed={1.7}
        />
      )}
    </>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  componentDidCatch() {
    this.props.onFailure();
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="canvas-failure">
        3D display unavailable. Enable WebGL 2, then{" "}
        <button onClick={() => location.reload()}>reload the viewport</button>.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function Viewport({ s, debug }: { s: Facility; debug: boolean }) {
  useLayoutSettings(s);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false),
    [perf, setPerf] = useState<Perf>(),
    [lost, setLost] = useState(false);
  const [reduced] = useState(
    () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const q = s.settings.quality;
  const disposeLoss = useRef<() => void>(() => {});
  useEffect(() => () => disposeLoss.current(), []);
  return (
    <div className="viewport" data-rendered={ready && !lost && !failed ? "yes" : "no"}>
      <SceneBoundary
        onFailure={() => {
          s.suspend();
          setFailed(true);
        }}
      >
        <Canvas
          dpr={q === "HIGH" ? 1.5 : q === "MEDIUM" ? 1.15 : 1}
          shadows={q === "HIGH" ? "percentage" : false}
          camera={{ fov: 36, near: 0.1, far: 170, position: [6, 5, 7] }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: T.ACESFilmicToneMapping,
            toneMappingExposure: 1.04,
          }}
          onCreated={({ gl }) => {
            const handle = () => {
              s.suspend();
              setLost(true);
            };
            gl.domElement.addEventListener("webglcontextlost", handle);
            disposeLoss.current = () =>
              gl.domElement.removeEventListener("webglcontextlost", handle);
          }}
        >
          <Suspense fallback={null}>
            <World s={s} reduced={reduced} />
            <Instrument ready={() => setReady(true)} measure={debug} report={setPerf} />
            <Optics high={q === "HIGH"} />
          </Suspense>
        </Canvas>
      </SceneBoundary>
      {!ready && !lost && !failed && <span className="render-state">Initializing viewport…</span>}
      {lost && (
        <div className="canvas-failure">
          Graphics context lost.{" "}
          <button onClick={() => location.reload()}>Reload the viewport</button>.
        </div>
      )}
      {debug && (
        <output className="perf" data-perf={perf ? JSON.stringify(perf) : ""}>
          {q} · DPR {perf?.dpr ?? "—"}
          <br />
          {perf?.fps.toFixed(1) ?? "—"} FPS · p95 {perf?.p95.toFixed(1) ?? "—"} ms
          <br />
          {perf?.draws ?? "—"} draws · {perf?.triangles.toLocaleString() ?? "—"} triangles
        </output>
      )}
    </div>
  );
}
