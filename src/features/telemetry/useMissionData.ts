"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiError, MissionDetail, MissionSummary } from "@/domain/mission";
import type { EngineId } from "@/sim/profiles";
import { useSaveState } from "@/stores/flightStore";
import { demoMissions } from "./demoData";

export type Loadable<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: T };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as ApiError | null)?.error ?? `Request failed (${res.status})`);
  return body as T;
}

/**
 * Fetch `url` (null = skip). Results are stored with the request key, so a new
 * key reads as "loading" without a synchronous setState inside the effect.
 */
function useFetch<T>(url: string | null, refreshKey: string): Loadable<T> {
  const key = url ? `${url}#${refreshKey}` : null;
  const [res, setRes] = useState<{ key: string; value: Loadable<T> } | null>(null);
  useEffect(() => {
    if (!url || !key) return;
    let cancelled = false;
    getJson<T>(url)
      .then((data) => !cancelled && setRes({ key, value: { state: "ready", data } }))
      .catch((e: unknown) => !cancelled && setRes({ key, value: { state: "error", message: e instanceof Error ? e.message : "Network error" } }));
    return () => {
      cancelled = true;
    };
  }, [url, key]);
  return res && res.key === key ? res.value : { state: "loading" };
}

/** Bumps whenever a new mission record is saved, so lists refresh automatically. */
function useSavedKey(): string {
  const save = useSaveState();
  return save.kind === "saved" ? save.id : "";
}

export type OutcomeFilter = "all" | "success" | "failed";

/** Mission history: API in normal mode, deterministic demo set in benchmark mode. */
export function useHistory(filter: OutcomeFilter, demo: boolean, seed: number) {
  const [nonce, setNonce] = useState(0);
  const saved = useSavedKey();
  const q = filter === "all" ? "" : `&outcome=${filter}`;
  const remote = useFetch<{ missions: MissionSummary[]; total: number }>(demo ? null : `/api/missions?limit=25${q}`, `${nonce}-${saved}`);
  const local = useMemo<Loadable<{ missions: MissionSummary[]; total: number }> | null>(() => {
    if (!demo) return null;
    const missions = demoMissions(seed).filter((m) => filter === "all" || m.outcome === filter);
    return { state: "ready", data: { missions, total: missions.length } };
  }, [demo, seed, filter]);
  return { data: local ?? remote, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

export function useLeaderboard(engine: EngineId | "ALL", demo: boolean, seed: number) {
  const [nonce, setNonce] = useState(0);
  const saved = useSavedKey();
  const q = engine === "ALL" ? "" : `&engine=${engine}`;
  const remote = useFetch<{ entries: MissionSummary[] }>(demo ? null : `/api/leaderboard?limit=10${q}`, `${nonce}-${saved}`);
  const local = useMemo<Loadable<MissionSummary[]> | null>(() => {
    if (!demo) return null;
    const rows = demoMissions(seed)
      .filter((m) => m.outcome === "success" && (engine === "ALL" || m.engine === engine))
      .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs);
    return { state: "ready", data: rows };
  }, [demo, seed, engine]);
  const data: Loadable<MissionSummary[]> =
    local ?? (remote.state === "ready" ? { state: "ready", data: remote.data.entries } : remote);
  return { data, reload: useCallback(() => setNonce((n) => n + 1), []) };
}

export function useMissionDetail(id: string | null, demo: boolean, seed: number): Loadable<MissionDetail> | null {
  const remote = useFetch<{ mission: MissionDetail }>(!demo && id ? `/api/missions/${encodeURIComponent(id)}` : null, "");
  return useMemo(() => {
    if (!id) return null;
    if (demo) {
      const m = demoMissions(seed).find((x) => x.id === id);
      return m ? { state: "ready", data: m } : { state: "error", message: "Demo record not found" };
    }
    return remote.state === "ready" ? { state: "ready", data: remote.data.mission } : remote;
  }, [id, demo, seed, remote]);
}
