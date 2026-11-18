/**
 * Runtime mode derived from URL parameters.
 *  - `?benchmark=1&seed=42[&scene=…&camera=…]` deterministic screenshot mode
 *  - `?perf=1` live performance measurement (HIGH quality, DPR 1.5, panel visible)
 */
export type HangarCamera = "hero" | "side" | "top";
export type FlightCamera = "chase";
export type BenchScene = "hangar" | "flight" | "telemetry";

export interface RuntimeMode {
  benchmark: boolean;
  perf: boolean;
  seed: number;
  scene: BenchScene | null;
  camera: string | null;
}

export const DEFAULT_SEED = 42;
/** Fixed DPR for benchmark and perf measurements. */
export const MEASUREMENT_DPR = 1.5;
/** Animation time (s) every animated element is frozen at in benchmark mode. */
export const BENCHMARK_TIME = 4.2;

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function parseRuntimeMode(params: SearchParams): RuntimeMode {
  const benchmark = first(params.benchmark) === "1";
  const perf = first(params.perf) === "1";
  const seedRaw = Number.parseInt(first(params.seed) ?? "", 10);
  const seed = Number.isFinite(seedRaw) && seedRaw >= 0 ? seedRaw % 2 ** 31 : DEFAULT_SEED;
  const sceneRaw = first(params.scene);
  const scene = sceneRaw === "hangar" || sceneRaw === "flight" || sceneRaw === "telemetry" ? sceneRaw : null;
  const camera = first(params.camera) ?? null;
  return { benchmark, perf, seed, scene, camera };
}

export function parseHangarCamera(camera: string | null): HangarCamera {
  return camera === "side" || camera === "top" ? camera : "hero";
}

/** Query string that preserves benchmark/perf flags across module navigation. */
export function modeQuery(mode: RuntimeMode): string {
  const q = new URLSearchParams();
  if (mode.benchmark) {
    q.set("benchmark", "1");
    q.set("seed", String(mode.seed));
  }
  if (mode.perf) q.set("perf", "1");
  const s = q.toString();
  return s ? `?${s}` : "";
}
