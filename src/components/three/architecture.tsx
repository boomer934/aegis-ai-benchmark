import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import type { Vec } from "@/features/flight/physics";
import { amber, Block, cement, cyan, gunmetal, pale, seeded, steel } from "./parts";

type Instance = { p: Vec; s: Vec; ry?: number };
const cube = new T.BoxGeometry();
export function Batch({ items, material }: { items: Instance[]; material: T.Material }) {
  const ref = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new T.Object3D();
    items.forEach(({ p, s, ry }, i) => {
      transform.position.set(...p);
      transform.scale.set(...s);
      transform.rotation.y = ry ?? 0;
      transform.updateMatrix();
      mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[cube, material, items.length]} receiveShadow />;
}

export function Dust({
  seed,
  count,
  flight = false,
  moving,
}: {
  seed: number;
  count: number;
  flight?: boolean;
  moving: boolean;
}) {
  const group = useRef<T.Points>(null);
  const positions = useMemo(() => {
    const random = seeded(seed + 51);
    return Float32Array.from({ length: count * 3 }, (_, i) => {
      const n = random();
      return i % 3 === 0
        ? (n - 0.5) * (flight ? 54 : 28)
        : i % 3 === 1
          ? n * 10 + 0.4
          : (n - 0.7) * (flight ? 114 : 24);
    });
  }, [count, flight, seed]);
  useFrame(({ clock }) => {
    if (group.current && moving) {
      group.current.position.y = Math.sin(clock.elapsedTime * 0.29) * 0.25;
      group.current.position.x = Math.cos(clock.elapsedTime * 0.16) * 0.6;
    }
  });
  if (!count) return null;
  return (
    <points ref={group}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#b2bdae"
        size={flight ? 0.07 : 0.033}
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </points>
  );
}

export function UtilityBox({ p, size, beacon = true }: { p: Vec; size: Vec; beacon?: boolean }) {
  const [w, h, d] = size;
  return (
    <group position={p}>
      <Block p={[0, 0, 0]} s={size} m={cement} cast receive />
      <Block p={[0, h / 2 + 0.018, 0]} s={[w + 0.07, 0.085, d + 0.07]} m={steel} />
      <Block p={[0, -h / 2 + 0.1, 0]} s={[w + 0.08, 0.19, d + 0.08]} m={gunmetal} />
      {[-1, 1].map((i) => (
        <group key={i}>
          <Block p={[i * (w / 2 - 0.125), 0, d / 2 + 0.029]} s={[0.18, h, 0.09]} m={steel} />
          <Block
            p={[i * (w / 2 - 0.39), h * 0.31, d / 2 + 0.028]}
            s={[0.26, 0.089, 0.09]}
            m={beacon && i > 0 ? amber : pale}
          />
        </group>
      ))}
      <Block p={[0, 0, d / 2 + 0.028]} s={[w * 0.67, h * 0.56, 0.05]} m={gunmetal} />
      {Array.from({ length: 5 }, (_, i) => (
        <Block
          key={i}
          p={[0, (i - 2) * h * 0.085, d / 2 + 0.064]}
          s={[w * 0.6, 0.038, 0.035]}
          m={steel}
        />
      ))}
      {beacon && <Block p={[0, h / 2 + 0.067, 0]} s={[w * 0.52, 0.027, 0.1]} m={cyan} />}
    </group>
  );
}
