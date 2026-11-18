"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ApiError, MissionDetail } from "@/domain/mission";
import type { MissionSubmission } from "@/lib/validation/mission";
import { configStore } from "@/stores/configStore";
import { flightStore, saveStore, useFlight } from "@/stores/flightStore";

export const CLIENT_BUILD = "aegis-web-1.0";

/** POST a finished mission. Returns the stored record or throws with a readable message. */
export async function postMission(body: MissionSubmission): Promise<MissionDetail> {
  const res = await fetch("/api/missions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json as ApiError | null;
    const detail = err?.issues?.map((i) => i.message).join("; ");
    throw new Error(
      detail ? `${err?.error}: ${detail}` : (err?.error ?? `Request failed (${res.status})`),
    );
  }
  return (json as { mission: MissionDetail }).mission;
}

/** Automatically persists every finished mission exactly once; exposes retry. */
export function useMissionSaver(enabled: boolean): { retry: () => void } {
  const resultId = useFlight((s) => s.resultId);
  const savedFor = useRef(0);

  const save = useCallback(async () => {
    const { result } = flightStore.get();
    if (!result) return;
    const { callsign, paint } = configStore.get();
    saveStore.set({ save: { kind: "saving" } });
    try {
      const mission = await postMission({
        callsign,
        outcome: result.outcome,
        engine: result.engine,
        paint,
        durationMs: result.durationMs,
        score: result.score,
        checkpoints: result.checkpoints,
        collisions: result.collisions,
        maxSpeed: result.maxSpeed,
        avgSpeed: result.avgSpeed,
        energyUsed: result.energyUsed,
        splitsMs: result.splitsMs,
        telemetry: result.telemetry,
        clientBuild: CLIENT_BUILD,
      });
      saveStore.set({ save: { kind: "saved", id: mission.id } });
    } catch (e) {
      saveStore.set({
        save: { kind: "error", message: e instanceof Error ? e.message : "Network error" },
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || resultId === 0 || savedFor.current === resultId) return;
    savedFor.current = resultId;
    void save();
  }, [enabled, resultId, save]);

  return { retry: () => void save() };
}
