import { it, expect } from "vitest";
import { submission } from "./results";
const record = {
  id: "905ac1ea-aec1-4a55-a2e6-b70816979662",
  outcome: "timeout",
  durationMs: 60000,
  gates: 2,
  collisions: 1,
  score: 1850,
  profile: "SPORT",
  paint: "Signal",
};
it("accepts a consistent timed-out flight", () =>
  expect(submission.safeParse(record).success).toBe(true));
it.each([
  { score: 1851 },
  { outcome: "success" },
  { durationMs: 59990 },
  { gates: 6 },
  { profile: "MAX" },
  { id: "no" },
  { collisions: -1 },
  { extra: "x" },
  { gates: 1.5 },
  { durationMs: 400, outcome: "success", gates: 5, score: 5596 },
])("rejects inconsistent input %j", (change) =>
  expect(submission.safeParse({ ...record, ...change }).success).toBe(false),
);
