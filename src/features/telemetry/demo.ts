import { scoreRun, type Sample } from "../flight/physics";
import type { MissionLog, MissionRecord } from "./validation";

function demoRun(
  index: number,
  durationMs: number,
  collisions: number,
  checkpoints: number,
): MissionRecord {
  const time = durationMs / 1000;
  const success = checkpoints === 5;
  const samples: Sample[] = Array.from({ length: 91 }, (_, i) => {
    const t = i / 90;
    return {
      time: t * time,
      speed:
        Math.min(1, t * 23) *
        (8.3 + 2.3 * Math.sin(t * 24) + 1.05 * Math.cos(t * 43) + 0.7 * Math.sin(t * 78)),
      altitude: 2 + Math.max(0, Math.sin(t * 3.24) * 5.4 + 0.51 * Math.sin(t * 13.8)),
      energy: 100 - t * (time * 0.84 + collisions * 2),
    };
  });
  return {
    id: `demo-${String(107 - index).padStart(3, "0")}`,
    profile: index % 2 ? "RACE" : "SPORT",
    paint: index % 2 ? "Ember" : "Arctic",
    lights: true,
    outcome: success ? "success" : "timeout",
    durationMs,
    checkpoints,
    collisions,
    score: scoreRun(checkpoints, collisions, time, success),
    energy: samples.at(-1)!.energy,
    samples,
    createdAt: `2026-01-${String(18 - index).padStart(2, "0")}T15:42:00.000Z`,
  };
}

const history = [
  demoRun(0, 34720, 1, 5),
  demoRun(1, 28910, 0, 5),
  demoRun(2, 60000, 3, 3),
  demoRun(3, 42380, 2, 5),
];
export const DEMO: MissionLog = {
  history,
  leaderboard: history.filter((row) => row.outcome === "success").sort((a, b) => b.score - a.score),
};
