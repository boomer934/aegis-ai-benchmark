import { describe, expect, it, vi } from "vitest";
import { FlightEngine } from "@/features/flight/engine";
import {
  advanceFlight,
  DEFAULT_CONFIG,
  freshFlight,
  GATES,
  LIMIT,
  NEUTRAL,
  scoreRun,
  speedOf,
  STEP,
  FLY_BOUNDS,
  OBSTACLES,
  snapshot,
  type FlightState,
  type Profile,
} from "@/features/flight/physics";
import { resultSchema } from "@/features/telemetry/validation";

const forward = { ...NEUTRAL, z: -1 };
function active() {
  const state = freshFlight();
  state.phase = "active";
  return state;
}
function through(state: FlightState, index: number, dx = 0, reverse = false) {
  const [x, y, z] = GATES[index].center;
  state.position = [x + dx, y, z + (reverse ? -0.03 : 0.03)];
  state.velocity = [0, 0, reverse ? 9 : -9];
  advanceFlight(state, NEUTRAL, "SPORT");
}

describe("Flight physics", () => {
  it("accelerates, banks and retains momentum before drag slows the drone", () => {
    const state = active();
    for (let i = 0; i < 90; i++) advanceFlight(state, { ...forward, x: 0.4 }, "SPORT");
    expect(state.position[0]).toBeGreaterThan(0.5);
    expect(state.position[2]).toBeLessThan(20);
    expect(state.roll).toBeLessThan(0);
    expect(state.pitch).toBeGreaterThan(0);
    const speed = speedOf(state);
    const z = state.position[2];
    for (let i = 0; i < 120; i++) advanceFlight(state, NEUTRAL, "SPORT");
    expect(state.position[2]).toBeLessThan(z);
    expect(speedOf(state)).toBeGreaterThan(0);
    expect(speedOf(state)).toBeLessThan(speed / 2);
  });

  it("applies engine-specific thrust, lift, boost and energy draw", () => {
    function burst(profile: Profile, boost = false) {
      const state = active();
      for (let i = 0; i < 125; i++) advanceFlight(state, { ...forward, y: 1, boost }, profile);
      return state;
    }
    const eco = burst("ECO");
    const sport = burst("SPORT");
    const race = burst("RACE");
    const boost = burst("RACE", true);
    expect(speedOf(sport)).toBeGreaterThan(speedOf(eco));
    expect(speedOf(race)).toBeGreaterThan(speedOf(sport));
    expect(race.position[1]).toBeGreaterThan(eco.position[1]);
    expect(speedOf(boost)).toBeGreaterThan(speedOf(race));
    expect(boost.energy).toBeLessThan(race.energy);
  });

  it("keeps fixed-step motion consistent across render rates", () => {
    function run(fps: number) {
      const engine = new FlightEngine(vi.fn());
      engine.start(DEFAULT_CONFIG);
      engine.setKey("KeyW", true);
      for (let i = 0; i < fps * 4; i++) engine.frame(1 / fps);
      return engine.state;
    }
    const a = run(60);
    const b = run(20);
    const c = run(144);
    expect(a.position[2]).toBeLessThan(20);
    expect(Math.abs(a.position[2] - b.position[2])).toBeLessThan(0.08);
    expect(Math.abs(a.position[2] - c.position[2])).toBeLessThan(0.08);
    expect(Math.abs(a.elapsed - c.elapsed)).toBeLessThanOrEqual(STEP * 1.01);
  });

  it("checks the gate plane in order and requires a forward pass inside the opening", () => {
    const state = active();
    through(state, 1);
    through(state, 0, 6);
    through(state, 0, 0, true);
    expect(state.checkpoints).toBe(0);
    through(state, 0);
    expect(state.checkpoints).toBe(1);
    through(state, 0);
    through(state, 2);
    expect(state.checkpoints).toBe(1);
    through(state, 1);
    expect(state.checkpoints).toBe(2);
  });

  it("bounces against bounds and swept obstacles, penalizing score and energy", () => {
    const state = active();
    state.position[0] = FLY_BOUNDS.x - 0.01;
    state.velocity[0] = 10;
    advanceFlight(state, NEUTRAL, "SPORT");
    expect(state.position[0]).toBe(FLY_BOUNDS.x);
    expect(state.velocity[0]).toBeLessThan(0);
    expect(state.collisions).toBe(1);
    expect(state.energy).toBeLessThan(98);
    expect(scoreRun(1, state.collisions, 12, false)).toBe(175);
    const box = OBSTACLES[0];
    const craft = active();
    craft.position = [box.center[0], box.center[1], box.center[2] + box.size[2] / 2 + 0.6];
    craft.velocity[2] = -10;
    advanceFlight(craft, NEUTRAL, "SPORT");
    expect(craft.collisions).toBe(1);
    expect(craft.position[2]).toBeGreaterThan(box.center[2] + box.size[2] / 2);
    expect(craft.velocity[2]).toBeGreaterThan(0);
    const post = active();
    const {
      center: [x, y, z],
      width,
    } = GATES[0];
    post.position = [x + width / 2 + 0.15, y, z + 0.85];
    post.velocity[2] = -10;
    advanceFlight(post, NEUTRAL, "SPORT");
    expect(post.collisions).toBe(1);
    expect(post.checkpoints).toBe(0);
  });

  it("completes on the fifth gate and awards the expected time bonus", () => {
    const state = active();
    state.elapsed = 21.09;
    for (let i = 0; i < GATES.length; i++) through(state, i);
    expect(state.phase).toBe("success");
    expect(state.checkpoints).toBe(5);
    expect(scoreRun(5, 1, 21.132, true)).toBe(1485);
    const stoppedAt = state.elapsed;
    advanceFlight(state, forward, "SPORT");
    expect(state.elapsed).toBe(stoppedAt);
  });

  it("pauses elapsed time, resumes, and emits exactly one valid timeout result", () => {
    const finish = vi.fn();
    const engine = new FlightEngine(finish);
    engine.start(DEFAULT_CONFIG);
    for (let i = 0; i < 81; i++) engine.frame(0.045);
    engine.togglePause();
    const before = snapshot(engine.state);
    engine.frame(0.2);
    expect(snapshot(engine.state)).toEqual(before);
    engine.togglePause();
    for (let i = 0; i < 600; i++) engine.frame(0.125);
    expect(engine.state.elapsed).toBe(LIMIT);
    expect(engine.state.phase).toBe("timeout");
    expect(finish).toHaveBeenCalledTimes(1);
    expect(resultSchema.safeParse(finish.mock.calls[0][0]).success).toBe(true);
    engine.reset();
    expect(engine.getSnapshot().phase).toBe("ready");
    expect(engine.getSnapshot().samples).toEqual([]);
  });
});
