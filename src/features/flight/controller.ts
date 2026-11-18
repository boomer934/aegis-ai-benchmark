"use client";

import { createCourseAutopilot } from "@/sim/autopilot";
import {
  createWorld,
  elapsedMs,
  isMissionActive,
  liveScore,
  resetFlight,
  setEngine,
  startMission,
  stepWorld,
  togglePause,
  type SimEvent,
  type World,
} from "@/sim/mission";
import { NEUTRAL_INPUT, type FlightInput } from "@/sim/physics";
import type { EngineId } from "@/sim/profiles";
import { FixedStepper } from "@/sim/stepper";
import { lengthXZ } from "@/sim/vec";
import { flightStore, saveStore, type FlightSnapshot } from "@/stores/flightStore";

/**
 * Owns the simulation world for the flight module. Lives at module scope so a
 * mission survives navigating to another module (it is auto-paused) and
 * Mission Control can read the last session. The render loop calls `frame`.
 */
export class FlightController {
  world: World;
  readonly stepper = new FixedStepper();
  /** Interpolation factor between the previous and current physics step. */
  alpha = 0;
  /** Benchmark staging: simulation frozen until the pilot takes control. */
  frozen = false;
  staged = false;
  private publishClock = 0;
  private telemetryLen = -1;

  constructor(engine: EngineId) {
    this.world = createWorld(engine);
  }

  syncEngine(engine: EngineId): void {
    if (!isMissionActive(this.world)) setEngine(this.world, engine);
  }

  start(): boolean {
    this.leaveStage();
    const ok = startMission(this.world);
    if (ok) saveStore.set({ save: { kind: "idle" } });
    this.publish(true);
    return ok;
  }

  pause(): boolean {
    if (this.frozen) return false;
    const ok = togglePause(this.world);
    this.publish(true);
    return ok;
  }

  /** Pause only if running (used when the arena is unmounted or the tab hides). */
  autoPause(): void {
    const s = this.world.mission.status;
    if (s === "running" || s === "countdown") this.pause();
  }

  reset(): void {
    this.leaveStage();
    resetFlight(this.world);
    this.stepper.reset();
    saveStore.set({ save: { kind: "idle" } });
    this.publish(true);
  }

  /**
   * Deterministic "in-flight" benchmark state: the real simulation is flown by
   * the scripted autopilot (ordinary stick inputs) from the pad until shortly
   * after gate 1, then frozen. Same seed/engine ⇒ identical state every time.
   */
  stageBenchmark(): void {
    this.world = createWorld(this.world.profile.id);
    startMission(this.world);
    while (this.world.mission.status === "countdown") stepWorld(this.world, NEUTRAL_INPUT);
    const pilot = createCourseAutopilot(this.world);
    let afterGate = 0;
    while (this.world.mission.status === "running") {
      stepWorld(this.world, pilot.input(this.world));
      if (this.world.mission.nextGate >= 1 && ++afterGate > 150) break;
    }
    this.world.events.length = 0;
    this.alpha = 1;
    this.frozen = true;
    this.staged = true;
    this.publish(true);
  }

  private leaveStage(): void {
    if (!this.staged) return;
    this.staged = false;
    this.frozen = false;
    resetFlight(this.world);
    this.world.events.length = 0;
  }

  /** Any pilot input during a staged benchmark view hands control to the user. */
  takeControl(): void {
    if (this.staged) {
      this.leaveStage();
      this.publish(true);
    }
  }

  frame(delta: number, input: Readonly<FlightInput>): SimEvent[] {
    if (this.frozen) return [];
    const { alpha } = this.stepper.advance(delta, () => stepWorld(this.world, input));
    this.alpha = alpha;
    const events = this.world.events.splice(0, this.world.events.length);
    this.publishClock += delta;
    const statusEvent = events.some(
      (e) => e.type !== "collision" && e.type !== "wrong-gate" && e.type !== "checkpoint",
    );
    if (this.publishClock >= 1 / 12 || events.length > 0 || statusEvent) {
      this.publishClock = 0;
      this.publish(statusEvent, events);
    }
    return events;
  }

  publish(force = false, events: SimEvent[] = []): void {
    const w = this.world;
    const m = w.mission;
    const d = w.drone;
    const prev = flightStore.get();
    let resultId = prev.resultId;
    if (m.result && prev.result !== m.result) resultId = prev.resultId + 1;
    const patch: Partial<FlightSnapshot> = {
      hasSession: true,
      status: m.status,
      engine: w.profile.id,
      countdown: m.countdown,
      elapsedMs: elapsedMs(w),
      score: liveScore(w),
      checkpoints: m.nextGate,
      collisions: m.collisions,
      speed: Math.hypot(lengthXZ(d.velocity), d.velocity.y),
      verticalSpeed: d.velocity.y,
      altitude: d.position.y,
      energy: d.energy,
      boosting: d.boosting,
      x: d.position.x,
      z: d.position.z,
      splitsMs: m.splitsMs.length === prev.splitsMs.length ? prev.splitsMs : [...m.splitsMs],
      result: m.result,
      resultId,
      staged: this.staged,
    };
    if (force || m.telemetry.length !== this.telemetryLen) {
      this.telemetryLen = m.telemetry.length;
      patch.telemetry = m.telemetry.slice();
    }
    for (const e of events) {
      if (e.type === "checkpoint")
        patch.flash = {
          kind: "checkpoint",
          label: `Gate ${e.gate} cleared`,
          at: performance.now(),
        };
      else if (e.type === "collision")
        patch.flash = { kind: "collision", label: "Collision −250", at: performance.now() };
      else if (e.type === "wrong-gate")
        patch.flash = {
          kind: "wrong-gate",
          label: `Gate ${e.gate} out of order`,
          at: performance.now(),
        };
    }
    flightStore.set(patch);
  }
}

let controller: FlightController | null = null;

export function getFlightController(engine: EngineId): FlightController {
  if (!controller) controller = new FlightController(engine);
  return controller;
}
