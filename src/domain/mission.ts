import type { EngineId } from "@/sim/profiles";
import type { TelemetrySample } from "@/sim/mission";
import type { PaintId } from "./config";

/** Mission record as returned by the API (list view omits the telemetry trace). */
export interface MissionSummary {
  id: string;
  createdAt: string;
  callsign: string;
  outcome: "success" | "failed";
  engine: EngineId;
  paint: PaintId;
  durationMs: number;
  score: number;
  checkpoints: number;
  collisions: number;
  maxSpeed: number;
  avgSpeed: number;
  energyUsed: number;
}

export interface MissionDetail extends MissionSummary {
  telemetry: TelemetrySample[];
  splitsMs: number[];
}

export interface ApiError {
  error: string;
  issues?: { path: string; message: string }[];
}
