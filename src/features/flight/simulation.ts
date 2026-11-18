export const PROFILES = {
  ECO: { acceleration: 9, speed: 6, drag: 1.35, drain: 0.48 },
  SPORT: { acceleration: 15, speed: 10, drag: 1.2, drain: 0.73 },
  RACE: { acceleration: 22, speed: 15, drag: 1.05, drain: 1.03 },
} as const;
export type Profile = keyof typeof PROFILES;
export const PAINTS = { Signal: "#f27a28", Glacier: "#b7d7de", Ion: "#997eb7" } as const;
export type Paint = keyof typeof PAINTS;
export type Vector = { x: number; y: number; z: number };
export type Phase = "standby" | "countdown" | "running" | "paused" | "success" | "timeout";
export const GATES: Vector[] = [
  { x: 0, y: 3, z: 11 },
  { x: -4, y: 4.5, z: 1 },
  { x: 3, y: 5.5, z: -11 },
  { x: 5, y: 3, z: -22 },
  { x: -2, y: 4, z: -34 },
];
export const GATE_RADIUS = 2.4;
export const OBSTACLES = [
  { x: 4, z: 6, radius: 1.55, height: 5.5 },
  { x: -6, z: -8, radius: 2, height: 7 },
  { x: 0, z: -19, radius: 1.45, height: 6 },
  { x: 7, z: -30, radius: 1.5, height: 4.5 },
];
export const STEP = 1 / 120;
export const LIMIT = 60;
export type Input = { x: number; y: number; z: number; boost: boolean };
export const NEUTRAL: Input = { x: 0, y: 0, z: 0, boost: false };
export type Flight = {
  phase: Phase;
  position: Vector;
  velocity: Vector;
  elapsed: number;
  countdown: number;
  gates: number;
  collisions: number;
  contact: boolean;
  battery: number;
  roll: number;
  pitch: number;
};
export function freshFlight(): Flight {
  return {
    phase: "standby",
    position: { x: 0, y: 3, z: 20 },
    velocity: { x: 0, y: 0, z: 0 },
    elapsed: 0,
    countdown: 3,
    gates: 0,
    collisions: 0,
    contact: false,
    battery: 100,
    roll: 0,
    pitch: 0,
  };
}
export function score(gates: number, collisions: number, durationMs: number) {
  return Math.max(
    0,
    gates * 1000 -
      collisions * 150 +
      (gates === GATES.length ? Math.floor((LIMIT * 1000 - durationMs) / 100) : 0),
  );
}
export function crossedGate(from: Vector, to: Vector, gate: Vector) {
  if (from.z <= gate.z || to.z > gate.z) return false;
  const fraction = (from.z - gate.z) / (from.z - to.z);
  return (
    Math.hypot(
      from.x + fraction * (to.x - from.x) - gate.x,
      from.y + fraction * (to.y - from.y) - gate.y,
    ) <=
    GATE_RADIUS - 0.35
  );
}
export function tick(f: Flight, input: Input, profile: Profile) {
  if (f.phase === "countdown") {
    f.countdown -= STEP;
    if (f.countdown <= 0.000001) f.phase = "running";
    return;
  }
  if (f.phase !== "running") return;
  const cfg = PROFILES[profile];
  const length = Math.max(1, Math.hypot(input.x, input.y, input.z));
  const boost = input.boost && f.battery > 1 ? 1.5 : 1;
  const from = { ...f.position };
  const axes = ["x", "y", "z"] as const;
  for (const axis of axes)
    f.velocity[axis] =
      (f.velocity[axis] + (input[axis] / length) * cfg.acceleration * boost * STEP) *
      Math.exp(-cfg.drag * STEP);
  const speed = Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z);
  const scale = Math.min(1, (cfg.speed * boost) / Math.max(0.001, speed));
  for (const axis of axes) {
    f.velocity[axis] *= scale;
    f.position[axis] += f.velocity[axis] * STEP;
  }
  let contact = false;
  for (const [axis, low, high] of [
    ["x", -12, 12],
    ["y", 0.65, 12],
    ["z", -41, 24],
  ] as const) {
    if (f.position[axis] < low || f.position[axis] > high) {
      f.position[axis] = Math.max(low, Math.min(high, f.position[axis]));
      f.velocity[axis] = 0;
      contact = true;
    }
  }
  for (const obstacle of OBSTACLES) {
    const dx = f.position.x - obstacle.x,
      dz = f.position.z - obstacle.z;
    const radius = obstacle.radius + 0.36,
      distance = Math.hypot(dx, dz);
    if (distance < radius && f.position.y < obstacle.height + 0.3) {
      if (from.y >= obstacle.height + 0.3) {
        f.position.y = obstacle.height + 0.3;
        f.velocity.y = 0;
      } else {
        const nx = distance ? dx / distance : 1,
          nz = distance ? dz / distance : 0;
        f.position.x = obstacle.x + nx * radius;
        f.position.z = obstacle.z + nz * radius;
        const inward = Math.min(0, nx * f.velocity.x + nz * f.velocity.z);
        f.velocity.x -= nx * inward;
        f.velocity.z -= nz * inward;
      }
      contact = true;
    }
  }
  if (contact && !f.contact) f.collisions++;
  f.contact = contact;
  f.elapsed = Math.min(LIMIT, f.elapsed + STEP);
  f.battery = Math.max(0, f.battery - cfg.drain * boost * STEP);
  f.roll += (-f.velocity.x * 0.038 - f.roll) * 4 * STEP;
  f.pitch += (f.velocity.z * 0.027 - f.pitch) * 4 * STEP;
  if (GATES[f.gates] && crossedGate(from, f.position, GATES[f.gates])) f.gates++;
  if (f.gates === GATES.length) f.phase = "success";
  else if (f.elapsed >= LIMIT - 0.000001) {
    f.elapsed = LIMIT;
    f.phase = "timeout";
  }
}
export class Simulation {
  state = freshFlight();
  private remainder = 0;
  advance(seconds: number, input: Input, profile: Profile) {
    this.remainder += Math.max(0, seconds);
    while (this.remainder + 1e-10 >= STEP) {
      tick(this.state, input, profile);
      this.remainder -= STEP;
    }
  }
  reset() {
    this.state = freshFlight();
    this.remainder = 0;
  }
}
