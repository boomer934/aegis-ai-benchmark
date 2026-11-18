import { describe, expect, it } from "vitest";
import { resultSchema, type ResultInput } from "@/features/telemetry/validation";

const result: ResultInput = {
  id: "b36ec3c4-2818-44ab-bb06-f179d21dea00",
  profile: "SPORT",
  paint: "Arctic",
  lights: true,
  outcome: "success",
  durationMs: 30_000,
  checkpoints: 5,
  collisions: 1,
  score: 1415,
  energy: 72,
  samples: [
    { time: 0, speed: 0, altitude: 2, energy: 100 },
    { time: 30, speed: 7, altitude: 3, energy: 72 },
  ],
};

describe("Mission result validation", () => {
  it("accepts bounded, consistent results and preserves the telemetry", () => {
    expect(resultSchema.parse(result)).toEqual(result);
  });

  it.each([
    { score: 6000 },
    { score: 1 },
    { durationMs: 61_000 },
    { durationMs: 200 },
    { outcome: "timeout" },
    { checkpoints: 4 },
    { collisions: -1 },
    { profile: "HYPER" },
    { id: "broken" },
    { extra: "surplus" },
  ])("rejects invalid result fields %j", (change) => {
    expect(resultSchema.safeParse({ ...result, ...change }).success).toBe(false);
  });

  it("rejects impossible altitude, nonmonotonic time and inconsistent final energy", () => {
    const [first, last] = result.samples;
    expect(
      resultSchema.safeParse({ ...result, samples: [first, { ...last, altitude: -1 }] }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ ...result, samples: [first, { ...last, time: 0 }] }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({ ...result, samples: [first, { ...last, energy: 90 }] }).success,
    ).toBe(false);
    expect(
      resultSchema.safeParse({
        ...result,
        samples: [first, { ...last, time: 29, energy: 71 }, last],
      }).success,
    ).toBe(false);
  });
});
