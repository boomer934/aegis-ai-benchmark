export const PROFILES = {
  ECO: { acceleration: 7.8, speed: 8, lift: 4, draw: 0.55 },
  SPORT: { acceleration: 11.8, speed: 12, lift: 5.5, draw: 0.82 },
  RACE: { acceleration: 16, speed: 17, lift: 7.5, draw: 1.16 },
} as const;

export const PAINTS = {
  Arctic: { color: "#bdc9ce", accent: "#f18d48", description: "Brushed titanium" },
  Ember: { color: "#ae3e22", accent: "#ffc08c", description: "Ceramic vermilion" },
  Carbon: { color: "#303a43", accent: "#a1d7c7", description: "Graphite composite" },
} as const;

export type Profile = keyof typeof PROFILES;
export type Paint = keyof typeof PAINTS;
export type Configuration = { profile: Profile; paint: Paint; lights: boolean };
export const DEFAULT_CONFIG: Configuration = { profile: "SPORT", paint: "Arctic", lights: true };

export type Vec = [number, number, number];
export type FlightInput = { x: number; y: number; z: number; boost: boolean };
export const NEUTRAL: FlightInput = { x: 0, y: 0, z: 0, boost: false };
export type Phase = "ready" | "countdown" | "active" | "paused" | "success" | "timeout";
export type Sample = { time: number; speed: number; altitude: number; energy: number };
export const LIMIT = 60;
export const STEP = 1 / 120;
export const START: Vec = [0, 2, 22];
export const FLY_BOUNDS = { x: 29, low: 0.65, high: 17, front: 28, back: -87 };
export const GATES = [
  { center: [0, 2.4, 4], width: 8, height: 3.6 },
  { center: [-9, 5.1, -12], width: 8, height: 4.4 },
  { center: [-1, 7.8, -29], width: 9, height: 4.4 },
  { center: [12, 5.1, -46], width: 9, height: 4.6 },
  { center: [2, 3.35, -64], width: 9, height: 5.4 },
] satisfies { center: Vec; width: number; height: number }[];

export type Obstacle = { center: Vec; size: Vec };
export const OBSTACLES: Obstacle[] = [
  { center: [11, 2.8, -7], size: [5.5, 5.6, 6.4] },
  { center: [-16, 2.4, -23], size: [6.4, 4.8, 6.4] },
  { center: [9, 3.1, -28], size: [5.2, 6.2, 5.2] },
  { center: [-8, 3.6, -44], size: [6.4, 7.2, 7.1] },
  { center: [16, 2.1, -61], size: [5.8, 4.2, 6.4] },
];

export const GATE_FRAMES = GATES.map(({ width, height }): Obstacle[] => [
  { center: [-width / 2 - 0.15, 0, 0], size: [0.32, height + 0.45, 0.45] },
  { center: [width / 2 + 0.15, 0, 0], size: [0.32, height + 0.45, 0.45] },
  { center: [0, height / 2 + 0.23, 0], size: [width + 0.62, 0.47, 0.48] },
  { center: [0, -height / 2 + 0.025, 0.05], size: [width + 0.29, 0.07, 0.24] },
]);

const colliders = [
  ...OBSTACLES,
  ...GATES.flatMap(({ center: origin }, index) =>
    GATE_FRAMES[index].map(({ center, size }): Obstacle => ({
      center: [center[0] + origin[0], center[1] + origin[1], center[2] + origin[2]],
      size,
    })),
  ),
];

export type FlightState = {
  phase: Phase;
  countdown: number;
  elapsed: number;
  position: Vec;
  velocity: Vec;
  pitch: number;
  roll: number;
  energy: number;
  checkpoints: number;
  collisions: number;
  lastImpact: number;
};

export function freshFlight(): FlightState {
  return {
    phase: "ready",
    countdown: 3,
    elapsed: 0,
    position: [...START],
    velocity: [0, 0, 0],
    pitch: 0,
    roll: 0,
    energy: 100,
    checkpoints: 0,
    collisions: 0,
    lastImpact: -1,
  };
}

export function speedOf(state: FlightState) {
  return Math.hypot(...state.velocity);
}

export function scoreRun(checkpoints: number, collisions: number, time: number, success: boolean) {
  const timeBonus = success ? Math.floor((LIMIT - time) * 8) : 0;
  return Math.max(0, checkpoints * 250 + timeBonus - collisions * 75);
}

export function snapshot(state: FlightState): Sample {
  return {
    time: Math.round(state.elapsed * 1000) / 1000,
    speed: speedOf(state),
    altitude: state.position[1],
    energy: state.energy,
  };
}

function crossesGate(from: Vec, to: Vec, gate: (typeof GATES)[number]) {
  const [x, y, z] = gate.center;
  if (!(from[2] > z && to[2] <= z)) return false;
  const t = (z - from[2]) / (to[2] - from[2]);
  return (
    Math.abs(from[0] + (to[0] - from[0]) * t - x) <= gate.width / 2 - 0.55 &&
    Math.abs(from[1] + (to[1] - from[1]) * t - y) <= gate.height / 2 - 0.3
  );
}

function obstacleFraction(from: Vec, to: Vec, obstacles: readonly Obstacle[]) {
  let earliest = 1;
  for (const obstacle of obstacles) {
    let enter = 0;
    let leave = 1;
    for (const axis of [0, 1, 2] as const) {
      const half = obstacle.size[axis] / 2 + (axis === 1 ? 0.24 : 0.57);
      const lower = obstacle.center[axis] - half;
      const upper = obstacle.center[axis] + half;
      const delta = to[axis] - from[axis];
      if (Math.abs(delta) < 1e-9) {
        if (from[axis] < lower || from[axis] > upper) enter = Infinity;
        continue;
      }
      const first = (lower - from[axis]) / delta;
      const last = (upper - from[axis]) / delta;
      enter = Math.max(enter, Math.min(first, last));
      leave = Math.min(leave, Math.max(first, last));
    }
    if (enter <= leave) earliest = Math.min(earliest, enter);
  }
  return earliest;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max));

/** Mutates a simulation-owned state. The caller advances it in fixed steps. */
export function advanceFlight(
  state: FlightState,
  input: FlightInput,
  profile: Profile,
  dt = STEP,
  obstacles: readonly Obstacle[] = colliders,
) {
  if (state.phase === "countdown") {
    state.countdown = Math.max(0, state.countdown - dt);
    if (state.countdown < 1e-8) state.phase = "active";
    return;
  }
  if (state.phase !== "active") return;
  const engine = PROFILES[profile];
  const boost = input.boost && state.energy > 0 && Math.hypot(input.x, input.y, input.z) > 0;
  const power = boost ? 1.43 : state.energy > 0 ? 1 : 0.55;
  const horizontal = Math.max(1, Math.hypot(input.x, input.z));
  const v = state.velocity;
  const drag = Math.exp(-1.35 * dt);
  v[0] = v[0] * drag + (input.x / horizontal) * engine.acceleration * power * dt;
  v[1] = clamp(v[1] * drag + input.y * engine.lift * power * dt, -6, 6);
  v[2] = v[2] * drag + (input.z / horizontal) * engine.acceleration * power * dt;
  const top = engine.speed * power;
  const planar = Math.hypot(v[0], v[2]);
  if (planar > top) {
    v[0] *= top / planar;
    v[2] *= top / planar;
  }
  const from = state.position;
  const proposed: Vec = [from[0] + v[0] * dt, from[1] + v[1] * dt, from[2] + v[2] * dt];
  const b = FLY_BOUNDS;
  const bounded: Vec = [
    clamp(proposed[0], -b.x, b.x),
    clamp(proposed[1], b.low, b.high),
    clamp(proposed[2], b.back, b.front),
  ];
  const hit = obstacleFraction(from, bounded, obstacles);
  let collision = hit < 1;
  if (collision) {
    const safe = Math.max(0, hit - 0.002);
    state.position = [
      from[0] + (bounded[0] - from[0]) * safe,
      from[1] + (bounded[1] - from[1]) * safe,
      from[2] + (bounded[2] - from[2]) * safe,
    ];
    v[0] *= -0.4;
    v[1] *= -0.4;
    v[2] *= -0.4;
  } else {
    state.position = bounded;
    for (const axis of [0, 1, 2] as const) {
      if (proposed[axis] !== bounded[axis]) {
        collision ||= Math.abs(v[axis]) > 0.65;
        v[axis] *= Math.abs(v[axis]) > 0.65 ? -0.28 : 0;
      }
    }
  }
  collision &&= state.elapsed - state.lastImpact >= 0.25;
  if (collision) state.lastImpact = state.elapsed;
  state.collisions += Number(collision);
  state.energy = Math.max(
    0,
    state.energy - dt * engine.draw * (boost ? 3.5 : 1) - Number(collision) * 2,
  );
  const tilt = 1 - Math.exp(-7 * dt);
  state.pitch += (v[2] * -0.041 - state.pitch) * tilt;
  state.roll += (v[0] * -0.046 - state.roll) * tilt;
  state.elapsed = Math.min(LIMIT, state.elapsed + dt);

  const gate = GATES[state.checkpoints];
  if (gate && crossesGate(from, state.position, gate)) state.checkpoints++;
  if (state.checkpoints === GATES.length) state.phase = "success";
  else if (state.elapsed >= LIMIT - 1e-8) {
    state.elapsed = LIMIT;
    state.phase = "timeout";
  }
}

function stagedFlight() {
  const state = freshFlight();
  state.phase = "active";
  for (let tick = 0; tick < 184; tick++) {
    advanceFlight(
      state,
      { x: tick < 12 ? -1 : 0, y: tick < 42 ? 1 : 0, z: -1, boost: false },
      DEFAULT_CONFIG.profile,
    );
  }
  return state;
}

export const PREVIEW = stagedFlight();
