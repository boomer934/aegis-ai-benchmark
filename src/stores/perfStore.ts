"use client";

/**
 * Live renderer statistics, written by <PerfProbe/> inside the Canvas and read
 * by the DOM perf panel and by automated measurement (window.__AEGIS_PERF__).
 * Values come from real frame timestamps and WebGLRenderer.info — nothing is
 * estimated.
 */
export interface PerfStats {
  /** Frame intervals (ms) in a ring buffer of the last N frames. */
  frameTimes: Float64Array;
  count: number;
  cursor: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  quality: string;
  scene: string;
  renderer: string;
}

export const PERF_WINDOW = 600;

export const perfStats: PerfStats = {
  frameTimes: new Float64Array(PERF_WINDOW),
  count: 0,
  cursor: 0,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  programs: 0,
  dpr: 1,
  quality: "",
  scene: "",
  renderer: "unknown",
};

export function resetPerf(scene: string): void {
  perfStats.count = 0;
  perfStats.cursor = 0;
  perfStats.scene = scene;
}

export function recordFrame(ms: number): void {
  perfStats.frameTimes[perfStats.cursor] = ms;
  perfStats.cursor = (perfStats.cursor + 1) % PERF_WINDOW;
  if (perfStats.count < PERF_WINDOW) perfStats.count++;
}

export interface PerfSummary {
  samples: number;
  fpsMedian: number | null;
  fpsP5: number | null;
  frameMsMedian: number | null;
  frameMsP95: number | null;
  frameMsP99: number | null;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  dpr: number;
  quality: string;
  scene: string;
  renderer: string;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function summarizePerf(lastN = PERF_WINDOW): PerfSummary {
  const n = Math.min(lastN, perfStats.count);
  const values: number[] = [];
  for (let i = 1; i <= n; i++) {
    values.push(perfStats.frameTimes[(perfStats.cursor - i + PERF_WINDOW) % PERF_WINDOW]);
  }
  values.sort((a, b) => a - b);
  const has = values.length > 0;
  const median = has ? percentile(values, 50) : null;
  // 5th-percentile FPS corresponds to the 95th-percentile frame time.
  const p95 = has ? percentile(values, 95) : null;
  return {
    samples: values.length,
    fpsMedian: median ? 1000 / median : null,
    fpsP5: p95 ? 1000 / p95 : null,
    frameMsMedian: median,
    frameMsP95: p95,
    frameMsP99: has ? percentile(values, 99) : null,
    drawCalls: perfStats.drawCalls,
    triangles: perfStats.triangles,
    geometries: perfStats.geometries,
    textures: perfStats.textures,
    programs: perfStats.programs,
    dpr: perfStats.dpr,
    quality: perfStats.quality,
    scene: perfStats.scene,
    renderer: perfStats.renderer,
  };
}
