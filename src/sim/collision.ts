import type { ArenaDefinition, BoxObstacle, CylinderObstacle, Obstacle } from "./arena";
import type { Vec3 } from "./vec";

/** Result of resolving a sphere against the arena: push-out normal and penetration. */
export interface Contact {
  /** Unit normal pointing away from the surface, toward the drone. */
  nx: number;
  ny: number;
  nz: number;
  depth: number;
  surface: "floor" | "ceiling" | "wall" | "obstacle";
  obstacleId?: string;
}

function sphereVsBox(p: Readonly<Vec3>, r: number, box: BoxObstacle): Contact | null {
  const c = Math.cos(box.yaw);
  const s = Math.sin(box.yaw);
  const dx = p.x - box.center.x;
  const dy = p.y - box.center.y;
  const dz = p.z - box.center.z;
  // World → local (inverse yaw rotation).
  const lx = dx * c - dz * s;
  const ly = dy;
  const lz = dx * s + dz * c;
  const { x: hx, y: hy, z: hz } = box.half;
  if (Math.abs(lx) > hx + r || Math.abs(ly) > hy + r || Math.abs(lz) > hz + r) return null;

  const qx = Math.max(-hx, Math.min(hx, lx));
  const qy = Math.max(-hy, Math.min(hy, ly));
  const qz = Math.max(-hz, Math.min(hz, lz));
  let ox = lx - qx;
  let oy = ly - qy;
  let oz = lz - qz;
  const dist = Math.hypot(ox, oy, oz);
  let depth: number;

  if (dist > 1e-9) {
    if (dist >= r) return null;
    ox /= dist;
    oy /= dist;
    oz /= dist;
    depth = r - dist;
  } else {
    // Centre inside the box: push out along the axis of least penetration.
    const px = hx - Math.abs(lx);
    const py = hy - Math.abs(ly);
    const pz = hz - Math.abs(lz);
    ox = oy = oz = 0;
    if (px <= py && px <= pz) {
      ox = lx >= 0 ? 1 : -1;
      depth = px + r;
    } else if (py <= pz) {
      oy = ly >= 0 ? 1 : -1;
      depth = py + r;
    } else {
      oz = lz >= 0 ? 1 : -1;
      depth = pz + r;
    }
  }
  // Local → world.
  return {
    nx: ox * c + oz * s,
    ny: oy,
    nz: -ox * s + oz * c,
    depth,
    surface: "obstacle",
    obstacleId: box.id,
  };
}

function sphereVsCylinder(p: Readonly<Vec3>, r: number, cyl: CylinderObstacle): Contact | null {
  if (p.y < cyl.minY - r || p.y > cyl.maxY + r) return null;
  const dx = p.x - cyl.x;
  const dz = p.z - cyl.z;
  const radial = Math.hypot(dx, dz);
  if (radial >= cyl.radius + r) return null;

  // Top cap contact when above the cylinder.
  if (p.y > cyl.maxY && radial < cyl.radius) {
    return {
      nx: 0,
      ny: 1,
      nz: 0,
      depth: cyl.maxY + r - p.y,
      surface: "obstacle",
      obstacleId: cyl.id,
    };
  }
  const inv = radial > 1e-9 ? 1 / radial : 0;
  return {
    nx: radial > 1e-9 ? dx * inv : 1,
    ny: 0,
    nz: radial > 1e-9 ? dz * inv : 0,
    depth: cyl.radius + r - radial,
    surface: "obstacle",
    obstacleId: cyl.id,
  };
}

export function sphereVsObstacle(p: Readonly<Vec3>, r: number, o: Obstacle): Contact | null {
  return o.kind === "box" ? sphereVsBox(p, r, o) : sphereVsCylinder(p, r, o);
}

/**
 * Find every contact between the drone sphere and the arena (bounds + obstacles).
 * The caller resolves them; returning a list keeps this function pure and testable.
 */
export function findContacts(
  p: Readonly<Vec3>,
  r: number,
  arena: ArenaDefinition,
  restHeight: number,
): Contact[] {
  const out: Contact[] = [];
  const b = arena.bounds;
  if (p.y < b.floorY + restHeight) {
    out.push({ nx: 0, ny: 1, nz: 0, depth: b.floorY + restHeight - p.y, surface: "floor" });
  }
  if (p.y > b.ceilingY - r)
    out.push({ nx: 0, ny: -1, nz: 0, depth: p.y - (b.ceilingY - r), surface: "ceiling" });
  if (p.x < b.minX + r) out.push({ nx: 1, ny: 0, nz: 0, depth: b.minX + r - p.x, surface: "wall" });
  if (p.x > b.maxX - r)
    out.push({ nx: -1, ny: 0, nz: 0, depth: p.x - (b.maxX - r), surface: "wall" });
  if (p.z < b.minZ + r) out.push({ nx: 0, ny: 0, nz: 1, depth: b.minZ + r - p.z, surface: "wall" });
  if (p.z > b.maxZ - r)
    out.push({ nx: 0, ny: 0, nz: -1, depth: p.z - (b.maxZ - r), surface: "wall" });
  for (const o of arena.obstacles) {
    const c = sphereVsObstacle(p, r, o);
    if (c) out.push(c);
  }
  return out;
}
