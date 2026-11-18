import { describe, expect, it } from "vitest";
import {
  Simulation,
  STEP,
  NEUTRAL,
  PROFILES,
  GATES,
  GATE_RADIUS,
  OBSTACLES,
  crossedGate,
  score,
  type Input,
  type Profile,
} from "./simulation";
import { referenceFlight } from "@/features/telemetry/demo";
function running() {
  const s = new Simulation();
  s.state.phase = "running";
  return s;
}
const forward = { ...NEUTRAL, z: -1 };
describe("fixed-step flight", () => {
  it.each([30, 60, 90, 144])("matches the reference at %i Hz", (hz) => {
    const a = running(),
      b = running();
    for (let i = 0; i < hz; i++) a.advance(1 / hz, forward, "SPORT");
    b.advance(1, forward, "SPORT");
    expect(a.state).toEqual(b.state);
  });
  it("integrates fractional steps without gaining time", () => {
    const s = running();
    s.advance(STEP / 2, forward, "SPORT");
    expect(s.state.elapsed).toBe(0);
    s.advance(STEP / 2, forward, "SPORT");
    expect(s.state.elapsed).toBeCloseTo(STEP);
  });
  it("holds position for the three-second launch countdown", () => {
    const s = running();
    s.state.phase = "countdown";
    s.advance(2.9, forward, "ECO");
    expect(s.state.phase).toBe("countdown");
    expect(s.state.position.z).toBe(20);
    s.advance(0.1, forward, "ECO");
    expect(s.state.phase).toBe("running");
    expect(s.state.elapsed).toBe(0);
  });
  it("preserves inertia on release, then decelerates", () => {
    const s = running();
    s.advance(0.5, forward, "SPORT");
    const speed = -s.state.velocity.z,
      z = s.state.position.z;
    s.advance(0.5, NEUTRAL, "SPORT");
    expect(s.state.position.z).toBeLessThan(z);
    expect(-s.state.velocity.z).toBeLessThan(speed);
    expect(-s.state.velocity.z).toBeGreaterThan(0);
  });
  it("separates all engine profiles and bounds boost speed", () => {
    const speeds = Object.keys(PROFILES).map((p) => {
      const s = running();
      s.advance(1, { ...forward, boost: true }, p as Profile);
      const v = -s.state.velocity.z;
      expect(v).toBeLessThanOrEqual(PROFILES[p as Profile].speed * 1.5);
      return v;
    });
    expect(speeds[0]).toBeLessThan(speeds[1]);
    expect(speeds[1]).toBeLessThan(speeds[2]);
  });
  it("normalizes diagonal input and banks in response to velocity", () => {
    const a = running(),
      b = running();
    a.advance(0.5, { ...forward, x: 1 }, "RACE");
    b.advance(0.5, forward, "RACE");
    expect(Math.hypot(a.state.velocity.x, a.state.velocity.z)).toBeCloseTo(-b.state.velocity.z);
    expect(a.state.roll).toBeLessThan(0);
  });
  it("counts sustained boundary contact once, then permits a new penalty", () => {
    const s = running(),
      left: Input = { ...NEUTRAL, x: -1 };
    s.advance(4, left, "SPORT");
    expect(s.state.position.x).toBe(-12);
    expect(s.state.collisions).toBe(1);
    s.advance(1, { ...NEUTRAL, x: 1 }, "SPORT");
    s.advance(3, left, "SPORT");
    expect(s.state.collisions).toBe(2);
  });
  it("resolves contact with the side and top of a pylon", () => {
    const s = running(),
      o = OBSTACLES[0];
    s.state.position = { x: o.x, y: 3, z: o.z + o.radius + 0.38 };
    s.advance(0.4, forward, "SPORT");
    expect(s.state.collisions).toBe(1);
    expect(s.state.position.z).toBeGreaterThan(o.z + o.radius);
    s.state.position = { x: o.x, z: o.z, y: o.height + 0.4 };
    s.advance(0.5, { ...NEUTRAL, y: -1 }, "RACE");
    expect(s.state.position.y).toBeCloseTo(o.height + 0.3);
  });
  it("freezes paused and terminal flight state, and resets completely", () => {
    const s = running();
    s.advance(0.5, forward, "SPORT");
    s.state.phase = "paused";
    const before = structuredClone(s.state);
    s.advance(1, forward, "SPORT");
    expect(s.state).toEqual(before);
    s.reset();
    expect(s.state).toEqual(new Simulation().state);
  });
});
describe("ordered qualification circuit", () => {
  it("detects swept passage only through the aperture from the approach side", () => {
    const g = GATES[0],
      from = { ...g, z: g.z + 2 },
      to = { ...g, z: g.z - 2 };
    expect(crossedGate(from, to, g)).toBe(true);
    expect(crossedGate(to, from, g)).toBe(false);
    expect(crossedGate({ ...from, x: GATE_RADIUS + 1 }, { ...to, x: GATE_RADIUS + 1 }, g)).toBe(
      false,
    );
  });
  it("ignores a later gate until its predecessors have been crossed", () => {
    const s = running();
    s.state.position = { ...GATES[1], z: GATES[1].z + 0.1 };
    s.advance(0.5, forward, "ECO");
    expect(s.state.gates).toBe(0);
  });
  it.each(["ECO", "SPORT", "RACE"] as const)("can finish all five gates under %s power", (p) => {
    const { row, f } = referenceFlight(p);
    expect(f.phase).toBe("success");
    expect(row.gates).toBe(5);
    expect(row.durationMs).toBeLessThan(60000);
    expect(row.collisions).toBe(0);
    expect(row.score).toBeGreaterThan(5000);
  });
  it("times out exactly at 60 seconds and stops draining energy", () => {
    const s = running();
    s.advance(61, NEUTRAL, "SPORT");
    expect(s.state.phase).toBe("timeout");
    expect(s.state.elapsed).toBe(60);
    const energy = s.state.battery;
    s.advance(1, forward, "SPORT");
    expect(s.state.battery).toBe(energy);
  });
  it("awards the time bonus only on completion and clamps penalties", () => {
    expect(score(4, 1, 30000)).toBe(3850);
    expect(score(5, 1, 30000)).toBe(5150);
    expect(score(0, 2, 60000)).toBe(0);
  });
});
