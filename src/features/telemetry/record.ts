import { scoreRun, type Configuration, type FlightState, type Sample } from "../flight/physics";
import type { ResultInput } from "./validation";

export function makeResult(
  id: string,
  config: Configuration,
  state: FlightState,
  samples: Sample[],
): ResultInput {
  const outcome = state.phase === "success" ? "success" : "timeout";
  const durationMs = Math.round(state.elapsed * 1000);
  return {
    id,
    ...config,
    outcome,
    durationMs,
    checkpoints: state.checkpoints,
    collisions: state.collisions,
    energy: state.energy,
    score: scoreRun(state.checkpoints, state.collisions, durationMs / 1000, outcome === "success"),
    samples,
  };
}
