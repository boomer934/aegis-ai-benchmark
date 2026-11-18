/**
 * Engine profiles. These numbers are the actual flight-model parameters consumed
 * by `stepDrone`; the hangar UI renders them, it does not own them.
 */
export const ENGINE_IDS = ["ECO", "SPORT", "RACE"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

export interface EngineProfile {
  id: EngineId;
  label: string;
  tagline: string;
  /** Horizontal speed cap without boost (m/s). */
  maxSpeed: number;
  /** Horizontal thrust acceleration at full stick (m/s²). */
  accel: number;
  /** Aerodynamic drag coefficient while thrusting (1/s, exponential). */
  drag: number;
  /** Stronger damping applied on an axis with no stick input (1/s). */
  brakeDrag: number;
  /** Vertical speed cap (m/s). */
  climbSpeed: number;
  /** Vertical acceleration at full stick (m/s²). */
  climbAccel: number;
  /** Multiplier on accel and speed caps while boost is held. */
  boostMultiplier: number;
  /** Maximum visual bank / pitch angle (rad). */
  tiltMax: number;
  /** Energy drain (% per second) while idle, per unit of throttle, and extra while boosting. */
  idleDrain: number;
  throttleDrain: number;
  boostDrain: number;
  /** Nominal rotor rpm at hover — drives propeller animation. */
  rotorRpm: number;
}

export const ENGINE_PROFILES: Readonly<Record<EngineId, EngineProfile>> = {
  ECO: {
    id: "ECO",
    label: "ECO",
    tagline: "Endurance cruise",
    maxSpeed: 12,
    accel: 15,
    drag: 0.9,
    brakeDrag: 2.6,
    climbSpeed: 5,
    climbAccel: 10,
    boostMultiplier: 1.25,
    tiltMax: 0.3,
    idleDrain: 0.2,
    throttleDrain: 0.55,
    boostDrain: 1.2,
    rotorRpm: 5200,
  },
  SPORT: {
    id: "SPORT",
    label: "SPORT",
    tagline: "Balanced response",
    maxSpeed: 17,
    accel: 22,
    drag: 1.0,
    brakeDrag: 3.0,
    climbSpeed: 7,
    climbAccel: 14,
    boostMultiplier: 1.4,
    tiltMax: 0.4,
    idleDrain: 0.3,
    throttleDrain: 0.9,
    boostDrain: 2.0,
    rotorRpm: 7400,
  },
  RACE: {
    id: "RACE",
    label: "RACE",
    tagline: "Maximum thrust",
    maxSpeed: 23,
    accel: 32,
    drag: 1.1,
    brakeDrag: 3.4,
    climbSpeed: 9,
    climbAccel: 18,
    boostMultiplier: 1.5,
    tiltMax: 0.52,
    idleDrain: 0.45,
    throttleDrain: 1.5,
    boostDrain: 3.2,
    rotorRpm: 9800,
  },
};

export const isEngineId = (v: unknown): v is EngineId =>
  typeof v === "string" && (ENGINE_IDS as readonly string[]).includes(v);

/** Absolute horizontal speed ceiling for a profile (boost included). */
export const absoluteMaxSpeed = (p: EngineProfile): number => p.maxSpeed * p.boostMultiplier;
