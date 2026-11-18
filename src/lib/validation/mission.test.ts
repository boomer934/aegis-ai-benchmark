import { describe, expect, it } from "vitest";
import { createCourseAutopilot } from "@/sim/autopilot";
import { createWorld, startMission, stepWorld } from "@/sim/mission";
import { NEUTRAL_INPUT } from "@/sim/physics";
import { computeScore } from "@/sim/scoring";
import {
  checkMissionPlausibility,
  minimumCourseTimeMs,
  missionQuerySchema,
  missionSubmissionSchema,
  type MissionSubmission,
} from "./mission";

/** A genuine result produced by flying the simulation. */
function flownSubmission(): MissionSubmission {
  const w = createWorld("SPORT");
  startMission(w);
  for (let i = 0; i < 361; i++) stepWorld(w, NEUTRAL_INPUT);
  const pilot = createCourseAutopilot(w);
  while (w.mission.status === "running") stepWorld(w, pilot.input(w));
  const r = w.mission.result;
  if (!r) throw new Error("no result");
  return {
    callsign: "TEST-PILOT",
    outcome: r.outcome,
    engine: r.engine,
    paint: "graphite",
    durationMs: r.durationMs,
    score: r.score,
    checkpoints: r.checkpoints,
    collisions: r.collisions,
    maxSpeed: r.maxSpeed,
    avgSpeed: r.avgSpeed,
    energyUsed: r.energyUsed,
    splitsMs: r.splitsMs,
    telemetry: r.telemetry,
  };
}

const valid = flownSubmission();
const parse = (v: unknown) => missionSubmissionSchema.safeParse(v);

describe("mission submission validation", () => {
  it("accepts a genuine flown result", () => {
    const p = parse(valid);
    expect(p.success).toBe(true);
    if (p.success) expect(checkMissionPlausibility(p.data)).toEqual([]);
  });

  it("rejects missing fields, wrong types and unknown fields", () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ ...valid, score: "9000" }).success).toBe(false);
    expect(parse({ ...valid, admin: true }).success).toBe(false);
    expect(parse({ ...valid, durationMs: 1.5 }).success).toBe(false);
    expect(parse({ ...valid, maxSpeed: Number.NaN }).success).toBe(false);
  });

  it("rejects bad enums and out-of-range values", () => {
    expect(parse({ ...valid, engine: "WARP" }).success).toBe(false);
    expect(parse({ ...valid, paint: "gold" }).success).toBe(false);
    expect(parse({ ...valid, checkpoints: 6 }).success).toBe(false);
    expect(parse({ ...valid, collisions: -1 }).success).toBe(false);
    expect(parse({ ...valid, durationMs: 61_000 }).success).toBe(false);
  });

  it("validates and trims callsigns", () => {
    expect(parse({ ...valid, callsign: "x" }).success).toBe(false);
    expect(parse({ ...valid, callsign: "<script>" }).success).toBe(false);
    expect(parse({ ...valid, callsign: "A".repeat(17) }).success).toBe(false);
    const p = parse({ ...valid, callsign: "  ACE-1  " });
    expect(p.success && p.data.callsign).toBe("ACE-1");
  });

  it("flags scores that disagree with the scoring rules", () => {
    const p = missionSubmissionSchema.parse({ ...valid, score: valid.score + 1000 });
    expect(checkMissionPlausibility(p).join(" ")).toMatch(/Score/);
  });

  it("flags impossible durations, speeds and outcome inconsistencies", () => {
    const tooFast = { ...valid, durationMs: 1000, splitsMs: [200, 400, 600, 800, 1000], telemetry: [] };
    tooFast.score = computeScore({ checkpoints: 5, collisions: valid.collisions, durationMs: 1000, success: true });
    expect(checkMissionPlausibility(missionSubmissionSchema.parse(tooFast)).join(" ")).toMatch(/faster than/);

    const speeding = missionSubmissionSchema.parse({ ...valid, maxSpeed: 80 });
    expect(checkMissionPlausibility(speeding).join(" ")).toMatch(/Max speed/);

    const fakeSuccess = missionSubmissionSchema.parse({ ...valid, checkpoints: 4, splitsMs: valid.splitsMs.slice(0, 4) });
    expect(checkMissionPlausibility(fakeSuccess).join(" ")).toMatch(/all 5 checkpoints/);

    const earlyFail = missionSubmissionSchema.parse({
      ...valid,
      outcome: "failed",
      checkpoints: 2,
      splitsMs: valid.splitsMs.slice(0, 2),
      score: 2000,
    });
    expect(checkMissionPlausibility(earlyFail).join(" ")).toMatch(/60 s time limit/);
  });

  it("flags non-monotonic splits and telemetry", () => {
    const badSplits = missionSubmissionSchema.parse({ ...valid, splitsMs: [...valid.splitsMs].reverse() });
    expect(checkMissionPlausibility(badSplits).join(" ")).toMatch(/strictly increasing/);
    const badTrace = missionSubmissionSchema.parse({ ...valid, telemetry: [...valid.telemetry].reverse() });
    expect(checkMissionPlausibility(badTrace).join(" ")).toMatch(/ascending/);
  });

  it("derives a sane minimum course time per engine", () => {
    expect(minimumCourseTimeMs("RACE")).toBeLessThan(minimumCourseTimeMs("ECO"));
    expect(valid.durationMs).toBeGreaterThan(minimumCourseTimeMs("SPORT"));
  });
});

describe("query validation", () => {
  it("coerces and bounds the limit", () => {
    expect(missionQuerySchema.parse({}).limit).toBe(20);
    expect(missionQuerySchema.parse({ limit: "5" }).limit).toBe(5);
    expect(missionQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(missionQuerySchema.safeParse({ outcome: "maybe" }).success).toBe(false);
  });
});
