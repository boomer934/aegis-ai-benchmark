import { useSyncExternalStore } from "react";
import {
  Simulation,
  score,
  freshFlight,
  type Paint,
  type Profile,
  type Input,
} from "@/features/flight/simulation";
import { submission, type Submission } from "@/lib/results";
const QUEUE_PREFIX = "aegis.pending.";
export type Module = "hangar" | "flight" | "telemetry";
export type Camera = "hero" | "side" | "top";
export type Quality = "LOW" | "MEDIUM" | "HIGH";
export interface Settings {
  paint: Paint;
  profile: Profile;
  lights: boolean;
  camera: Camera;
  quality: Quality;
  inspect: boolean;
}
export type Options = {
  scene: Module;
  camera: Camera;
  benchmark: boolean;
  perf: boolean;
  seed: number;
};
export type Sample = { t: number; speed: number; altitude: number; battery: number };
export const readSample = (f: ReturnType<typeof freshFlight>): Sample => ({
  t: f.elapsed,
  speed: Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z),
  altitude: f.position.y,
  battery: f.battery,
});
export class Facility {
  sim = new Simulation();
  zoomCommand = { serial: 0, factor: 1 };
  zoom(factor: number) {
    this.zoomCommand = { serial: this.zoomCommand.serial + 1, factor };
    this.emit();
  }
  keys = new Set<string>();
  sortie: { paint: Paint; profile: Profile } | null = null;
  samples: Sample[] = [];
  pending: Submission[] = [];
  saveStatus: "idle" | "saving" | "saved" | "error" = "idle";
  private publishing = 0;
  private listeners = new Set<() => void>();
  private version = 0;
  scene: Module;
  settings: Settings;
  readonly options: Options;
  constructor(options: Options) {
    this.options = options;
    this.scene = options.scene;
    this.settings = {
      paint: "Signal",
      profile: "SPORT",
      lights: true,
      camera: options.camera,
      quality: "HIGH",
      inspect: false,
    };
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.version;
  layoutSnapshot = () =>
    [
      this.scene,
      this.zoomCommand.serial,
      this.settings.camera,
      this.settings.paint,
      this.settings.profile,
      this.settings.lights,
      this.settings.inspect,
      this.settings.quality,
      this.sortie?.paint,
      this.sim.state.gates,
    ].join("|");
  phaseSnapshot = () => this.sim.state.phase;
  emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }
  configure(patch: Partial<Settings>) {
    if ((this.options.perf || this.options.benchmark) && patch.quality) return;
    this.settings = { ...this.settings, ...patch };
    this.emit();
  }
  go(scene: Module) {
    if (this.scene === "flight" && scene !== "flight") this.suspend();
    this.scene = scene;
    this.keys.clear();
    this.emit();
  }
  reset() {
    this.sim.reset();
    this.sortie = null;
    this.samples = [];
    this.keys.clear();
    this.emit();
  }
  start() {
    this.reset();
    this.sortie = { paint: this.settings.paint, profile: this.settings.profile };
    this.sim.state.phase = "countdown";
    this.samples = [readSample(this.sim.state)];
    this.emit();
  }
  togglePause() {
    const f = this.sim.state;
    if (f.phase === "running") f.phase = "paused";
    else if (f.phase === "paused") f.phase = "running";
    this.keys.clear();
    this.emit();
  }
  suspend() {
    if (this.sim.state.phase === "running") this.togglePause();
    if (this.sim.state.phase === "countdown") this.reset();
    this.keys.clear();
  }
  advance(dt: number) {
    const f = this.sim.state;
    if (this.scene !== "flight" || (f.phase !== "running" && f.phase !== "countdown")) return;
    const held = (k: string) => Number(this.keys.has(k));
    const input: Input = {
      x: held("KeyD") - held("KeyA"),
      y: held("KeyE") - held("KeyQ"),
      z: held("KeyS") - held("KeyW"),
      boost: !!held("Shift"),
    };
    this.sim.advance(Math.min(dt, 64), input, this.sortie?.profile ?? this.settings.profile);
    const phase = this.sim.state.phase;
    if (
      f.elapsed - (this.samples.at(-1)?.t ?? 0) >= 0.249 ||
      phase === "success" ||
      phase === "timeout"
    )
      this.samples.push(readSample(f));
    this.publishing += dt;
    if (phase === "success" || phase === "timeout") {
      const durationMs = Math.round(f.elapsed * 1000);
      this.pending.push({
        id: crypto.randomUUID(),
        paint: this.sortie?.paint ?? this.settings.paint,
        profile: this.sortie?.profile ?? this.settings.profile,
        outcome: phase,
        durationMs,
        gates: f.gates,
        collisions: f.collisions,
        score: score(f.gates, f.collisions, durationMs),
      });
      const latest = this.pending.at(-1)!;
      try {
        localStorage.setItem(QUEUE_PREFIX + latest.id, JSON.stringify(latest));
      } catch {
        /* Keep the in-memory copy if storage is full. */
      }
      void this.save();
    }
    if (this.publishing >= 0.09 || phase === "success" || phase === "timeout") {
      this.publishing = 0;
      this.emit();
    }
  }
  restore() {
    if (this.options.benchmark) return;
    try {
      for (const key of Object.keys(localStorage).filter((key) => key.startsWith(QUEUE_PREFIX))) {
        try {
          const parsed = submission.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
          if (
            parsed.success &&
            key === QUEUE_PREFIX + parsed.data.id &&
            !this.pending.some((r) => r.id === parsed.data.id)
          )
            this.pending.push(parsed.data);
        } catch {
          /* A malformed entry must not block other pending flights. */
        }
      }
    } catch {
      /* Private browsing may disable local storage. */
    }
    if (this.pending.length) void this.save();
  }
  async save() {
    if (this.saveStatus === "saving") return;
    this.saveStatus = "saving";
    this.emit();
    try {
      while (this.pending.length) {
        const response = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.pending[0]),
        });
        if (!response.ok) throw new Error();
        const saved = this.pending.shift()!;
        try {
          localStorage.removeItem(QUEUE_PREFIX + saved.id);
        } catch {
          /* An identical retry is safe on the server. */
        }
      }
      this.saveStatus = "saved";
    } catch {
      this.saveStatus = "error";
    }
    this.emit();
  }
}
export function useLayoutSettings(s: Facility) {
  useSyncExternalStore(s.subscribe, s.layoutSnapshot, s.layoutSnapshot);
  return s;
}
export function usePhase(s: Facility) {
  return useSyncExternalStore(s.subscribe, s.phaseSnapshot, s.phaseSnapshot);
}
export function useFacility(s: Facility) {
  useSyncExternalStore(s.subscribe, s.snapshot, s.snapshot);
  return s;
}
