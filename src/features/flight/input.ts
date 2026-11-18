"use client";

import { useEffect } from "react";
import type { FlightInput } from "@/sim/physics";

/**
 * Pilot input aggregation: keyboard (desktop) + on-screen controls (touch).
 * Kept in a mutable module object read by the render loop each frame; it
 * never causes React re-renders.
 */
const keys = new Set<string>();
export const touchInput = { x: 0, y: 0, z: 0, boost: false };

const BINDINGS = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["KeyE"],
  down: ["KeyQ"],
  boost: ["ShiftLeft", "ShiftRight"],
} as const;

const FLIGHT_KEYS: ReadonlySet<string> = new Set(Object.values(BINDINGS).flat());
const held = (codes: readonly string[]) => codes.some((c) => keys.has(c));
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function readInput(out: FlightInput): FlightInput {
  out.x = clamp1((held(BINDINGS.right) ? 1 : 0) - (held(BINDINGS.left) ? 1 : 0) + touchInput.x);
  out.z = clamp1((held(BINDINGS.forward) ? 1 : 0) - (held(BINDINGS.back) ? 1 : 0) + touchInput.z);
  out.y = clamp1((held(BINDINGS.up) ? 1 : 0) - (held(BINDINGS.down) ? 1 : 0) + touchInput.y);
  out.boost = held(BINDINGS.boost) || touchInput.boost;
  return out;
}

export function clearInput(): void {
  keys.clear();
  touchInput.x = touchInput.y = touchInput.z = 0;
  touchInput.boost = false;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

export interface FlightKeyHandlers {
  onPause: () => void;
  onReset: () => void;
  onStart: () => void;
  /** Called for any flight key (used to leave a staged benchmark view). */
  onFlightKey: () => void;
}

/** Window-level keyboard handling for the flight module. */
export function useFlightKeyboard(handlers: FlightKeyHandlers): void {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (FLIGHT_KEYS.has(e.code)) {
        keys.add(e.code);
        handlers.onFlightKey();
        if (e.code.startsWith("Arrow")) e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (e.code === "Space") {
        // Let Space activate a focused button; otherwise it pauses.
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
        e.preventDefault();
        handlers.onPause();
      } else if (e.code === "KeyR") {
        handlers.onReset();
      } else if (e.code === "Enter") {
        if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement) return;
        handlers.onStart();
      }
    };
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    const blur = () => clearInput();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      clearInput();
    };
  }, [handlers]);
}

/** Setters used by the on-screen controls (keeps mutation inside this module). */
export function setTouchStick(x: number, z: number): void {
  touchInput.x = x;
  touchInput.z = z;
}
export function setTouchVertical(y: number): void {
  touchInput.y = y;
}
export function setTouchBoost(on: boolean): void {
  touchInput.boost = on;
}
