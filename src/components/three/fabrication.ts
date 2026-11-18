import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
export type Triple = [number, number, number];
export const alloy = (color: string, metalness = 0.55, roughness = 0.38) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
export const luminous = (color: string, intensity = 1.2) =>
  new T.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
  });
const zero: Triple = [0, 0, 0];
/** Bake stationary parts in local space. Each finish costs one draw per assembly. */
export class Fabricator {
  private batches = new Map<T.Material, T.BufferGeometry[]>();
  part(
    geometry: T.BufferGeometry,
    material: T.Material,
    p: Triple = zero,
    r: Triple = zero,
    s: Triple = [1, 1, 1],
  ) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    if (!g.attributes.uv)
      g.setAttribute(
        "uv",
        new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2),
      );
    g.applyMatrix4(
      new T.Matrix4().compose(
        new T.Vector3(...p),
        new T.Quaternion().setFromEuler(new T.Euler(...r)),
        new T.Vector3(...s),
      ),
    );
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material)!.push(g);
  }
  box(p: Triple, size: Triple, m: T.Material, r: Triple = zero) {
    this.part(new T.BoxGeometry(...size), m, p, r);
  }
  cylinder(p: Triple, a: number, b: number, h: number, m: T.Material, n = 32) {
    this.part(new T.CylinderGeometry(a, b, h, n), m, p);
  }
  rod(a: Triple, b: Triple, width: number, m: T.Material, sides = 8) {
    const av = new T.Vector3(...a),
      bv = new T.Vector3(...b),
      diff = bv.clone().sub(av);
    const rot = new T.Euler().setFromQuaternion(
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), diff.clone().normalize()),
    );
    this.part(
      new T.CylinderGeometry(width, width, diff.length(), sides),
      m,
      av.lerp(bv, 0.5).toArray(),
      [rot.x, rot.y, rot.z],
    );
  }
  arc(
    p: Triple,
    radius: number,
    tube: number,
    m: T.Material,
    start = 0,
    arc = Math.PI * 2,
    segments = 72,
  ) {
    const g = new T.TorusGeometry(radius, tube, 6, segments, arc);
    g.rotateZ(start);
    g.rotateX(-Math.PI / 2);
    this.part(g, m, p);
  }
  finish() {
    const group = new T.Group();
    for (const [mat, parts] of this.batches) {
      const merged = mergeGeometries(parts)!;
      const mesh = new T.Mesh(merged, mat);
      mesh.castShadow = !mat.transparent;
      mesh.receiveShadow = !mat.transparent;
      group.add(mesh);
      parts.forEach((g) => g.dispose());
    }
    this.batches.clear();
    return group;
  }
}
export function surface(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
export function decal(text: string, bg: string, color: string) {
  const map = surface(512, 128, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "bold 86px Arial";
    const scale = Math.min(3.3, 460 / c.measureText(text).width);
    c.translate(256, 66);
    c.scale(scale, 1);
    c.fillText(text, 0, 0);
  });
  return new T.MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.15 });
}
export function release(root: T.Object3D) {
  const materials = new Set<T.Material>();
  const geometries = new Set<T.BufferGeometry>();
  root.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points) {
      geometries.add(o.geometry);
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materials.add(m));
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    if ("map" in m && m.map instanceof T.Texture) m.map.dispose();
    m.dispose();
  });
}
/** Prefilter a private rig of ceiling strips, cool glazing and service lamps for metal reflections. */
export function facilityReflections(renderer: T.WebGLRenderer) {
  const rig = new T.Scene();
  rig.background = new T.Color("#526471");
  function reflector(
    position: Triple,
    width: number,
    height: number,
    color: string,
    radiance: number,
  ) {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(width, height),
      new T.MeshBasicMaterial({
        color: new T.Color(color).multiplyScalar(radiance),
        toneMapped: false,
      }),
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    rig.add(mesh);
  }
  reflector([-4, 2, 1], 3.6, 2.1, "#bce9ff", 2.65);
  reflector([4, 1.9, 2.7], 2.1, 3.2, "#ffe1c1", 2.05);
  reflector([0, 1, -5], 6, 0.55, "#83d4e1", 2.7);
  for (const x of [-2.2, 0, 2.2]) reflector([x, 5, -0.8], 0.44, 6.1, "#f2f8ff", 3.4);
  reflector([0, -4, 0], 7, 7, "#243034", 0.75);
  const generator = new T.PMREMGenerator(renderer);
  const reflection = generator.fromScene(rig, 0.045);
  release(rig);
  generator.dispose();
  return reflection;
}
export function seeded(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(1664525, n) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
