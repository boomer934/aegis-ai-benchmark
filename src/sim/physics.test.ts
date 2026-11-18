import { describe, expect, it } from "vitest";
import { START_POSITION } from "./arena";
import { createDroneState, NEUTRAL_INPUT, stepDrone, type FlightInput } from "./physics";
import { ENGINE_PROFILES, absoluteMaxSpeed } from "./profiles";
import { FixedStepper, SIM_DT } from "./stepper";
import { lengthXZ } from "./vec";

const FORWARD: FlightInput = { x: 0, y: 0, z: 1, boost: false };
const airborne = () => createDroneState({ x: 0, y: 10, z: 0 });

function runFor(
  seconds: number,
  input: FlightInput,
  engine: keyof typeof ENGINE_PROFILES = "SPORT",
) {
  const d = airborne();
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) stepDrone(d, input, ENGINE_PROFILES[engine], SIM_DT);
  return d;
}

describe("stepDrone — flight model", () => {
  it("accelerates forward (−Z) under forward stick and stays put with no input", () => {
    const idle = runFor(1, NEUTRAL_INPUT);
    expect(idle.position).toEqual({ x: 0, y: 10, z: 0 });
    const d = runFor(1, FORWARD);
    expect(d.velocity.z).toBeLessThan(-5);
    expect(d.position.z).toBeLessThan(-3);
    expect(d.velocity.x).toBe(0);
  });

  it("accelerates gradually (inertia) rather than reaching top speed instantly", () => {
    const p = ENGINE_PROFILES.SPORT;
    const d = airborne();
    stepDrone(d, FORWARD, p, SIM_DT);
    expect(Math.abs(d.velocity.z)).toBeLessThan(p.accel * SIM_DT + 1e-9);
    const later = runFor(0.5, FORWARD);
    expect(Math.abs(later.velocity.z)).toBeGreaterThan(Math.abs(d.velocity.z) * 20);
  });

  it("decelerates by drag after releasing the stick and coasts with inertia", () => {
    const p = ENGINE_PROFILES.SPORT;
    const d = runFor(2, FORWARD);
    const v0 = Math.abs(d.velocity.z);
    const z0 = d.position.z;
    stepDrone(d, NEUTRAL_INPUT, p, SIM_DT);
    expect(Math.abs(d.velocity.z)).toBeLessThan(v0);
    expect(d.position.z).toBeLessThan(z0); // still moving: inertia
    for (let i = 0; i < 240; i++) stepDrone(d, NEUTRAL_INPUT, p, SIM_DT);
    expect(Math.abs(d.velocity.z)).toBeLessThan(v0 * Math.exp(-p.brakeDrag * 2) + 1e-6);
  });

  it("caps horizontal speed at the profile limit, including diagonals", () => {
    for (const id of ["ECO", "SPORT", "RACE"] as const) {
      const d = runFor(6, { x: 1, y: 0, z: 1, boost: false }, id);
      expect(lengthXZ(d.velocity)).toBeLessThanOrEqual(ENGINE_PROFILES[id].maxSpeed + 1e-9);
      expect(lengthXZ(d.velocity)).toBeGreaterThan(ENGINE_PROFILES[id].maxSpeed * 0.99);
    }
  });

  it("boost raises the speed cap and drains extra energy", () => {
    const normal = runFor(6, FORWARD);
    const boosted = runFor(6, { ...FORWARD, boost: true });
    const p = ENGINE_PROFILES.SPORT;
    expect(lengthXZ(boosted.velocity)).toBeGreaterThan(p.maxSpeed * 1.2);
    expect(lengthXZ(boosted.velocity)).toBeLessThanOrEqual(absoluteMaxSpeed(p) + 1e-9);
    expect(boosted.energy).toBeLessThan(normal.energy);
    expect(boosted.boosting).toBe(true);
  });

  it("climbs and descends with Q/E within the vertical cap", () => {
    const up = runFor(3, { x: 0, y: 1, z: 0, boost: false });
    expect(up.position.y).toBeGreaterThan(20);
    expect(up.velocity.y).toBeLessThanOrEqual(ENGINE_PROFILES.SPORT.climbSpeed + 1e-9);
    const down = runFor(1, { x: 0, y: -1, z: 0, boost: false });
    expect(down.position.y).toBeLessThan(10);
  });

  it("banks into lateral movement and pitches into forward movement, smoothly", () => {
    const p = ENGINE_PROFILES.SPORT;
    const d = airborne();
    stepDrone(d, { x: 1, y: 0, z: 1, boost: false }, p, SIM_DT);
    expect(d.roll).toBeLessThan(0);
    expect(Math.abs(d.roll)).toBeLessThan(p.tiltMax * 0.2);
    const settled = runFor(2, { x: 1, y: 0, z: 1, boost: false });
    expect(settled.roll).toBeCloseTo(-p.tiltMax / Math.SQRT2, 2);
    expect(settled.pitch).toBeCloseTo(-p.tiltMax / Math.SQRT2, 2);
  });

  it("enters limp mode when energy is depleted", () => {
    const p = ENGINE_PROFILES.RACE;
    const d = airborne();
    d.energy = 0.001;
    for (let i = 0; i < 600; i++) stepDrone(d, { ...FORWARD, boost: true }, p, SIM_DT);
    expect(d.energy).toBe(0);
    expect(d.boosting).toBe(false);
    expect(lengthXZ(d.velocity)).toBeLessThanOrEqual(p.maxSpeed * 0.4 + 1e-9);
  });
});

describe("engine profiles", () => {
  it("produce measurably different flight behaviour", () => {
    const eco = runFor(1.5, FORWARD, "ECO");
    const sport = runFor(1.5, FORWARD, "SPORT");
    const race = runFor(1.5, FORWARD, "RACE");
    expect(Math.abs(race.position.z)).toBeGreaterThan(Math.abs(sport.position.z));
    expect(Math.abs(sport.position.z)).toBeGreaterThan(Math.abs(eco.position.z));
    expect(race.energy).toBeLessThan(sport.energy);
    expect(sport.energy).toBeLessThan(eco.energy);
  });

  it("order top speed and agility ECO < SPORT < RACE", () => {
    const { ECO, SPORT, RACE } = ENGINE_PROFILES;
    expect(ECO.maxSpeed).toBeLessThan(SPORT.maxSpeed);
    expect(SPORT.maxSpeed).toBeLessThan(RACE.maxSpeed);
    expect(ECO.accel).toBeLessThan(RACE.accel);
    expect(ECO.throttleDrain).toBeLessThan(RACE.throttleDrain);
  });
});

describe("FixedStepper — frame-rate independence", () => {
  function simulate(frameDt: number, seconds: number) {
    const d = createDroneState({ ...START_POSITION, y: 10 });
    const stepper = new FixedStepper();
    const frames = Math.round(seconds / frameDt);
    let steps = 0;
    for (let f = 0; f < frames; f++) {
      steps += stepper.advance(frameDt, (dt) =>
        stepDrone(d, FORWARD, ENGINE_PROFILES.SPORT, dt),
      ).steps;
    }
    return { d, steps };
  }

  it("produces identical trajectories at 30, 60 and 120 fps", () => {
    const a = simulate(1 / 30, 2);
    const b = simulate(1 / 60, 2);
    const c = simulate(1 / 120, 2);
    expect(a.steps).toBe(240);
    expect(b.steps).toBe(240);
    expect(c.steps).toBe(240);
    expect(a.d.position.z).toBeCloseTo(c.d.position.z, 9);
    expect(b.d.velocity.z).toBeCloseTo(c.d.velocity.z, 9);
  });

  it("handles uneven frame times and reports interpolation alpha in [0,1)", () => {
    const stepper = new FixedStepper();
    let total = 0;
    for (const dt of [0.016, 0.007, 0.033, 0.0125, 0.02]) {
      const { steps, alpha } = stepper.advance(dt, () => {});
      total += steps;
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThan(1);
    }
    expect(total).toBe(Math.floor(0.0885 * 120));
  });

  it("clamps very long frames to avoid a spiral of death", () => {
    const stepper = new FixedStepper();
    expect(stepper.advance(5, () => {}).steps).toBe(12);
    expect(stepper.advance(Number.NaN, () => {}).steps).toBe(0);
  });
});
