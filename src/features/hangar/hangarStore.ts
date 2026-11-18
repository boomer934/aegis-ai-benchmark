"use client";

import type { HangarCamera } from "@/lib/runtime";
import { createStore, useStore } from "@/stores/createStore";

/** Hangar view state (camera preset + inspection sequence). */
export interface HangarState {
  preset: HangarCamera;
  /** Incremented on every preset request so re-selecting the same preset re-frames. */
  presetNonce: number;
  inspecting: boolean;
  /** Inspection sequence progress 0–1, published at ~10 Hz by the scene. */
  progress: number;
}

const initial: HangarState = { preset: "hero", presetNonce: 0, inspecting: false, progress: 0 };
export const hangarStore = createStore<HangarState>(initial);
export const useHangar = <S>(sel: (s: HangarState) => S): S => useStore(hangarStore, sel, initial);

export const INSPECTION_DURATION_S = 9;

export const INSPECTION_STEPS: { at: number; system: string; detail: string }[] = [
  { at: 0.12, system: "Propulsion", detail: "4× brushless 2806 · bearings nominal" },
  { at: 0.27, system: "Rotor guards", detail: "Ring stiffness within tolerance" },
  { at: 0.42, system: "Power cell", detail: "6S 8000 mAh · cell delta 4 mV" },
  { at: 0.57, system: "Avionics", detail: "Flight controller self-test passed" },
  { at: 0.72, system: "Sensor gimbal", detail: "3-axis lock · lens clean" },
  { at: 0.86, system: "Structure", detail: "Carbon arms · no delamination" },
  { at: 0.97, system: "Nav lighting", detail: "Port / starboard / strobe OK" },
];

export function requestPreset(preset: HangarCamera): void {
  hangarStore.set((s) => ({ preset, presetNonce: s.presetNonce + 1 }));
}

export function setInspection(on: boolean): void {
  hangarStore.set({ inspecting: on, progress: on ? 0 : hangarStore.get().progress });
}
