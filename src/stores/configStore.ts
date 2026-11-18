"use client";

import {
  DEFAULT_DRONE_CONFIG,
  isQualityId,
  sanitizeDroneConfig,
  type DroneConfig,
  type QualityId,
} from "@/domain/config";
import { createStore, useStore } from "./createStore";

/**
 * Drone configuration + app preferences. Lives at module scope, so it survives
 * client-side navigation between modules; it is also mirrored to localStorage
 * so it survives reloads. Benchmark mode never reads or writes storage.
 */
export interface ConfigState extends DroneConfig {
  quality: QualityId;
  callsign: string;
  showPerf: boolean;
  hydrated: boolean;
}

const STORAGE_KEY = "aegis.config.v1";

const initial: ConfigState = {
  ...DEFAULT_DRONE_CONFIG,
  quality: "HIGH",
  callsign: "PILOT-01",
  showPerf: false,
  hydrated: false,
};

export const configStore = createStore<ConfigState>(initial);

let persistEnabled = false;

export function hydrateConfig(opts: { benchmark: boolean; forceQuality?: QualityId }): void {
  if (configStore.get().hydrated) {
    if (opts.forceQuality) configStore.set({ quality: opts.forceQuality });
    return;
  }
  if (opts.benchmark) {
    // Fixed, reproducible configuration.
    configStore.set({
      ...DEFAULT_DRONE_CONFIG,
      quality: "HIGH",
      callsign: "BENCH-42",
      hydrated: true,
    });
    return;
  }
  let patch: Partial<ConfigState> = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      const rec = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Record<
        string,
        unknown
      >;
      patch = {
        ...sanitizeDroneConfig(rec),
        ...(isQualityId(rec.quality) ? { quality: rec.quality } : {}),
        ...(typeof rec.callsign === "string" && /^[A-Za-z0-9 _-]{2,16}$/.test(rec.callsign)
          ? { callsign: rec.callsign }
          : {}),
      };
    } else if (window.matchMedia("(pointer: coarse)").matches) {
      patch = { quality: "MEDIUM" };
    }
  } catch {
    // Storage unavailable (private mode): defaults apply.
  }
  configStore.set({
    ...patch,
    ...(opts.forceQuality ? { quality: opts.forceQuality } : {}),
    hydrated: true,
  });
  persistEnabled = true;
}

configStore.subscribe(() => {
  if (!persistEnabled) return;
  const { paint, engine, lights, quality, callsign } = configStore.get();
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ paint, engine, lights, quality, callsign }),
    );
  } catch {
    // Ignore quota / privacy errors.
  }
});

export const useConfig = <S>(selector: (s: ConfigState) => S): S =>
  useStore(configStore, selector, initial);
