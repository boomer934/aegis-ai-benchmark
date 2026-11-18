import { z } from "zod";
import { PAINT_IDS } from "@/domain/config";
import { ARENA, courseLength } from "@/sim/arena";
import { MAX_TRACE_POINTS } from "@/sim/mission";
import { absoluteMaxSpeed, ENGINE_IDS, ENGINE_PROFILES } from "@/sim/profiles";
import { CHECKPOINT_COUNT, computeScore, MISSION_TIME_LIMIT_MS } from "@/sim/scoring";

/**
 * Validation for client-reported mission results.
 *
 * Trust model: the flight runs in the browser, so the server cannot prove a
 * result was flown. It CAN reject records that are malformed or physically
 * impossible under the shared flight model (too fast for the engine, score that
 * disagrees with the scoring rules, success without five gates, etc.).
 * A determined user can still forge a plausible record — see BENCHMARK_REPORT.md.
 */

const finite = z.number().finite();

export const telemetrySampleSchema = z.tuple([
  finite.min(0).max(MISSION_TIME_LIMIT_MS / 1000 + 1),
  finite.min(0).max(100),
  finite.min(-1).max(100),
  finite.min(0).max(100),
]);

export const missionSubmissionSchema = z
  .object({
    callsign: z
      .string()
      .trim()
      .min(2, "Callsign must be at least 2 characters")
      .max(16, "Callsign must be at most 16 characters")
      .regex(/^[A-Za-z0-9 _-]+$/, "Callsign may only contain letters, digits, space, _ and -"),
    outcome: z.enum(["success", "failed"]),
    engine: z.enum(ENGINE_IDS),
    paint: z.enum(PAINT_IDS),
    durationMs: z.number().int().min(1).max(MISSION_TIME_LIMIT_MS),
    score: z.number().int().min(0).max(100_000),
    checkpoints: z.number().int().min(0).max(CHECKPOINT_COUNT),
    collisions: z.number().int().min(0).max(1000),
    maxSpeed: finite.min(0).max(100),
    avgSpeed: finite.min(0).max(100),
    energyUsed: finite.min(0).max(100),
    splitsMs: z.array(z.number().int().min(1).max(MISSION_TIME_LIMIT_MS)).max(CHECKPOINT_COUNT),
    telemetry: z.array(telemetrySampleSchema).max(MAX_TRACE_POINTS + 2),
    clientBuild: z.string().max(32).optional(),
  })
  .strict();

export type MissionSubmission = z.infer<typeof missionSubmissionSchema>;

/** Minimum physically possible time to fly the course with a given engine (ms). */
export function minimumCourseTimeMs(engine: (typeof ENGINE_IDS)[number]): number {
  return Math.floor((courseLength(ARENA) / absoluteMaxSpeed(ENGINE_PROFILES[engine])) * 1000);
}

/** Cross-field plausibility checks. Returns human-readable problems (empty = plausible). */
export function checkMissionPlausibility(m: MissionSubmission): string[] {
  const problems: string[] = [];
  const profile = ENGINE_PROFILES[m.engine];
  const speedCeiling = Math.hypot(absoluteMaxSpeed(profile), profile.climbSpeed * profile.boostMultiplier) + 0.5;

  if (m.outcome === "success" && m.checkpoints !== CHECKPOINT_COUNT) {
    problems.push("A successful mission must pass all 5 checkpoints");
  }
  if (m.outcome === "failed" && m.checkpoints === CHECKPOINT_COUNT) {
    problems.push("A mission with all 5 checkpoints cannot be a failure");
  }
  if (m.outcome === "failed" && m.durationMs !== MISSION_TIME_LIMIT_MS) {
    problems.push("Failed missions end on the 60 s time limit");
  }
  if (m.outcome === "success" && m.durationMs < minimumCourseTimeMs(m.engine)) {
    problems.push(`Duration is faster than the ${m.engine} engine can physically fly the course`);
  }
  const expected = computeScore({
    checkpoints: m.checkpoints,
    collisions: m.collisions,
    durationMs: m.durationMs,
    success: m.outcome === "success",
  });
  if (m.score !== expected) problems.push(`Score ${m.score} does not match the scoring rules (expected ${expected})`);
  if (m.maxSpeed > speedCeiling) problems.push(`Max speed exceeds the ${m.engine} engine limit`);
  if (m.avgSpeed > m.maxSpeed + 0.01) problems.push("Average speed cannot exceed max speed");

  if (m.splitsMs.length !== m.checkpoints) problems.push("Split count must equal checkpoint count");
  for (let i = 1; i < m.splitsMs.length; i++) {
    if (m.splitsMs[i] <= m.splitsMs[i - 1]) {
      problems.push("Checkpoint splits must be strictly increasing");
      break;
    }
  }
  const lastSplit = m.splitsMs.at(-1);
  if (lastSplit !== undefined && lastSplit > m.durationMs) problems.push("Splits cannot exceed mission duration");

  let prevT = -1;
  for (const [t, speed] of m.telemetry) {
    if (t < prevT) {
      problems.push("Telemetry timestamps must be ascending");
      break;
    }
    if (t > m.durationMs / 1000 + 0.05) {
      problems.push("Telemetry extends beyond the mission duration");
      break;
    }
    if (speed > speedCeiling) {
      problems.push("Telemetry speed exceeds the engine limit");
      break;
    }
    prevT = t;
  }
  return problems;
}

export const missionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  outcome: z.enum(["success", "failed"]).optional(),
  engine: z.enum(ENGINE_IDS).optional(),
});

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  engine: z.enum(ENGINE_IDS).optional(),
});
