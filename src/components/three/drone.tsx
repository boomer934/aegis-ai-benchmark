import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import { PAINTS, type Configuration, type Vec } from "@/features/flight/physics";
import {
  alloy,
  amber,
  Barrel,
  black,
  Block,
  cyan,
  gunmetal,
  Mark,
  rubber,
  safety,
  steel,
  Strut,
} from "./parts";
import { StaticBatch } from "./static-batch";

type Slice = [z: number, halfWidth: number, bottom: number, top: number];

function loft(sections: Slice[]) {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const [z, w, lo, hi] of sections) {
    const mid = (lo + hi) / 2;
    vertices.push(
      -w * 0.69,
      lo,
      z,
      w * 0.69,
      lo,
      z,
      w,
      lo + (mid - lo) * 0.65,
      z,
      w,
      mid + (hi - mid) * 0.4,
      z,
      w * 0.67,
      hi,
      z,
      -w * 0.67,
      hi,
      z,
      -w,
      mid + (hi - mid) * 0.4,
      z,
      -w,
      lo + (mid - lo) * 0.65,
      z,
    );
  }
  for (let row = 0; row < sections.length - 1; row++) {
    for (let i = 0; i < 8; i++) {
      const a = row * 8 + i;
      const b = row * 8 + ((i + 1) % 8);
      indices.push(a, b, a + 8, b, b + 8, a + 8);
    }
  }
  const end = (sections.length - 1) * 8;
  for (let i = 1; i < 7; i++) indices.push(0, i + 1, i, end, end + i, end + i + 1);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

const shell = loft([
  [-1.76, 0.42, -0.21, 0.23],
  [-1.32, 0.94, -0.39, 0.47],
  [-0.55, 1.09, -0.45, 0.58],
  [0.6, 1.03, -0.48, 0.56],
  [1.38, 0.73, -0.35, 0.39],
  [1.77, 0.44, -0.24, 0.19],
]);
const crown = loft([
  [-1.44, 0.37, 0.29, 0.43],
  [-0.95, 0.61, 0.38, 0.64],
  [-0.27, 0.68, 0.46, 0.74],
  [0.58, 0.65, 0.41, 0.7],
  [1.22, 0.46, 0.3, 0.48],
  [1.5, 0.27, 0.24, 0.37],
]);
const shoulder = loft([
  [-0.7, 0.12, -0.12, 0.13],
  [-0.35, 0.29, -0.2, 0.23],
  [0.47, 0.29, -0.18, 0.16],
  [0.78, 0.17, -0.1, 0.1],
]);
const duct = new T.CylinderGeometry(1.11, 1.04, 0.27, 44, 1, true);
const ductMaterial = new T.MeshStandardMaterial({
  color: "#596970",
  metalness: 0.62,
  roughness: 0.42,
  side: T.DoubleSide,
});
const ring = new T.TorusGeometry(1.075, 0.062, 8, 48);
const rim = new T.TorusGeometry(1.015, 0.026, 6, 48, Math.PI * 0.6);
const glass = new T.MeshPhysicalMaterial({
  color: "#0e2937",
  metalness: 0.6,
  roughness: 0.16,
  clearcoat: 1,
});
const lens = new T.MeshStandardMaterial({
  color: "#469684",
  emissive: "#136d66",
  emissiveIntensity: 0.7,
  metalness: 0.7,
  roughness: 0.22,
});

function bladeGeometry() {
  const shape = new T.Shape();
  shape.moveTo(0.06, -0.09);
  shape.bezierCurveTo(0.35, -0.1, 0.71, -0.18, 0.97, -0.066);
  shape.quadraticCurveTo(0.99, 0.034, 0.82, 0.094);
  shape.bezierCurveTo(0.53, 0.128, 0.3, 0.1, 0.06, 0.07);
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {
    depth: 0.028,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.008,
    bevelSegments: 1,
    curveSegments: 8,
  });
}
const blade = bladeGeometry();
const boltPositions = Array.from({ length: 6 }, (_, i) => [
  Math.cos((i * Math.PI) / 3),
  Math.sin((i * Math.PI) / 3),
]);

function Rotor({
  p,
  index,
  lights,
  moving,
  rpm,
  paint,
}: {
  p: Vec;
  index: number;
  lights: boolean;
  moving: boolean;
  rpm: number;
  paint: T.Material;
}) {
  const spin = useRef<T.Group>(null);
  useFrame((_, delta) => {
    if (spin.current && moving)
      spin.current.rotation.y += Math.min(delta, 0.05) * rpm * (index % 2 ? -1 : 1);
  });
  return (
    <group position={p}>
      <mesh geometry={duct} material={ductMaterial} castShadow />
      <mesh
        geometry={ring}
        material={alloy}
        position={[0, 0.16, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <mesh
        geometry={ring}
        material={gunmetal}
        position={[0, -0.14, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
      {[0, Math.PI].map((a) => (
        <mesh
          key={a}
          geometry={rim}
          material={lights ? (index < 2 ? cyan : amber) : steel}
          position={[0, 0.175, 0]}
          rotation={[-Math.PI / 2, 0, a + index * 0.55]}
        />
      ))}
      {boltPositions.map(([x, z], i) => (
        <group key={i}>
          <Block
            p={[x * 1.065, -0.015, z * 1.065]}
            s={[0.22, 0.31, 0.16]}
            r={[0, -Math.atan2(z, x), 0]}
            m={i % 2 ? gunmetal : paint}
          />
          <Barrel p={[x * 1.065, 0.17, z * 1.065]} s={[0.036, 0.022, 0.036]} m={black} />
        </group>
      ))}
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
          <Block p={[0.57, -0.11, 0]} s={[0.9, 0.067, 0.111]} m={gunmetal} />
        </group>
      ))}
      <Barrel p={[0, -0.03, 0]} s={[0.24, 0.31, 0.24]} m={steel} cast />
      <Barrel p={[0, 0.12, 0]} s={[0.17, 0.14, 0.17]} m={alloy} />
      <group ref={spin} rotation={[0, index * 1.35 + 0.35, 0]} userData={{ animated: true }}>
        {[0, 1, 2].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
            <mesh
              geometry={blade}
              material={black}
              position={[0, 0.13, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              castShadow
            />
            <Block p={[0.87, 0.164, 0.025]} s={[0.123, 0.011, 0.087]} m={safety} />
          </group>
        ))}
      </group>
      <Barrel p={[0, 0.216, 0]} s={[0.076, 0.057, 0.076]} m={safety} />
    </group>
  );
}

const engines = {
  ECO: 8,
  SPORT: 13,
  RACE: 20,
};
function finishMaterials(finish: (typeof PAINTS)[Configuration["paint"]]) {
  return {
    skin: new T.MeshPhysicalMaterial({
      color: finish.color,
      metalness: 0.5,
      roughness: 0.32,
      clearcoat: 0.45,
      clearcoatRoughness: 0.34,
    }),
    accent: new T.MeshStandardMaterial({ color: finish.accent, metalness: 0.38, roughness: 0.42 }),
  };
}
const paintMaterials = {
  Arctic: finishMaterials(PAINTS.Arctic),
  Ember: finishMaterials(PAINTS.Ember),
  Carbon: finishMaterials(PAINTS.Carbon),
};

export function Drone({
  config,
  moving,
  detailed = true,
}: {
  config: Configuration;
  moving: boolean;
  detailed?: boolean;
}) {
  const { skin, accent } = paintMaterials[config.paint];
  return (
    <StaticBatch revision={`${config.paint}:${config.lights}`}>
      <mesh geometry={shell} material={gunmetal} castShadow />
      <mesh geometry={crown} material={skin} castShadow />
      <Block p={[0, 0.392, 1.285]} s={[0.61, 0.12, 0.41]} m={glass} r={[-0.3, 0, 0]} />
      <Block p={[0, 0.684, -0.38]} s={[0.72, 0.08, 0.6]} m={black} />
      <Block p={[0, 0.741, -0.77]} s={[0.69, 0.065, 0.1]} m={accent} r={[0.17, 0, 0]} />
      <Block p={[0, 0.61, 0.715]} s={[0.88, 0.083, 0.19]} m={accent} r={[-0.18, 0, 0]} />
      <Barrel p={[0, -0.3, 1.43]} s={[0.29, 0.22, 0.27]} m={alloy} />
      <Barrel p={[0, -0.48, 1.58]} s={[0.255, 0.22, 0.255]} m={black} r={[Math.PI / 2, 0, 0]} />
      <Barrel p={[0, -0.48, 1.705]} s={[0.183, 0.065, 0.183]} m={alloy} r={[Math.PI / 2, 0, 0]} />
      <Barrel p={[0, -0.48, 1.75]} s={[0.139, 0.05, 0.139]} m={glass} r={[Math.PI / 2, 0, 0]} />
      <Barrel p={[-0.04, -0.45, 1.78]} s={[0.056, 0.01, 0.056]} m={lens} r={[Math.PI / 2, 0, 0]} />
      {detailed && (
        <Mark
          value="AEGIS   /   07"
          size={[0.82, 0.17]}
          position={[0, 0.742, 0.08]}
          rotation={[-Math.PI / 2, 0, 0]}
          color="#253239"
        />
      )}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={shoulder}
            material={skin}
            position={[side * 0.97, 0.02, 0.13]}
            castShadow
          />
          <Block
            p={[side * 0.91, 0.306, 0.56]}
            s={[0.31, 0.11, 0.64]}
            m={accent}
            r={[0.08, side * 0.18, side * 0.22]}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <Block
              key={i}
              p={[side * 0.948, 0.361, -0.22 - i * 0.117]}
              s={[0.24, 0.025, 0.046]}
              m={black}
              r={[0.14, side * 0.23, side * 0.24]}
            />
          ))}
          <Block
            p={[side * 0.34, 0.14, 1.694]}
            s={[0.22, 0.053, 0.135]}
            m={config.lights ? cyan : black}
            r={[0.17, side * 0.22, 0]}
          />
          <Block
            p={[side * 0.39, 0.07, -1.68]}
            s={[0.19, 0.049, 0.115]}
            m={config.lights ? amber : black}
          />
          <Strut
            from={[side * 0.72, -0.19, 0.69]}
            to={[side * 1.13, -0.78, 0.78]}
            material={alloy}
            radius={0.081}
            cast
          />
          <Strut
            from={[side * 0.65, -0.26, -0.74]}
            to={[side * 1.13, -0.78, -0.77]}
            material={steel}
            radius={0.074}
            cast
          />
          <Strut
            from={[side * 1.13, -0.8, -1.14]}
            to={[side * 1.13, -0.8, 1.05]}
            material={black}
            radius={0.085}
            cast
          />
          <Strut
            from={[side * 1.13, -0.8, 1.02]}
            to={[side * 1.13, -0.68, 1.27]}
            material={black}
            radius={0.084}
          />
          {[-0.85, 0.8].map((z) => (
            <Block key={z} p={[side * 1.13, -0.86, z]} s={[0.23, 0.09, 0.38]} m={rubber} />
          ))}
          {[-1, 1].map((nose) => {
            const x = side * 2.56;
            const z = nose * (nose > 0 ? 1.65 : 1.56);
            const root = side * 0.74;
            return (
              <group key={nose}>
                <Strut
                  from={[root, -0.02, nose * 0.72]}
                  to={[x, 0.17, z]}
                  material={gunmetal}
                  radius={0.185}
                  cast
                />
                <Strut
                  from={[root, 0.17, nose * 0.54]}
                  to={[x, 0.29, z]}
                  material={alloy}
                  radius={0.093}
                  cast
                />
                <Strut
                  from={[root, -0.18, nose * 0.96]}
                  to={[x, 0.07, z]}
                  material={steel}
                  radius={0.083}
                />
                <Strut
                  from={[side * 1.17, 0.23, nose * 0.86]}
                  to={[side * 1.79, 0.27, nose * 1.19]}
                  material={accent}
                  radius={0.112}
                />
                <Barrel p={[side * 1.11, 0.27, nose * 0.78]} s={[0.168, 0.08, 0.168]} m={black} />
                <Barrel p={[side * 1.11, 0.32, nose * 0.78]} s={[0.088, 0.048, 0.088]} m={alloy} />
                <Rotor
                  p={[x, 0.18, z]}
                  index={side + 1 + Number(nose < 0)}
                  lights={config.lights}
                  moving={moving}
                  rpm={engines[config.profile]}
                  paint={accent}
                />
              </group>
            );
          })}
        </group>
      ))}
    </StaticBatch>
  );
}
