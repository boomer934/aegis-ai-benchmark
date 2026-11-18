"use client";

import { BENCHMARK_TIME } from "@/lib/runtime";

/**
 * Scene animation clock. In benchmark mode every animated element samples the
 * same frozen instant so screenshots are byte-for-byte reproducible.
 */
export interface FrameTime {
  t: number;
  dt: number;
}

export function frameTime(elapsed: number, delta: number, frozen: boolean): FrameTime {
  return frozen ? { t: BENCHMARK_TIME, dt: 0 } : { t: elapsed, dt: Math.min(delta, 0.1) };
}
