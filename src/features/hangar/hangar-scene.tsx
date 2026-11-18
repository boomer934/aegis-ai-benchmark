"use client";

import { useEffect, useRef } from "react";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as T from "three";
import type { Configuration, Vec } from "@/features/flight/physics";
import { Batch, Dust, UtilityBox } from "@/components/three/architecture";
import { Drone } from "@/components/three/drone";
import {
  alloy,
  amber,
  Barrel,
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

const VIEW = {
  Hero: [7.5, 4.2, 8.7],
  Side: [8.7, 2.65, 0.6],
  Top: [0.001, 13.5, 1.85],
} satisfies Record<string, Vec>;

export type HangarCamera = keyof typeof VIEW;
type Props = {
  config: Configuration;
  camera: HangarCamera;
  cameraRevision: number;
  quality: Quality;
  frozen: boolean;
  seed: number;
  inspection: boolean;
  reduced: boolean;
  performance: boolean;
};

const ice = new T.MeshStandardMaterial({
  color: "#4b9292",
  emissive: "#478d89",
  emissiveIntensity: 0.31,
  roughness: 0.3,
  metalness: 0.3,
});
const roof = new T.MeshStandardMaterial({ color: "#19262e", roughness: 0.64, metalness: 0.3 });
const pad = new T.MeshStandardMaterial({ color: "#657079", roughness: 0.48, metalness: 0.51 });
const pads = Array.from({ length: 72 }, (_, i) => {
  const angle = (i * Math.PI) / 36;
  const r = i % 6 === 0 ? 4.13 : 4.18;
  return {
    p: [Math.sin(angle) * r, 0.282, Math.cos(angle) * r] as Vec,
    s: [0.042, 0.008, i % 6 === 0 ? 0.2 : 0.105] as Vec,
    ry: angle,
  };
});
const arcs = new T.TorusGeometry(4.34, 0.031, 6, 44, Math.PI * 0.26);
const floorDashes = Array.from({ length: 27 }, (_, i) => ({
  p: [6.65, 0.018, 7 - i * 0.89] as Vec,
  s: [0.33, 0.008, 0.095] as Vec,
}));
const ridges = Array.from({ length: 43 }, (_, i) => ({
  p: [9.64, 1.05, -11.5 + i * 0.51] as Vec,
  s: [0.126, 0.7, 0.09] as Vec,
}));

function Rig({
  camera,
  cameraRevision,
  inspection,
  frozen,
  reduced,
}: Pick<Props, "camera" | "cameraRevision" | "inspection" | "frozen" | "reduced">) {
  const viewCamera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    const p = VIEW[camera];
    const portraitScale = size.width / size.height < 1 ? 1.21 : 1;
    viewCamera.position.set(p[0] * portraitScale, p[1] * portraitScale, p[2] * portraitScale);
    viewCamera.lookAt(0, 0.85, 0);
    orbit.current?.target.set(0, 0.85, 0);
    orbit.current?.update();
  }, [camera, cameraRevision, size.width, size.height, viewCamera]);
  return (
    !frozen && (
      <OrbitControls
        ref={orbit}
        makeDefault
        target={[0, 0.85, 0]}
        autoRotate={inspection && !reduced}
        autoRotateSpeed={0.9}
        enablePan={false}
        enableDamping={!reduced}
        minDistance={5.6}
        maxDistance={16}
        maxPolarAngle={Math.PI * 0.488}
        minPolarAngle={0.05}
      />
    )
  );
}

function Body({
  config,
  frozen,
  inspection,
  reduced,
}: Pick<Props, "config" | "frozen" | "inspection" | "reduced">) {
  const model = useRef<T.Group>(null);
  useFrame(({ clock }, delta) => {
    if (!model.current || frozen || reduced) return;
    const height = 1.25 + (inspection ? 0.18 + 0.15 * Math.sin(clock.elapsedTime * 1.4) : 0);
    model.current.position.y = T.MathUtils.damp(model.current.position.y, height, 4, delta);
  });
  return (
    <group ref={model} position={[0, 1.25, 0]} rotation={[0, -0.15, 0]}>
      <Drone config={config} moving={!frozen && !reduced} />
    </group>
  );
}

function Platform() {
  return (
    <group>
      <Barrel p={[0, 0.095, 0]} s={[4.52, 0.195, 4.52]} m={black} cast receive />
      <Barrel p={[0, 0.186, 0]} s={[4.46, 0.112, 4.46]} m={alloy} receive />
      <Barrel p={[0, 0.241, 0]} s={[4.28, 0.072, 4.28]} m={pad} receive />
      <Barrel p={[0, 0.277, 0]} s={[3.8, 0.012, 3.8]} m={cement} receive />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <mesh
          key={i}
          geometry={arcs}
          material={i % 2 === 0 ? cyan : ice}
          position={[0, 0.252, 0]}
          rotation={[-Math.PI / 2, 0, (i * Math.PI) / 4 + 0.095]}
        />
      ))}
      <Batch items={pads} material={pale} />
      {[-1, 1].map((x) => (
        <group key={x}>
          <Block p={[x * 3.32, 0.285, 0]} s={[0.061, 0.01, 2.94]} m={runway} />
          <Block p={[x * 2.82, 0.285, -1.44]} s={[1, 0.01, 0.061]} m={runway} />
          <Block p={[x * 2.82, 0.285, 1.44]} s={[1, 0.01, 0.061]} m={runway} />
        </group>
      ))}
      <Mark
        value="07"
        size={[1.08, 0.65]}
        position={[0, 0.289, 3.14]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <Mark
        value="AIRFRAME TEST"
        size={[1.6, 0.144]}
        position={[0, 0.287, 3.52]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

function Airlock() {
  return (
    <group position={[0, 0, -9.32]}>
      <Block p={[0, 2.98, -0.16]} s={[8.75, 6.03, 0.48]} m={black} />
      <Block p={[0, 5.38, 0.14]} s={[8.48, 1.32, 0.52]} m={gunmetal} />
      <Block p={[0, 4.85, 0.43]} s={[6.8, 0.11, 0.1]} m={steel} />
      <Block p={[0, 5.44, 0.44]} s={[1.4, 0.041, 0.09]} m={amber} />
      <Mark
        value="07   /   AIRFRAME LAB"
        size={[4.1, 0.52]}
        position={[0, 4.998, 0.45]}
        color="#c2cbc7"
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Block p={[side * 4.22, 2.75, 0.23]} s={[0.55, 5.5, 0.49]} m={steel} cast />
          <Block p={[side * 3.92, 2.52, 0.45]} s={[0.09, 3.56, 0.091]} m={cyan} />
          <Block p={[side * 1.91, 2.21, 0.1]} s={[3.73, 4.4, 0.34]} m={gunmetal} receive />
          <Block p={[side * 1.97, 2.2, 0.28]} s={[3.45, 3.88, 0.045]} m={wall} />
          <Block p={[side * 1.85, 2.6, 0.31]} s={[2.9, 1.27, 0.103]} m={black} />
          <Block p={[side * 1.85, 2.6, 0.373]} s={[2.71, 1.08, 0.065]} m={ice} />
          {[1, 2, 3, 4].map((n) => (
            <Block
              key={n}
              p={[side * 1.85, 2.18 + n * 0.18, 0.414]}
              s={[2.71, 0.03, 0.025]}
              m={black}
            />
          ))}
          <Block p={[side * 0.23, 1.38, 0.34]} s={[0.09, 0.55, 0.11]} m={amber} />
          <Block p={[side * 2.0, 0.26, 0.326]} s={[3.32, 0.115, 0.04]} m={safety} />
        </group>
      ))}
    </group>
  );
}

function Room({ seed, quality, moving }: { seed: number; quality: Quality; moving: boolean }) {
  const shadow = SHADOW[quality];
  const ceiling = useRef<T.Group>(null);
  const left = useRef<T.Group>(null);
  const right = useRef<T.Group>(null);
  const rear = useRef<T.Group>(null);
  useFrame(({ camera }) => {
    if (ceiling.current) ceiling.current.visible = camera.position.y < 6.65;
    if (left.current) left.current.visible = camera.position.x > -9.6;
    if (right.current) right.current.visible = camera.position.x < 9.6;
    if (rear.current) rear.current.visible = camera.position.z > -9.65;
  });
  return (
    <>
      <color attach="background" args={["#1b2a31"]} />
      <fog attach="fog" args={["#283940", 17, 50]} />
      <hemisphereLight args={["#cee9ff", "#62584d", 2.0]} />
      {quality !== "LOW" && (
        <Environment
          resolution={quality === "HIGH" ? 128 : 64}
          frames={1}
          environmentIntensity={0.49}
        >
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#ebf7ff"
            position={[0, 5, 0]}
            scale={[7, 2.2]}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Lightformer
            form="rect"
            intensity={1.25}
            color="#8adbd5"
            position={[6, 2, -4]}
            scale={[4, 0.85]}
            target
          />
          <Lightformer
            form="rect"
            intensity={1.1}
            color="#ffba86"
            position={[-5, 3, 4]}
            scale={[3, 0.7]}
            target
          />
        </Environment>
      )}
      <directionalLight
        position={[-3, 7, 5.4]}
        color="#fff2d4"
        intensity={2.9}
        castShadow={!!shadow}
        shadow-mapSize-width={shadow || 512}
        shadow-mapSize-height={shadow || 512}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={27}
        shadow-bias={-0.00025}
        shadow-normalBias={0.028}
      />
      <pointLight position={[4.3, 3.1, -3.7]} intensity={39} color="#51ddff" distance={14} />
      <pointLight position={[-6.2, 3.1, 0.8]} intensity={34} color="#ffa152" distance={14} />
      <spotLight
        position={[-2.4, 6, -5.2]}
        intensity={48}
        color="#83fffa"
        angle={0.66}
        penumbra={0.66}
        decay={2}
      />
      <Concrete seed={seed} size={[36, 37]} position={[0, 0, -5]} repeat={[9, 10]} />
      <group ref={rear}>
        <StaticBatch>
          <Block p={[0, 4, -10.3]} s={[21.5, 8.1, 1]} m={wall} receive />
          <Airlock />
          <Mark
            value="ENGINEERING"
            size={[2.86, 0.35]}
            position={[-6.65, 4.16, -9.728]}
            color="#9daead"
          />
        </StaticBatch>
      </group>
      <group ref={ceiling}>
        <StaticBatch>
          <Block p={[0, 7.67, -2.7]} s={[21.5, 0.34, 18.3]} m={roof} receive />
          {[-8.7, -5.5, -2.3, 0.9, 4.1, 7.3].map((z, i) => (
            <group key={z}>
              <Block p={[0, 7.09, z]} s={[20.1, 0.43, 0.32]} m={steel} cast />
              <Block p={[0, 6.83, z]} s={[18.8, 0.069, 0.11]} m={i % 2 ? pale : ice} />
            </group>
          ))}
        </StaticBatch>
      </group>
      <Batch items={floorDashes} material={safety} />
      {[-1, 1].map((side) => (
        <group key={side} ref={side > 0 ? right : left}>
          <StaticBatch>
            <Block
              p={[side * 9.93, 3.8, -1.9]}
              s={[0.46, 7.6, 19.4]}
              m={side > 0 ? gunmetal : wall}
              receive
            />
            {side > 0 && (
              <>
                <Batch items={ridges} material={steel} />
                <Mark
                  value="07"
                  size={[2.9, 1.96]}
                  position={[9.62, 4.61, -5.09]}
                  rotation={[0, -Math.PI / 2, 0]}
                  color="#778d91"
                />
              </>
            )}
            {[-8.7, -5.5, -2.3, 0.9, 4.1, 7.3].map((z, i) => (
              <group key={z}>
                <Block p={[side * 9.37, 3.63, z]} s={[0.45, 7.28, 0.44]} m={steel} cast />
                <Block
                  p={[side * 9.6, 1.5, z + 0.92]}
                  s={[0.15, 2.66, 1.38]}
                  m={i % 2 ? wall : roof}
                />
                <Block
                  p={[side * 9.1, 5.97, z]}
                  s={[0.35, 2.03, 0.3]}
                  r={[0, 0, side * 0.48]}
                  m={gunmetal}
                />
                <Block
                  p={[side * 9.08, 4.9, z]}
                  s={[0.075, 1.1, 0.075]}
                  m={side < 0 ? amber : cyan}
                />
                <Block p={[side * 7.77, 6.7, z + 0.31]} s={[2.03, 0.14, 0.28]} m={black} />
                <Block p={[side * 7.75, 6.61, z + 0.31]} s={[1.85, 0.059, 0.13]} m={pale} />
              </group>
            ))}
            <Block p={[side * 7.05, 0.022, -2.4]} s={[0.07, 0.016, 24.2]} m={runway} />
            <Block p={[side * 5.72, 0.015, -2.4]} s={[0.047, 0.008, 23]} m={runway} />
            <Block
              p={[side * 9.48, 3.05, -1.9]}
              s={[0.22, 0.15, 17.9]}
              m={side > 0 ? ice : safety}
            />
            <Block
              p={[side * 9.43, 2.95, -1.9]}
              s={[0.11, 0.044, 18.2]}
              m={side > 0 ? cyan : amber}
            />
            {[5.8, 7.5, 8.7].map((x, i) => (
              <UtilityBox
                key={x}
                p={[side * x, 0.65 + (i % 2) * 0.28, -7.25 + i * 0.36]}
                size={[1.27, 1.3 + (i % 2) * 0.56, 1.13]}
                beacon={i !== 1}
              />
            ))}
            <Strut
              from={[side * 9.02, 6.52, -10]}
              to={[side * 9.02, 6.52, 7]}
              material={black}
              radius={0.23}
            />
            <Strut
              from={[side * 8.55, 6.42, -10]}
              to={[side * 8.55, 6.42, 7]}
              material={safety}
              radius={0.076}
            />
          </StaticBatch>
        </group>
      ))}
      <Mark
        value="07   /   KEEP CLEAR"
        size={[3.1, 0.35]}
        position={[-5.89, 0.026, 2.5]}
        rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        color="#d29b78"
      />
      <StaticBatch>
        <Platform />
      </StaticBatch>
      <Dust
        seed={seed}
        count={quality === "HIGH" ? 140 : quality === "MEDIUM" ? 72 : 0}
        moving={moving}
      />
    </>
  );
}

export default function HangarScene(props: Props) {
  return (
    <CanvasStage
      quality={props.quality}
      camera={VIEW[props.camera]}
      frozen={props.frozen}
      performance={props.performance}
    >
      <Room seed={props.seed} quality={props.quality} moving={!props.frozen && !props.reduced} />
      <Body
        config={props.config}
        frozen={props.frozen}
        inspection={props.inspection}
        reduced={props.reduced}
      />
      <Rig
        camera={props.camera}
        cameraRevision={props.cameraRevision}
        frozen={props.frozen}
        inspection={props.inspection}
        reduced={props.reduced}
      />
    </CanvasStage>
  );
}
