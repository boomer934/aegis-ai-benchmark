/**
 * Mulberry32: tiny, fast, deterministic PRNG. Used for every procedural detail
 * (particles, greebles, panel wear) so that `?seed=` reproduces the same scene.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent stream for a named subsystem from a base seed. */
export function deriveSeed(seed: number, label: string): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rngRange = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);
