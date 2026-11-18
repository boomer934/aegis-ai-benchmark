"use client";

import type { MissionResult, MissionStatus, TelemetrySample } from "@/sim/mission";
import type { EngineId } from "@/sim/profiles";
import { createStore, useStore } from "./createStore";

/**
 * Snapshot of the running simulation for the DOM (HUD, Mission Control).
 * The render loop publishes here at ~12 Hz (and immediately on status
 * changes) — React never re-renders at frame rate.
 */
export interface FlightSnapshot {
  /** True once a flight session has produced data in this page session. */
  hasSession: boolean;
  status: MissionStatus;
  engine: EngineId;
  countdown: number;
  elapsedMs: number;
  score: number;
  checkpoints: number;
  collisions: number;
  speed: number;
  verticalSpeed: number;
  altitude: number;
  energy: number;
  boosting: boolean;
  x: number;
  z: number;
  /** Live telemetry of the current/last mission (10 Hz samples). */
  telemetry: TelemetrySample[];
  splitsMs: number[];
  result: MissionResult | null;
  /** Monotonic id of the result, so the UI saves each result exactly once. */
  resultId: number;
  /** Latest transient event for HUD feedback. */
  flash: { kind: "checkpoint" | "collision" | "wrong-gate"; label: string; at: number } | null;
  staged: boolean;
}

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; id: string }
  | { kind: "error"; message: string };

export const initialFlight: FlightSnapshot = {
  hasSession: false,
  status: "ready",
  engine: "SPORT",
  countdown: 0,
  elapsedMs: 0,
  score: 0,
  checkpoints: 0,
  collisions: 0,
  speed: 0,
  verticalSpeed: 0,
  altitude: 0,
  energy: 100,
  boosting: false,
  x: 0,
  z: 6,
  telemetry: [],
  splitsMs: [],
  result: null,
  resultId: 0,
  flash: null,
  staged: false,
};

export const flightStore = createStore<FlightSnapshot>(initialFlight);
export const saveStore = createStore<{ save: SaveState }>({ save: { kind: "idle" } });

export const useFlight = <S>(selector: (s: FlightSnapshot) => S): S =>
  useStore(flightStore, selector, initialFlight);
export const useSaveState = (): SaveState => useStore(saveStore, (s) => s.save);
