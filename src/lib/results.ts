import { z } from "zod";
import { GATES, PROFILES, score } from "@/features/flight/simulation";
export const submission = z
  .strictObject({
    id: z.uuid(),
    profile: z.enum(["ECO", "SPORT", "RACE"]),
    paint: z.enum(["Signal", "Glacier", "Ion"]),
    outcome: z.enum(["success", "timeout"]),
    durationMs: z.int().min(1).max(60000),
    gates: z.int().min(0).max(5),
    collisions: z.int().min(0).max(3600),
    score: z.int().nonnegative(),
  })
  .superRefine((r, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if ((r.outcome === "success") !== (r.gates === 5))
      fail("Outcome and checkpoint count disagree.");
    if (r.outcome === "timeout" && r.durationMs !== 60000)
      fail("A timed-out flight lasts 60 seconds.");
    const gate = GATES[r.gates - 1];
    const distance = gate ? 20 - gate.z : 0;
    if (r.collisions > Math.ceil(r.durationMs * 0.06))
      fail("Collision count exceeds the number of distinct simulation contacts.");
    if (distance > (PROFILES[r.profile].speed * 1.5 * r.durationMs) / 1000 + 0.01)
      fail("Elapsed time is too short for the reported gates.");
    if (score(r.gates, r.collisions, r.durationMs) !== r.score)
      fail("Score does not match flight totals.");
  });
export type Submission = z.infer<typeof submission>;
export type RecordRow = Submission & { createdAt: string };
export interface History {
  recent: RecordRow[];
  leaders: RecordRow[];
}
