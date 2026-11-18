import { describe, expect, it } from "vitest";
import { ARENA, DRONE_RADIUS, DRONE_REST_HEIGHT } from "./arena";
import { createCourseAutopilot } from "./autopilot";
import { evaluateGateCrossing, segmentCrossesGate } from "./checkpoints";
import { findContacts } from "./collision";
import {
  createWorld,
  liveScore,
  resetFlight,
  stageDrone,
  startMission,
  stepWorld,
  togglePause,
  type World,
} from "./mission";
import { NEUTRAL_INPUT, type FlightInput } from "./physics";
import {
  computeScore,
  COLLISION_PENALTY,
  MISSION_TIME_LIMIT_MS,
  POINTS_PER_CHECKPOINT,
  timeBonus,
} from "./scoring";

function stepN(w: World, n: number, input: FlightInput = NEUTRAL_INPUT) {
  for (let i = 0; i < n; i++) stepWorld(w, input);
}

function startAndRun(w: World) {
  startMission(w);
  stepN(w, 3 * 120 + 1);
  expect(w.mission.status).toBe("running");
}

const gate1 = ARENA.gates[0];
const before = (g = gate1, offset = 1) => ({
  x: g.center.x - g.normal.x * offset,
  y: g.center.y,
  z: g.center.z - g.normal.z * offset,
});
const after = (g = gate1, offset = 1) => ({
  x: g.center.x + g.normal.x * offset,
  y: g.center.y,
  z: g.center.z + g.normal.z * offset,
});

describe("checkpoint detection", () => {
  it("counts a crossing through the opening in the travel direction", () => {
    expect(segmentCrossesGate(gate1, before(), after())).toBe(true);
  });

  it("rejects crossings in the reverse direction", () => {
    expect(segmentCrossesGate(gate1, after(), before())).toBe(false);
  });

  it("rejects crossings outside the opening", () => {
    const a = { ...before(), y: gate1.center.y + gate1.halfHeight + 0.5 };
    const b = { ...after(), y: gate1.center.y + gate1.halfHeight + 0.5 };
    expect(segmentCrossesGate(gate1, a, b)).toBe(false);
    const side = gate1.halfWidth + 0.5;
    expect(segmentCrossesGate(gate1, { ...before(), x: side }, { ...after(), x: side })).toBe(
      false,
    );
  });

  it("only scores the next gate in order; other gates are wrong-gate", () => {
    const g3 = ARENA.gates[2];
    expect(evaluateGateCrossing(ARENA.gates, 0, before(g3), after(g3))).toEqual({
      kind: "wrong-gate",
      gateIndex: 2,
    });
    expect(evaluateGateCrossing(ARENA.gates, 2, before(g3), after(g3))).toEqual({
      kind: "checkpoint",
      gateIndex: 2,
    });
  });

  it("detects checkpoints from simulated movement, in order only", () => {
    const w = createWorld("SPORT");
    startAndRun(w);
    // Teleporting through gate 3 first must not score.
    const g3 = ARENA.gates[2];
    stageDrone(w, { ...before(g3, 2), vx: 0, vy: 0, vz: 0, energy: 90 });
    stepN(w, 60, { x: 0, y: 0, z: 0, boost: false });
    w.drone.velocity.x = g3.normal.x * 10;
    w.drone.velocity.z = g3.normal.z * 10;
    stepN(w, 40);
    expect(w.mission.nextGate).toBe(0);
    expect(w.events.some((e) => e.type === "wrong-gate")).toBe(true);
    // Now fly through gate 1 properly.
    stageDrone(w, { ...before(gate1, 2), vx: 0, vy: 0, vz: -10, energy: 90 });
    stepN(w, 60, { x: 0, y: 0, z: 1, boost: false });
    expect(w.mission.nextGate).toBe(1);
    expect(w.mission.splitsMs).toHaveLength(1);
  });
});

describe("collisions", () => {
  it("finds no contacts at the start position", () => {
    expect(findContacts(ARENA.start, DRONE_RADIUS, ARENA, DRONE_REST_HEIGHT)).toHaveLength(0);
  });

  it("stops the drone at a pillar, counts one collision and applies the penalty", () => {
    const w = createWorld("SPORT");
    startAndRun(w);
    const pillar = ARENA.obstacles.find((o) => o.id === "pillar-a");
    if (!pillar || pillar.kind !== "cylinder") throw new Error("pillar-a missing");
    stageDrone(w, { x: pillar.x, y: 5, z: pillar.z + 6, vx: 0, vy: 0, vz: -12, energy: 90 });
    stepN(w, 120, { x: 0, y: 0, z: 1, boost: false });
    // Never penetrates the pillar.
    expect(
      Math.hypot(w.drone.position.x - pillar.x, w.drone.position.z - pillar.z),
    ).toBeGreaterThanOrEqual(pillar.radius + DRONE_RADIUS - 1e-6);
    expect(w.mission.collisions).toBe(1);
    expect(liveScore(w)).toBe(0);
    expect(w.events.filter((e) => e.type === "collision")).toHaveLength(1);
  });

  it("counts separate impacts after the cooldown but not continuous contact", () => {
    const w = createWorld("RACE");
    startAndRun(w);
    // Wall at maxX: ram it, back off, ram again.
    stageDrone(w, { x: 40, y: 5, z: -10, vx: 15, vy: 0, vz: 0, energy: 90 });
    stepN(w, 120, { x: 1, y: 0, z: 0, boost: false });
    expect(w.mission.collisions).toBe(1);
    stepN(w, 60, { x: -1, y: 0, z: 0, boost: false });
    stepN(w, 240, { x: 1, y: 0, z: 0, boost: false });
    expect(w.mission.collisions).toBe(2);
  });

  it("does not count a gentle landing on the floor", () => {
    const w = createWorld("SPORT");
    startAndRun(w);
    stageDrone(w, { x: 0, y: 3, z: 0, vx: 0, vy: -1.5, vz: 0, energy: 90 });
    stepN(w, 480, { x: 0, y: -0.15, z: 0, boost: false });
    expect(w.drone.position.y).toBeCloseTo(DRONE_REST_HEIGHT, 5);
    expect(w.mission.collisions).toBe(0);
  });

  it("ignores collisions outside an active mission", () => {
    const w = createWorld("RACE");
    stageDrone(w, { x: 40, y: 5, z: -10, vx: 15, vy: 0, vz: 0, energy: 90 });
    stepN(w, 120, { x: 1, y: 0, z: 0, boost: false });
    expect(w.mission.collisions).toBe(0);
  });
});

describe("scoring", () => {
  it("awards checkpoints, subtracts collisions, adds time bonus only on success", () => {
    expect(computeScore({ checkpoints: 3, collisions: 1, durationMs: 30000, success: false })).toBe(
      3 * POINTS_PER_CHECKPOINT - COLLISION_PENALTY,
    );
    expect(computeScore({ checkpoints: 5, collisions: 0, durationMs: 30000, success: true })).toBe(
      5000 + 1500,
    );
    expect(timeBonus(MISSION_TIME_LIMIT_MS)).toBe(0);
  });

  it("never goes negative", () => {
    expect(computeScore({ checkpoints: 0, collisions: 9, durationMs: 60000, success: false })).toBe(
      0,
    );
  });
});

describe("mission lifecycle", () => {
  it("runs countdown → running and holds the drone during the countdown", () => {
    const w = createWorld("SPORT");
    startMission(w);
    expect(w.mission.status).toBe("countdown");
    stepN(w, 120, { x: 0, y: 0, z: 1, boost: false });
    expect(w.drone.position.z).toBe(ARENA.start.z);
    stepN(w, 241);
    expect(w.mission.status).toBe("running");
    expect(w.events.map((e) => e.type)).toEqual(["countdown", "countdown", "countdown", "go"]);
  });

  it("pauses and resumes: no time or movement passes while paused", () => {
    const w = createWorld("SPORT");
    startAndRun(w);
    stepN(w, 60, { x: 0, y: 1, z: 1, boost: false });
    const ticks = w.mission.ticks;
    const pos = { ...w.drone.position };
    expect(togglePause(w)).toBe(true);
    expect(w.mission.status).toBe("paused");
    stepN(w, 240, { x: 0, y: 1, z: 1, boost: false });
    expect(w.mission.ticks).toBe(ticks);
    expect(w.drone.position).toEqual(pos);
    togglePause(w);
    expect(w.mission.status).toBe("running");
    stepN(w, 1, { x: 0, y: 1, z: 1, boost: false });
    expect(w.mission.ticks).toBe(ticks + 1);
  });

  it("pause is a no-op when no mission is active", () => {
    const w = createWorld("SPORT");
    expect(togglePause(w)).toBe(false);
    expect(w.mission.status).toBe("ready");
  });

  it("reset returns the drone to the pad in the ready state", () => {
    const w = createWorld("SPORT");
    startAndRun(w);
    stepN(w, 120, { x: 1, y: 1, z: 1, boost: false });
    resetFlight(w);
    expect(w.mission.status).toBe("ready");
    expect(w.mission.ticks).toBe(0);
    expect(w.drone.position).toEqual(ARENA.start);
  });

  it("fails with a timeout result after 60 seconds", () => {
    const w = createWorld("ECO");
    startAndRun(w);
    stepN(w, 60 * 120 + 10);
    expect(w.mission.status).toBe("failed");
    const r = w.mission.result;
    expect(r).not.toBeNull();
    expect(r?.durationMs).toBe(MISSION_TIME_LIMIT_MS);
    expect(r?.outcome).toBe("failed");
    expect(r?.checkpoints).toBe(0);
    expect(r?.score).toBe(0);
  });

  for (const engine of ["ECO", "SPORT", "RACE"] as const) {
    it(`an autopilot flying real stick inputs completes the course on ${engine}`, () => {
      const w = createWorld(engine);
      startAndRun(w);
      const pilot = createCourseAutopilot(w);
      let guard = 0;
      while (w.mission.status === "running" && guard++ < 70 * 120) stepWorld(w, pilot.input(w));
      const r = w.mission.result;
      expect(w.mission.status).toBe("success");
      expect(r?.checkpoints).toBe(5);
      expect(r?.splitsMs).toHaveLength(5);
      expect(r?.durationMs).toBeLessThan(MISSION_TIME_LIMIT_MS);
      expect(r?.collisions).toBe(0);
      expect(r?.score).toBe(
        computeScore({
          checkpoints: 5,
          collisions: 0,
          durationMs: r?.durationMs ?? 0,
          success: true,
        }),
      );
      expect(r?.telemetry.length).toBeGreaterThan(10);
      expect(r?.avgSpeed).toBeLessThanOrEqual(r?.maxSpeed ?? 0);
    });
  }

  it("is deterministic: identical inputs give identical results", () => {
    const run = () => {
      const w = createWorld("RACE");
      startAndRun(w);
      const pilot = createCourseAutopilot(w);
      while (w.mission.status === "running") stepWorld(w, pilot.input(w));
      return w.mission.result;
    };
    expect(run()).toEqual(run());
  });

  it("faster engines finish the autopilot course sooner", () => {
    const time = (engine: "ECO" | "RACE") => {
      const w = createWorld(engine);
      startAndRun(w);
      const pilot = createCourseAutopilot(w);
      while (w.mission.status === "running") stepWorld(w, pilot.input(w));
      return w.mission.result?.durationMs ?? Infinity;
    };
    expect(time("RACE")).toBeLessThan(time("ECO"));
  });
});
