import type { Vec3 } from "./vec";

/**
 * Static description of the flight-test arena. Shared by the physics (collision
 * volumes, checkpoint planes) and the renderer, so what you see is what you hit.
 * Units are metres; +Y is up and the course runs toward -Z.
 */

export interface ArenaBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
  ceilingY: number;
}

/** Oriented box rotated only around Y (yaw). */
export interface BoxObstacle {
  kind: "box";
  id: string;
  center: Vec3;
  half: Vec3;
  yaw: number;
  /** Visual role, used by the renderer to choose geometry/material. */
  role: "block" | "beam" | "wall" | "gate-frame";
}

/** Vertical cylinder (pillar, mast). */
export interface CylinderObstacle {
  kind: "cylinder";
  id: string;
  x: number;
  z: number;
  radius: number;
  minY: number;
  maxY: number;
  role: "pillar" | "mast";
}

export type Obstacle = BoxObstacle | CylinderObstacle;

export interface Gate {
  /** 1-based number displayed on the gate. */
  number: number;
  center: Vec3;
  /** Rotation around Y. Normal (direction of valid passage) = (-sin yaw, 0, -cos yaw). */
  yaw: number;
  normal: Vec3;
  /** Half extents of the valid opening. */
  halfWidth: number;
  halfHeight: number;
}

export interface ArenaDefinition {
  bounds: ArenaBounds;
  start: Vec3;
  gates: Gate[];
  obstacles: Obstacle[];
}

export const GATE_HALF_WIDTH = 3.6;
export const GATE_HALF_HEIGHT = 2.6;
export const GATE_FRAME_THICKNESS = 0.5;
export const DRONE_RADIUS = 0.6;
/** Height of the drone centre when resting on its landing gear on the floor. */
export const DRONE_REST_HEIGHT = 0.3;

const GATE_CENTERS: Vec3[] = [
  { x: 0, y: 4, z: -20 },
  { x: -15, y: 7, z: -50 },
  { x: 12, y: 10.5, z: -82 },
  { x: -6, y: 5, z: -114 },
  { x: 9, y: 8, z: -146 },
];

export const START_POSITION: Vec3 = { x: 0, y: DRONE_REST_HEIGHT, z: 6 };

function buildGates(): Gate[] {
  let prev: Vec3 = START_POSITION;
  return GATE_CENTERS.map((center, i) => {
    const dx = center.x - prev.x;
    const dz = center.z - prev.z;
    // Face the gate toward the approach from the previous gate.
    const yaw = Math.atan2(-dx, -dz);
    prev = center;
    return {
      number: i + 1,
      center,
      yaw,
      normal: { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
      halfWidth: GATE_HALF_WIDTH,
      halfHeight: GATE_HALF_HEIGHT,
    };
  });
}

/** Gate frames are solid: posts and bars around the opening are collision volumes. */
function gateFrameObstacles(gate: Gate): BoxObstacle[] {
  const t = GATE_FRAME_THICKNESS / 2;
  const { center, yaw, halfWidth: hw, halfHeight: hh } = gate;
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const post = (side: 1 | -1): BoxObstacle => ({
    kind: "box",
    id: `gate${gate.number}-post${side > 0 ? "R" : "L"}`,
    center: {
      x: center.x + right.x * side * (hw + t),
      y: center.y,
      z: center.z + right.z * side * (hw + t),
    },
    half: { x: t, y: hh + 2 * t, z: t },
    yaw,
    role: "gate-frame",
  });
  const bar = (side: 1 | -1): BoxObstacle => ({
    kind: "box",
    id: `gate${gate.number}-bar${side > 0 ? "T" : "B"}`,
    center: { x: center.x, y: center.y + side * (hh + t), z: center.z },
    half: { x: hw, y: t, z: t },
    yaw,
    role: "gate-frame",
  });
  return [post(-1), post(1), bar(1), bar(-1)];
}

const COURSE_OBSTACLES: Obstacle[] = [
  {
    kind: "cylinder",
    id: "pillar-a",
    x: 9,
    z: -34,
    radius: 1.6,
    minY: 0,
    maxY: 30,
    role: "pillar",
  },
  {
    kind: "cylinder",
    id: "pillar-b",
    x: -27,
    z: -38,
    radius: 1.8,
    minY: 0,
    maxY: 30,
    role: "pillar",
  },
  { kind: "cylinder", id: "pillar-c", x: -9, z: -66, radius: 2, minY: 0, maxY: 30, role: "pillar" },
  {
    kind: "cylinder",
    id: "pillar-d",
    x: 26,
    z: -100,
    radius: 1.8,
    minY: 0,
    maxY: 30,
    role: "pillar",
  },
  {
    kind: "cylinder",
    id: "pillar-e",
    x: -22,
    z: -128,
    radius: 1.6,
    minY: 0,
    maxY: 30,
    role: "pillar",
  },
  { kind: "cylinder", id: "mast-a", x: 22, z: -62, radius: 0.7, minY: 0, maxY: 18, role: "mast" },
  { kind: "cylinder", id: "mast-b", x: -18, z: -95, radius: 0.7, minY: 0, maxY: 18, role: "mast" },
  { kind: "cylinder", id: "mast-c", x: 24, z: -140, radius: 0.7, minY: 0, maxY: 18, role: "mast" },
  {
    kind: "box",
    id: "block-a",
    center: { x: 2, y: 2.2, z: -98 },
    half: { x: 3.5, y: 2.2, z: 2.5 },
    yaw: 0.35,
    role: "block",
  },
  {
    kind: "box",
    id: "block-b",
    center: { x: -14, y: 15.5, z: -66 },
    half: { x: 6, y: 1.2, z: 3 },
    yaw: -0.2,
    role: "beam",
  },
  {
    kind: "box",
    id: "block-c",
    center: { x: 2, y: 13.5, z: -130 },
    half: { x: 10, y: 0.8, z: 1.2 },
    yaw: 0.1,
    role: "beam",
  },
  {
    kind: "box",
    id: "wall-a",
    center: { x: 30, y: 6, z: -40 },
    half: { x: 9, y: 6, z: 0.8 },
    yaw: 0,
    role: "wall",
  },
  {
    kind: "box",
    id: "wall-b",
    center: { x: -30, y: 6, z: -108 },
    half: { x: 9, y: 6, z: 0.8 },
    yaw: 0,
    role: "wall",
  },
];

export function createArena(): ArenaDefinition {
  const gates = buildGates();
  return {
    bounds: { minX: -45, maxX: 45, minZ: -175, maxZ: 18, floorY: 0, ceilingY: 32 },
    start: { ...START_POSITION },
    gates,
    obstacles: [...COURSE_OBSTACLES, ...gates.flatMap(gateFrameObstacles)],
  };
}

/** Shared immutable arena instance. */
export const ARENA: ArenaDefinition = createArena();

/** Straight-line length of the course (start → gate 1 → … → gate 5), metres. */
export function courseLength(arena: ArenaDefinition = ARENA): number {
  let prev = arena.start;
  let total = 0;
  for (const g of arena.gates) {
    total += Math.hypot(g.center.x - prev.x, g.center.y - prev.y, g.center.z - prev.z);
    prev = g.center;
  }
  return total;
}
