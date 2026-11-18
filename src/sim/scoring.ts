/**
 * Mission scoring. Shared by the client (live HUD + result) and the server
 * (which recomputes the score and rejects any record whose score disagrees).
 */
export const MISSION_TIME_LIMIT_S = 60;
export const MISSION_TIME_LIMIT_MS = MISSION_TIME_LIMIT_S * 1000;
export const COUNTDOWN_S = 3;
export const CHECKPOINT_COUNT = 5;
export const POINTS_PER_CHECKPOINT = 1000;
export const COLLISION_PENALTY = 250;
/** Completion bonus: 50 points per second left on the clock (1 point per 20 ms). */
export const TIME_BONUS_MS_PER_POINT = 20;

export interface ScoreInput {
  checkpoints: number;
  collisions: number;
  durationMs: number;
  success: boolean;
}

export function timeBonus(durationMs: number): number {
  return Math.floor(Math.max(0, MISSION_TIME_LIMIT_MS - durationMs) / TIME_BONUS_MS_PER_POINT);
}

export function computeScore({ checkpoints, collisions, durationMs, success }: ScoreInput): number {
  const base = checkpoints * POINTS_PER_CHECKPOINT;
  const penalty = collisions * COLLISION_PENALTY;
  const bonus = success ? timeBonus(durationMs) : 0;
  return Math.max(0, base - penalty + bonus);
}

export function formatMissionTime(ms: number): string {
  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  const cs = Math.floor((clamped % 1000) / 10);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
