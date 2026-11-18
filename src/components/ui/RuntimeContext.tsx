"use client";

import { createContext, useContext } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DEFAULT_SEED, type RuntimeMode } from "@/lib/runtime";

const defaultMode: RuntimeMode = {
  benchmark: false,
  perf: false,
  seed: DEFAULT_SEED,
  scene: null,
  camera: null,
};

export const RuntimeContext = createContext<RuntimeMode>(defaultMode);

export const useRuntime = (): RuntimeMode => useContext(RuntimeContext);

/** True when the user asked the OS for reduced motion (always true in benchmark mode). */
export function useReducedMotion(): boolean {
  const { benchmark } = useRuntime();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  return benchmark || reduced;
}
