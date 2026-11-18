import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  InstancedMesh,
  Matrix4,
  Mesh,
  type BufferGeometry,
  type Group,
  type Material,
  type Object3D,
} from "three";

type Part = Mesh<BufferGeometry, Material>;
function gather(node: Object3D, batches: Map<string, Part[]>) {
  // Keep animated subtrees, order-dependent decals and explicit instances independent.
  if (node.userData.animated) return;
  if (
    node instanceof Mesh &&
    !(node instanceof InstancedMesh) &&
    node.visible &&
    !Array.isArray(node.material) &&
    !node.material.transparent
  ) {
    const key = [node.geometry.id, node.material.id, +node.castShadow, +node.receiveShadow].join(
      "/",
    );
    const parts = batches.get(key);
    if (parts) parts.push(node);
    else batches.set(key, [node]);
  }
  for (const child of node.children) gather(child, batches);
}

/** Batches identical rigid parts in local space, preserving the parent's animation and cutaways. */
export function StaticBatch({
  children,
  revision,
}: {
  children: ReactNode;
  revision?: string | number;
}) {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const local = new Matrix4();
    const grouped = new Map<string, Part[]>();
    const installed: { instances: InstancedMesh; parts: Part[] }[] = [];
    gather(root, grouped);
    for (const parts of grouped.values()) {
      if (parts.length < 2) continue;
      const prototype = parts[0];
      const instances = new InstancedMesh(prototype.geometry, prototype.material, parts.length);
      instances.castShadow = prototype.castShadow;
      instances.receiveShadow = prototype.receiveShadow;
      parts.forEach((part, i) => {
        instances.setMatrixAt(i, local.multiplyMatrices(inverse, part.matrixWorld));
        part.visible = false;
      });
      instances.instanceMatrix.needsUpdate = true;
      instances.computeBoundingSphere();
      root.add(instances);
      installed.push({ instances, parts });
    }
    return () => {
      for (const { instances, parts } of installed) {
        root.remove(instances);
        instances.dispose();
        for (const part of parts) part.visible = true;
      }
    };
  }, [revision]);
  return <group ref={ref}>{children}</group>;
}
