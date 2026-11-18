import type { EngineProfile } from "./profiles";
import { approachFactor, clamp, copyVec, lengthXZ, vec3, type Vec3 } from "./vec";

/** Normalised pilot input. x: right(+)/left(−), y: up(+)/down(−), z: forward(+)/back(−). */
export interface FlightInput {
  x: number;
  y: number;
  z: number;
  boost: boolean;
}

export const NEUTRAL_INPUT: Readonly<FlightInput> = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  boost: false,
});

export interface DroneState {
  position: Vec3;
  /** Position before the latest step — used for checkpoint sweeps and render interpolation. */
  prevPosition: Vec3;
  velocity: Vec3;
  /** Visual attitude (rad), smoothed toward the commanded tilt. */
  roll: number;
  pitch: number;
  /** Battery / energy, 0–100 %. */
  energy: number;
  boosting: boolean;
  /** 0–1 commanded throttle magnitude, drives rotor speed and energy use. */
  throttle: number;
}

/** Fraction of normal speed available once energy is fully depleted. */
export const LIMP_SPEED_FACTOR = 0.4;
/** Attitude smoothing rate (1/s). */
const TILT_RESPONSE = 7;

export function createDroneState(position: Readonly<Vec3>): DroneState {
  return {
    position: { ...position },
    prevPosition: { ...position },
    velocity: vec3(),
    roll: 0,
    pitch: 0,
    energy: 100,
    boosting: false,
    throttle: 0,
  };
}

/**
 * Advance the drone by one fixed time step `dt` (seconds), ignoring collisions.
 * Thrust → acceleration, exponential drag (exact for any dt), separate braking
 * drag on released axes, profile speed caps, boost, energy drain and attitude.
 * Mutates `d` in place (no allocations: this runs 120×/s).
 */
export function stepDrone(
  d: DroneState,
  rawInput: Readonly<FlightInput>,
  p: EngineProfile,
  dt: number,
): void {
  copyVec(d.prevPosition, d.position);

  let ix = clamp(rawInput.x, -1, 1);
  let iz = clamp(rawInput.z, -1, 1);
  const iy = clamp(rawInput.y, -1, 1);
  // Diagonal stick must not be faster than straight stick.
  const planar = Math.hypot(ix, iz);
  if (planar > 1) {
    ix /= planar;
    iz /= planar;
  }

  const depleted = d.energy <= 0;
  const boosting = rawInput.boost && !depleted && (planar > 0.05 || Math.abs(iy) > 0.05);
  const boostMul = boosting ? p.boostMultiplier : 1;
  const limp = depleted ? LIMP_SPEED_FACTOR : 1;

  // World frame: forward stick is −Z.
  const ax = ix * p.accel * boostMul;
  const az = -iz * p.accel * boostMul;
  const ay = iy * p.climbAccel * boostMul;

  const v = d.velocity;
  v.x += ax * dt;
  v.z += az * dt;
  v.y += ay * dt;

  const horizontalDrag = planar > 0.05 ? p.drag : p.brakeDrag;
  const hDecay = Math.exp(-horizontalDrag * dt);
  v.x *= hDecay;
  v.z *= hDecay;
  v.y *= Math.exp(-(Math.abs(iy) > 0.05 ? p.drag : p.brakeDrag) * dt);

  const maxH = p.maxSpeed * boostMul * limp;
  const h = lengthXZ(v);
  if (h > maxH) {
    const k = maxH / h;
    v.x *= k;
    v.z *= k;
  }
  const maxV = p.climbSpeed * boostMul * limp;
  v.y = clamp(v.y, -maxV, maxV);

  d.position.x += v.x * dt;
  d.position.y += v.y * dt;
  d.position.z += v.z * dt;

  // Commanded attitude: bank into lateral thrust, pitch into forward thrust.
  const f = approachFactor(TILT_RESPONSE, dt);
  d.roll += (-ix * p.tiltMax - d.roll) * f;
  d.pitch += (-iz * p.tiltMax - d.pitch) * f;

  d.throttle = Math.min(1, Math.hypot(planar, iy));
  d.boosting = boosting;
  const drain = p.idleDrain + p.throttleDrain * d.throttle + (boosting ? p.boostDrain : 0);
  d.energy = Math.max(0, d.energy - drain * dt);
}
