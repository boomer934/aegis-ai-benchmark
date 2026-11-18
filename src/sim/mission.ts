import { ARENA, DRONE_RADIUS, DRONE_REST_HEIGHT, type ArenaDefinition } from "./arena";
import { evaluateGateCrossing } from "./checkpoints";
import { findContacts } from "./collision";
import {
  createDroneState,
  NEUTRAL_INPUT,
  stepDrone,
  type DroneState,
  type FlightInput,
} from "./physics";
import { ENGINE_PROFILES, type EngineId, type EngineProfile } from "./profiles";
import { CHECKPOINT_COUNT, computeScore, COUNTDOWN_S, MISSION_TIME_LIMIT_S } from "./scoring";
import { SIM_DT } from "./stepper";
import { copyVec, lengthXZ, length3 } from "./vec";

export type MissionStatus = "ready" | "countdown" | "running" | "paused" | "success" | "failed";

/** Telemetry sample: [t (s), speed (m/s), altitude (m), energy (%)]. */
export type TelemetrySample = [number, number, number, number];

export type SimEvent =
  | { type: "countdown"; value: number }
  | { type: "go" }
  | { type: "checkpoint"; gate: number; timeMs: number }
  | { type: "wrong-gate"; gate: number }
  | { type: "collision"; surface: string; impact: number }
  | { type: "paused" }
  | { type: "resumed" }
  | { type: "success" }
  | { type: "failed"; reason: "timeout" }
  | { type: "reset" };

export interface MissionResult {
  outcome: "success" | "failed";
  engine: EngineId;
  durationMs: number;
  score: number;
  checkpoints: number;
  collisions: number;
  maxSpeed: number;
  avgSpeed: number;
  energyUsed: number;
  splitsMs: number[];
  telemetry: TelemetrySample[];
}

export interface MissionState {
  status: MissionStatus;
  pausedFrom: "countdown" | "running" | null;
  /** Remaining countdown seconds while status is countdown. */
  countdown: number;
  /** Fixed-step ticks spent running; elapsed = ticks × dt (exact, no float drift). */
  ticks: number;
  nextGate: number;
  splitsMs: number[];
  collisions: number;
  lastCollisionTick: number;
  maxSpeed: number;
  distance: number;
  energyAtStart: number;
  telemetry: TelemetrySample[];
  result: MissionResult | null;
}

export interface World {
  arena: ArenaDefinition;
  profile: EngineProfile;
  drone: DroneState;
  mission: MissionState;
  dt: number;
  /** Events emitted since the consumer last drained them. */
  events: SimEvent[];
}

/** Telemetry sampled every 12 ticks = 10 Hz at 120 Hz simulation. */
const TELEMETRY_EVERY_TICKS = 12;
const COLLISION_MIN_IMPACT = 0.8;
const FLOOR_MIN_IMPACT = 3;
const COLLISION_COOLDOWN_S = 0.5;
const RESTITUTION = 0.35;
const TANGENT_FRICTION = 0.85;
/** Maximum points kept in a persisted telemetry trace. */
export const MAX_TRACE_POINTS = 300;

function createMissionState(): MissionState {
  return {
    status: "ready",
    pausedFrom: null,
    countdown: 0,
    ticks: 0,
    nextGate: 0,
    splitsMs: [],
    collisions: 0,
    lastCollisionTick: Number.NEGATIVE_INFINITY,
    maxSpeed: 0,
    distance: 0,
    energyAtStart: 100,
    telemetry: [],
    result: null,
  };
}

export function createWorld(
  engine: EngineId = "SPORT",
  arena: ArenaDefinition = ARENA,
  dt = SIM_DT,
): World {
  return {
    arena,
    profile: ENGINE_PROFILES[engine],
    drone: createDroneState(arena.start),
    mission: createMissionState(),
    dt,
    events: [],
  };
}

export const elapsedSeconds = (w: World): number => w.mission.ticks * w.dt;
export const elapsedMs = (w: World): number => Math.round(w.mission.ticks * w.dt * 1000);

export function liveScore(w: World): number {
  const m = w.mission;
  if (m.result) return m.result.score;
  return computeScore({
    checkpoints: m.nextGate,
    collisions: m.collisions,
    durationMs: elapsedMs(w),
    success: false,
  });
}

export function setEngine(w: World, engine: EngineId): void {
  w.profile = ENGINE_PROFILES[engine];
}

/** R: put the drone back on the pad and return to the ready state. */
export function resetFlight(w: World): void {
  w.drone = createDroneState(w.arena.start);
  w.mission = createMissionState();
  w.events.push({ type: "reset" });
}

/** Begin a mission: reset the drone onto the pad and start the countdown. */
export function startMission(w: World): boolean {
  const s = w.mission.status;
  if (s === "countdown" || s === "running" || s === "paused") return false;
  w.drone = createDroneState(w.arena.start);
  w.mission = createMissionState();
  w.mission.status = "countdown";
  w.mission.countdown = COUNTDOWN_S;
  w.events.push({ type: "countdown", value: COUNTDOWN_S });
  return true;
}

/** Space: pause/resume. Only meaningful while a mission is active. */
export function togglePause(w: World): boolean {
  const m = w.mission;
  if (m.status === "running" || m.status === "countdown") {
    m.pausedFrom = m.status;
    m.status = "paused";
    w.events.push({ type: "paused" });
    return true;
  }
  if (m.status === "paused" && m.pausedFrom) {
    m.status = m.pausedFrom;
    m.pausedFrom = null;
    w.events.push({ type: "resumed" });
    return true;
  }
  return false;
}

export const isMissionActive = (w: World): boolean =>
  w.mission.status === "countdown" ||
  w.mission.status === "running" ||
  w.mission.status === "paused";

function resolveCollisions(w: World): void {
  const d = w.drone;
  const m = w.mission;
  const contacts = findContacts(d.position, DRONE_RADIUS, w.arena, DRONE_REST_HEIGHT);
  for (const c of contacts) {
    d.position.x += c.nx * c.depth;
    d.position.y += c.ny * c.depth;
    d.position.z += c.nz * c.depth;
    const v = d.velocity;
    const vn = v.x * c.nx + v.y * c.ny + v.z * c.nz;
    if (vn >= 0) continue;
    const impact = -vn;
    // Remove the inward normal component, bounce a fraction back, scrub tangential speed.
    v.x -= (1 + RESTITUTION) * vn * c.nx;
    v.y -= (1 + RESTITUTION) * vn * c.ny;
    v.z -= (1 + RESTITUTION) * vn * c.nz;
    if (c.surface === "floor") {
      v.x *= TANGENT_FRICTION;
      v.z *= TANGENT_FRICTION;
      v.y = Math.min(v.y, impact * RESTITUTION);
    } else {
      v.x *= TANGENT_FRICTION;
      v.z *= TANGENT_FRICTION;
    }
    const threshold = c.surface === "floor" ? FLOOR_MIN_IMPACT : COLLISION_MIN_IMPACT;
    const cooldownTicks = COLLISION_COOLDOWN_S / w.dt;
    if (
      m.status === "running" &&
      impact >= threshold &&
      m.ticks - m.lastCollisionTick >= cooldownTicks
    ) {
      m.collisions++;
      m.lastCollisionTick = m.ticks;
      // Visible jolt on the airframe.
      d.roll += c.nx * 0.35;
      d.pitch -= c.nz * 0.35;
      w.events.push({ type: "collision", surface: c.obstacleId ?? c.surface, impact });
    }
  }
}

function downsample(samples: TelemetrySample[], max: number): TelemetrySample[] {
  if (samples.length <= max) return samples.map((s) => [...s] as TelemetrySample);
  const out: TelemetrySample[] = [];
  const stride = samples.length / max;
  for (let i = 0; i < max; i++) out.push([...samples[Math.floor(i * stride)]] as TelemetrySample);
  return out;
}

const round = (v: number, digits: number): number => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

function sampleTelemetry(w: World): void {
  const d = w.drone;
  w.mission.telemetry.push([
    round(elapsedSeconds(w), 2),
    round(length3(d.velocity), 2),
    round(d.position.y, 2),
    round(d.energy, 2),
  ]);
}

function finishMission(w: World, outcome: "success" | "failed"): void {
  const m = w.mission;
  const durationMs = elapsedMs(w);
  m.status = outcome;
  sampleTelemetry(w);
  const seconds = Math.max(durationMs / 1000, 1e-6);
  m.result = {
    outcome,
    engine: w.profile.id,
    durationMs,
    score: computeScore({
      checkpoints: m.nextGate,
      collisions: m.collisions,
      durationMs,
      success: outcome === "success",
    }),
    checkpoints: m.nextGate,
    collisions: m.collisions,
    maxSpeed: round(m.maxSpeed, 2),
    avgSpeed: round(Math.min(m.distance / seconds, m.maxSpeed), 2),
    energyUsed: round(Math.max(0, m.energyAtStart - w.drone.energy), 2),
    splitsMs: [...m.splitsMs],
    telemetry: downsample(m.telemetry, MAX_TRACE_POINTS),
  };
  w.events.push(
    outcome === "success" ? { type: "success" } : { type: "failed", reason: "timeout" },
  );
}

/**
 * Advance the whole world by one fixed step. Pure function of (world, input):
 * identical input sequences always produce identical worlds.
 */
export function stepWorld(w: World, input: Readonly<FlightInput>): void {
  const m = w.mission;
  const dt = w.dt;
  if (m.status === "paused") return;

  if (m.status === "countdown") {
    const before = Math.ceil(m.countdown);
    m.countdown -= dt;
    const after = Math.ceil(m.countdown);
    if (m.countdown <= 1e-9) {
      m.countdown = 0;
      m.status = "running";
      m.energyAtStart = w.drone.energy;
      w.events.push({ type: "go" });
    } else if (after !== before) {
      w.events.push({ type: "countdown", value: after });
    }
  }

  const controllable = m.status === "ready" || m.status === "running";
  stepDrone(w.drone, controllable ? input : NEUTRAL_INPUT, w.profile, dt);
  resolveCollisions(w);

  if (m.status !== "running") return;

  m.ticks++;
  const d = w.drone;
  const speed = length3(d.velocity);
  if (speed > m.maxSpeed) m.maxSpeed = speed;
  m.distance += Math.hypot(
    d.position.x - d.prevPosition.x,
    d.position.y - d.prevPosition.y,
    d.position.z - d.prevPosition.z,
  );

  const crossing = evaluateGateCrossing(w.arena.gates, m.nextGate, d.prevPosition, d.position);
  if (crossing.kind === "checkpoint") {
    m.nextGate++;
    const t = elapsedMs(w);
    m.splitsMs.push(t);
    w.events.push({ type: "checkpoint", gate: crossing.gateIndex + 1, timeMs: t });
  } else if (crossing.kind === "wrong-gate") {
    w.events.push({ type: "wrong-gate", gate: crossing.gateIndex + 1 });
  }

  if (m.ticks % TELEMETRY_EVERY_TICKS === 0) sampleTelemetry(w);

  if (m.nextGate >= CHECKPOINT_COUNT) {
    finishMission(w, "success");
  } else if (m.ticks * dt >= MISSION_TIME_LIMIT_S - 1e-9) {
    finishMission(w, "failed");
  }
}

/** Horizontal ground speed, for HUD display. */
export const groundSpeed = (w: World): number => lengthXZ(w.drone.velocity);

/** Copy the drone's current position into a staged pose (benchmark screenshots). */
export function stageDrone(
  w: World,
  pose: { x: number; y: number; z: number; vx: number; vy: number; vz: number; energy: number },
): void {
  w.drone.position.x = pose.x;
  w.drone.position.y = pose.y;
  w.drone.position.z = pose.z;
  copyVec(w.drone.prevPosition, w.drone.position);
  w.drone.velocity.x = pose.vx;
  w.drone.velocity.y = pose.vy;
  w.drone.velocity.z = pose.vz;
  w.drone.energy = pose.energy;
}
