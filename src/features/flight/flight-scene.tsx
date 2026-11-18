"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import { Batch, Dust, UtilityBox } from "@/components/three/architecture";
import { Drone } from "@/components/three/drone";
import {
  amber,
  black,
  Block,
  cement,
  Concrete,
  cyan,
  gunmetal,
  Mark,
  pale,
  runway,
  safety,
  steel,
  Strut,
  wall,
} from "@/components/three/parts";
import { CanvasStage, SHADOW, type Quality } from "@/components/three/stage";
import { StaticBatch } from "@/components/three/static-batch";
import {
  FLY_BOUNDS,
  GATE_FRAMES,
  GATES,
  OBSTACLES,
  START,
  PREVIEW,
  type Configuration,
  type Vec,
} from "./physics";
import type { FlightEngine } from "./engine";

const flightView: Vec = [6, 6.4, 32];
const target = new T.Vector3();
const destination = new T.Vector3();
const courseMaterial = new T.MeshBasicMaterial({
  color: "#79c8c5",
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
});
const completed = new T.MeshBasicMaterial({ color: "#578c83" });
const tarmac = new T.MeshStandardMaterial({ color: "#263c46", roughness: 0.87, metalness: 0.1 });
const skyMaterial = new T.ShaderMaterial({
  side: T.BackSide,
  depthWrite: false,
  uniforms: {
    zenith: { value: new T.Color("#192f43") },
    haze: { value: new T.Color("#718985") },
    sun: { value: new T.Color("#dba479") },
  },
  vertexShader: `
    varying vec3 direction;
    void main() {
      direction = normalize(position);
      vec4 farClip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.);
      gl_Position = farClip.xyww;
    }
  `,
  fragmentShader: `
    uniform vec3 zenith;
    uniform vec3 haze;
    uniform vec3 sun;
    varying vec3 direction;
    void main() {
      vec3 view = normalize(direction);
      vec3 color = mix(haze, zenith, pow(clamp(view.y * 2.1, 0., 1.), .57));
      float warmth = pow(max(0., dot(view, normalize(vec3(-.58, .11, -.81)))), 16.);
      color = mix(color, sun, warmth * .48);
      gl_FragColor = vec4(color, 1.);
      #include <colorspace_fragment>
    }
  `,
});
const strip = GATES.map(({ center }) => center);
const dots = [START, ...strip].flatMap((p, index, points) => {
  if (index === points.length - 1) return [];
  const next = points[index + 1];
  const rotation = Math.atan2(next[0] - p[0], next[2] - p[2]);
  return Array.from({ length: 12 }, (_, i) => ({
    p: [
      T.MathUtils.lerp(p[0], next[0], i / 12),
      0.02,
      T.MathUtils.lerp(p[2], next[2], i / 12),
    ] as Vec,
    s: [0.074, 0.013, 0.73] as Vec,
    ry: rotation,
  }));
});
const rangeMarkers = [-1, 1].flatMap((side) =>
  Array.from({ length: 48 }, (_, i) => ({
    p: [side * 22.4, 0.02, 24 - i * 2.26] as Vec,
    s: [i % 5 ? 0.32 : 1.15, 0.009, 0.086] as Vec,
  })),
);
const dangerStripes = [-1, 1].flatMap((side) =>
  Array.from({ length: 21 }, (_, i) => ({
    p: [side * 12.3, 0.027, 25.8 - i * 0.36] as Vec,
    s: [0.96, 0.014, 0.12] as Vec,
    ry: side * -0.6,
  })),
);

function Gate({ index, current, frozen }: { index: number; current: number; frozen: boolean }) {
  const { center, width, height } = GATES[index];
  const lit = index < current ? completed : index === current ? amber : cyan;
  return (
    <group position={center}>
      <StaticBatch revision={`${lit.uuid}:${frozen}`}>
        {GATE_FRAMES[index].map(({ center, size }, part) => (
          <Block key={part} p={center} s={size} m={gunmetal} cast />
        ))}
        {[-1, 1].map((side) => (
          <group key={side}>
            <Block p={[(side * width) / 2, 0, 0.25]} s={[0.083, height - 0.12, 0.057]} m={lit} />
            <Block
              p={[side * (width / 2 + 0.16), -height / 2 - 0.16, 0]}
              s={[0.6, 0.54, 0.59]}
              m={steel}
            />
            <Strut
              from={[side * (width / 2 + 0.16), -height / 2, 0]}
              to={[side * (width / 2 + 1.27), -center[1] + 0.14, 0]}
              material={steel}
              radius={0.084}
            />
            <Block
              p={[side * (width / 2 + 1.27), -center[1] + 0.07, 0]}
              s={[0.85, 0.14, 0.8]}
              m={black}
            />
          </group>
        ))}
        <Block p={[0, height / 2, 0.25]} s={[width - 0.17, 0.073, 0.055]} m={lit} />
        <Block p={[0, -height / 2, 0.2]} s={[width - 0.15, 0.044, 0.05]} m={lit} />
        <Block p={[0, height / 2 + 0.59, 0.05]} s={[1.61, 0.62, 0.41]} m={black} />
        <Mark
          value={String(index + 1).padStart(2, "0")}
          size={[1.42, 0.55]}
          position={[0, height / 2 + 0.6, 0.268]}
          color={index === current ? "#ffa669" : "#a0e0d6"}
        />
        {(frozen || index === current) && (
          <Block p={[0, height / 2 + 0.95, 0]} s={[0.71, 0.035, 0.47]} m={lit} />
        )}
      </StaticBatch>
    </group>
  );
}

function Course({
  seed,
  quality,
  gate,
  frozen,
  reduced,
}: {
  seed: number;
  quality: Quality;
  gate: number;
  frozen: boolean;
  reduced: boolean;
}) {
  const shadow = SHADOW[quality];
  const path = useMemo(
    () =>
      new T.CatmullRomCurve3(
        [START, ...strip].map((p) => new T.Vector3(...p)),
        false,
        "centripetal",
      ),
    [],
  );
  return (
    <>
      <color attach="background" args={["#344d57"]} />
      <fog attach="fog" args={["#647e82", 39, 144]} />
      <mesh material={skyMaterial} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[64, 32, 20]} />
      </mesh>
      <hemisphereLight args={["#c0e3fa", "#77705e", 2.1]} />
      <directionalLight
        color="#ffeed0"
        intensity={2.75}
        position={[-19, 29, 13]}
        castShadow={!!shadow}
        shadow-mapSize-width={shadow || 512}
        shadow-mapSize-height={shadow || 512}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-bottom={-64}
        shadow-camera-top={31}
        shadow-camera-near={0.5}
        shadow-camera-far={132}
        shadow-normalBias={0.053}
      />
      <Concrete seed={seed + 90} size={[74, 133]} position={[0, 0, -28]} repeat={[18, 32]} />
      <Block p={[0, 1.4, -89]} s={[64, 2.8, 1]} m={cement} />
      <Block p={[0, 1.4, 29.5]} s={[64, 2.8, 1]} m={cement} />
      <Block p={[0, 0.012, -28.4]} s={[24, 0.014, 127]} m={tarmac} receive />
      <Batch items={rangeMarkers} material={runway} />
      <Batch items={dangerStripes} material={safety} />
      <Block p={[0, 10.5, -93]} s={[59, 1.8, 2.35]} m={gunmetal} />
      <Block p={[0, 10, -91.77]} s={[57, 0.11, 0.09]} m={runway} />
      <Block p={[0, 10.66, -91.77]} s={[22, 1.2, 0.11]} m={black} />
      <Mark
        value="AEGIS   /   FLIGHT VALIDATION RANGE"
        size={[20, 1.05]}
        position={[0, 10.71, -91.705]}
        color="#b4c4be"
      />
      <Block p={[0, 0.016, 22]} s={[8.5, 0.025, 8.2]} m={gunmetal} receive />
      <Mark
        value="START"
        size={[4.8, 1.01]}
        position={[0, 0.037, 24.4]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <Mark
        value="05   /   FINISH"
        size={[6.25, 1.0]}
        position={[3, 0.037, -72]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <Batch items={dots} material={cyan} />
      <mesh material={courseMaterial}>
        <tubeGeometry args={[path, 64, 0.024, 4, false]} />
      </mesh>
      {GATES.map((_, i) => (
        <Gate key={i} current={gate} index={i} frozen={frozen} />
      ))}
      <StaticBatch>
        {OBSTACLES.map(({ center, size }, i) => (
          <group key={i}>
            <UtilityBox p={center} size={size} />
            <Mark
              value={`T${i + 1}`}
              size={[1.65, 0.85]}
              position={[center[0], center[1] + size[1] * 0.35, center[2] + size[2] / 2 + 0.045]}
              color="#b4c2ba"
            />
          </group>
        ))}
      </StaticBatch>
      <StaticBatch>
        {[-1, 1].map((side) => (
          <group key={side}>
            <Block p={[side * 12.01, 0.024, -28.4]} s={[0.091, 0.014, 127]} m={runway} />
            <Block p={[side * 28.6, 5, -93]} s={[2.84, 10, 3.25]} m={wall} />
            <Strut
              from={[side * 28.1, 5.1, -92.6]}
              to={[side * 24.15, 10, -92.6]}
              material={steel}
              radius={0.29}
            />
            <Block p={[side * 28.6, 10.6, -93]} s={[1.04, 0.11, 2.54]} m={amber} />
            <Block
              p={[side * (FLY_BOUNDS.x + 1.03), 1.12, -29.3]}
              s={[0.9, 2.28, 117]}
              m={wall}
              receive
            />
            <Block
              p={[side * 30.1, 2.27, -29.3]}
              s={[0.103, 0.069, 117]}
              m={side > 0 ? cyan : pale}
            />
            <Block p={[side * 25.6, 0.014, -29.3]} s={[0.092, 0.007, 117]} m={runway} />
            {[-86, -75, -64, -53, -42, -31, -20, -9, 2, 13, 24].map((z, i) => (
              <group key={z}>
                <Block p={[side * 30.6, 3.76, z]} s={[0.51, 7.6, 0.68]} m={gunmetal} />
                <Block p={[side * 29.9, 7.44, z]} s={[1.65, 0.21, 0.7]} m={black} />
                <Block
                  p={[side * 29.9, 7.315, z]}
                  s={[1.42, 0.055, 0.52]}
                  m={i % 3 ? pale : amber}
                />
                <Block
                  p={[side * (38 + (i % 3) * 1.7), 4.8 + (i % 4) * 0.85, z]}
                  s={[9.5, 9.6 + (i % 4) * 1.7, 8.3]}
                  m={cement}
                />
                <Block
                  p={[side * (33.18 + (i % 3) * 1.7), 7.1 + (i % 4) * 0.79, z]}
                  s={[0.14, 0.3, 6.7]}
                  m={i % 2 ? runway : steel}
                />
                <Block
                  p={[side * (33.18 + (i % 3) * 1.7), 5.3 + (i % 4) * 0.77, z]}
                  s={[0.12, 1.08, 7.25]}
                  m={gunmetal}
                />
                <Block
                  p={[side * (33.05 + (i % 3) * 1.7), 5.31 + (i % 4) * 0.77, z]}
                  s={[0.058, 0.05, 6.9]}
                  m={i % 2 ? cyan : pale}
                />
              </group>
            ))}
          </group>
        ))}
      </StaticBatch>
      <Dust
        seed={seed}
        count={quality === "HIGH" ? 160 : quality === "MEDIUM" ? 65 : 0}
        flight
        moving={!frozen && !reduced}
      />
    </>
  );
}

function Chase({
  engine,
  config,
  frozen,
  reduced,
}: {
  engine: FlightEngine;
  config: Configuration;
  frozen: boolean;
  reduced: boolean;
}) {
  const drone = useRef<T.Group>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const last = useRef<Vec | null>(null);
  useFrame((_, dt) => {
    if (!frozen) engine.frame(dt);
    const { position: p, velocity, pitch, roll, phase } = frozen ? PREVIEW : engine.state;
    if (drone.current) {
      drone.current.position.set(...p);
      drone.current.rotation.set(-pitch, 0, roll);
    }
    const mobile = size.width / size.height < 1;
    const x = p[0] + (frozen ? 3.15 : 1.7);
    destination.set(x, p[1] + (frozen ? 2.7 : 2.55), p[2] + (mobile ? 7.6 : 6.4));
    const jumped =
      !last.current ||
      Math.abs(last.current[2] - p[2]) > 2 ||
      phase === "ready" ||
      phase === "countdown";
    if (frozen || jumped || reduced) camera.position.copy(destination);
    else camera.position.lerp(destination, 1 - Math.exp(-8 * dt));
    target.set(p[0] + (frozen ? -0.2 : velocity[0] * 0.12), p[1] + 0.25, p[2] - 10.8);
    camera.lookAt(target);
    last.current = p;
  });
  return (
    <group ref={drone} position={frozen ? PREVIEW.position : START} scale={0.205}>
      <group rotation={[0, Math.PI, 0]}>
        <Drone config={config} moving={!frozen && !reduced} detailed={false} />
      </group>
    </group>
  );
}

export default function FlightScene({
  engine,
  config,
  quality,
  checkpoints,
  frozen,
  seed,
  reduced,
  performance,
}: {
  engine: FlightEngine;
  config: Configuration;
  quality: Quality;
  checkpoints: number;
  frozen: boolean;
  seed: number;
  reduced: boolean;
  performance: boolean;
}) {
  return (
    <CanvasStage quality={quality} camera={flightView} frozen={frozen} performance={performance}>
      <Course seed={seed} quality={quality} gate={checkpoints} frozen={frozen} reduced={reduced} />
      <Chase engine={engine} config={config} frozen={frozen} reduced={reduced} />
    </CanvasStage>
  );
}
