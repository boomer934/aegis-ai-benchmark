import { z } from "zod";
import { FLY_BOUNDS, GATES, LIMIT, scoreRun } from "../flight/physics";

const range = (min: number, max: number) => z.number().min(min).max(max);
export const sampleSchema = z.strictObject({
  time: range(0, LIMIT),
  speed: range(0, 26),
  altitude: range(FLY_BOUNDS.low, FLY_BOUNDS.high),
  energy: range(0, 100),
});

export const resultSchema = z
  .strictObject({
    id: z.uuid({ version: "v4" }),
    profile: z.enum(["ECO", "SPORT", "RACE"]),
    paint: z.enum(["Arctic", "Ember", "Carbon"]),
    lights: z.boolean(),
    outcome: z.enum(["success", "timeout"]),
    durationMs: z
      .int()
      .min(1)
      .max(LIMIT * 1000),
    checkpoints: z.int().min(0).max(GATES.length),
    collisions: z.int().min(0).max(500),
    score: z.int().min(0).max(1730),
    energy: range(0, 100),
    samples: z.array(sampleSchema).min(2).max(123),
  })
  .superRefine((record, ctx) => {
    function invalid(path: string, message: string) {
      ctx.addIssue({ code: "custom", path: [path], message });
    }
    const success = record.outcome === "success";
    if (success !== (record.checkpoints === GATES.length))
      invalid("checkpoints", "Outcome and checkpoint count disagree.");
    if (!success && record.durationMs !== LIMIT * 1000)
      invalid("durationMs", "A timed-out run must last 60 seconds.");
    if (success && record.durationMs < 3000)
      invalid("durationMs", "The full circuit cannot be flown in under three seconds.");
    if (
      record.score !==
      scoreRun(record.checkpoints, record.collisions, record.durationMs / 1000, success)
    ) {
      invalid("score", "Score does not match the run.");
    }
    const first = record.samples[0];
    const last = record.samples.at(-1);
    if (
      first?.time !== 0 ||
      first.speed !== 0 ||
      first.energy !== 100 ||
      first.altitude !== 2 ||
      last?.time !== record.durationMs / 1000 ||
      last.energy !== record.energy
    ) {
      invalid("samples", "Start or final telemetry disagrees with the run.");
    }
    if (
      record.samples.some(
        (sample, i, all) =>
          i > 0 && (sample.time <= all[i - 1].time || sample.energy > all[i - 1].energy),
      )
    ) {
      invalid("samples", "Telemetry time must increase and energy must not increase.");
    }
  });

export type ResultInput = z.infer<typeof resultSchema>;
export type MissionRecord = ResultInput & { createdAt: string };
export type MissionLog = { history: MissionRecord[]; leaderboard: MissionRecord[] };
