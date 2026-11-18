import { useEffect, useMemo } from "react";
import * as T from "three";
import type { Vec } from "@/features/flight/physics";

export const steel = new T.MeshStandardMaterial({
  color: "#4e5d68",
  metalness: 0.64,
  roughness: 0.45,
});
export const alloy = new T.MeshStandardMaterial({
  color: "#9daab1",
  metalness: 0.58,
  roughness: 0.34,
});
export const gunmetal = new T.MeshStandardMaterial({
  color: "#202d35",
  metalness: 0.5,
  roughness: 0.51,
});
export const rubber = new T.MeshStandardMaterial({ color: "#111b20", roughness: 0.85 });
export const black = new T.MeshStandardMaterial({
  color: "#111a21",
  metalness: 0.28,
  roughness: 0.38,
});
export const safety = new T.MeshStandardMaterial({
  color: "#bf6b31",
  metalness: 0.2,
  roughness: 0.62,
});
export const wall = new T.MeshStandardMaterial({
  color: "#414d50",
  metalness: 0.32,
  roughness: 0.68,
});
export const cement = new T.MeshStandardMaterial({
  color: "#3a4448",
  metalness: 0.1,
  roughness: 0.73,
});
export const pale = new T.MeshBasicMaterial({ color: "#d6e5df", toneMapped: false });
export const amber = new T.MeshBasicMaterial({ color: "#ff9a57", toneMapped: false });
export const cyan = new T.MeshBasicMaterial({ color: "#6ee5de", toneMapped: false });
export const runway = new T.MeshBasicMaterial({ color: "#426b68" });
const cube = new T.BoxGeometry();
const cylinder = new T.CylinderGeometry(1, 1, 1, 24);
const direction = new T.Vector3(0, 1, 0);

type PartProps = {
  p: Vec;
  s: Vec;
  m: T.Material;
  r?: Vec;
  cast?: boolean;
  receive?: boolean;
};

export function Block({ p, s, m, r, cast = false, receive = false }: PartProps) {
  return (
    <mesh
      geometry={cube}
      material={m}
      position={p}
      scale={s}
      rotation={r}
      castShadow={cast}
      receiveShadow={receive}
    />
  );
}

export function Barrel({ p, s, m, r, cast = false, receive = false }: PartProps) {
  return (
    <mesh
      geometry={cylinder}
      material={m}
      position={p}
      scale={s}
      rotation={r}
      castShadow={cast}
      receiveShadow={receive}
    />
  );
}

export function Strut({
  from,
  to,
  radius,
  material,
  cast = false,
}: {
  from: Vec;
  to: Vec;
  radius: number;
  material: T.Material;
  cast?: boolean;
}) {
  const start = new T.Vector3(...from);
  const end = new T.Vector3(...to);
  const delta = end.clone().sub(start);
  const rotation = new T.Quaternion().setFromUnitVectors(direction, delta.clone().normalize());
  return (
    <mesh
      geometry={cylinder}
      material={material}
      position={start.lerp(end, 0.5)}
      quaternion={rotation}
      scale={[radius, delta.length(), radius]}
      castShadow={cast}
    />
  );
}

export function Mark({
  value,
  position,
  size,
  color = "#b7c9c5",
  rotation,
  align = "center",
}: {
  value: string;
  position: Vec;
  size: [number, number];
  color?: string;
  rotation?: Vec;
  align?: "left" | "center";
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.height = 96;
    canvas.width = Math.round((96 * size[0]) / size[1]);
    const ink = canvas.getContext("2d");
    if (ink) {
      ink.fillStyle = color;
      ink.font = "bold 66px Arial Narrow, sans-serif";
      if (align === "left") {
        ink.textAlign = "left";
        ink.fillText(value, 8, 72, canvas.width - 16);
      } else {
        ink.textAlign = "center";
        ink.fillText(value, canvas.width / 2, 72, canvas.width - 16);
      }
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [align, color, size, value]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation} scale={[...size, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export function seeded(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

/** Small shared procedural concrete tile, tiling over the whole floor. */
export function Concrete({
  seed,
  size,
  position,
  repeat,
}: {
  seed: number;
  size: [number, number];
  position: Vec;
  repeat: [number, number];
}) {
  const [u, v] = repeat;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const random = seeded(seed);
      ctx.fillStyle = "#566168";
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 1100; i++) {
        ctx.fillStyle = i % 3 ? "rgba(12,20,22,.075)" : "rgba(178,193,201,.11)";
        ctx.fillRect(random() * 128, random() * 128, random() * 12 + 1, random() * 3 + 1);
      }
      ctx.strokeStyle = "#353f43";
      ctx.strokeRect(0, 0, 128, 128);
    }
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(u, v);
    tex.anisotropy = 8;
    return tex;
  }, [seed, u, v]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial map={texture} color="#a3b0b7" metalness={0.12} roughness={0.85} />
    </mesh>
  );
}
