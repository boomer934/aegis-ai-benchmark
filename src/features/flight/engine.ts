import {
  advanceFlight,
  freshFlight,
  LIMIT,
  NEUTRAL,
  snapshot,
  STEP,
  type Configuration,
  type FlightInput,
  type FlightState,
  type Phase,
  type Sample,
} from "./physics";
import { makeResult } from "../telemetry/record";
import type { ResultInput } from "../telemetry/validation";

export type FlightSnapshot = FlightState & { samples: Sample[]; result: ResultInput | null };
const EMPTY: FlightSnapshot = { ...freshFlight(), samples: [], result: null };
const controls = {
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyQ: "down",
  KeyE: "up",
  ShiftLeft: "boost",
  ShiftRight: "boost",
} as const;
export type Control = (typeof controls)[keyof typeof controls];

export class FlightEngine {
  state = freshFlight();
  tickCount = 0;
  private accumulator = 0;
  private listeners = new Set<() => void>();
  private output = EMPTY;
  private samples: Sample[] = [];
  private result: ResultInput | null = null;
  private config: Configuration | null = null;
  private id: string | null = null;
  private pressed = new Map<string, Control>();

  constructor(private onFinish: (result: ResultInput) => void) {}

  subscribe = (notify: () => void) => {
    this.listeners.add(notify);
    return () => this.listeners.delete(notify);
  };
  getSnapshot = () => this.output;
  getServerSnapshot = () => EMPTY;
  getConfiguration = () => this.config;
  private getPhase = (): Phase => this.state.phase;

  private publish() {
    this.output = {
      ...this.state,
      velocity: [...this.state.velocity],
      samples: this.samples,
      result: this.result,
    };
    for (const notify of this.listeners) notify();
  }

  start(config: Configuration) {
    this.reset(false);
    this.config = { ...config };
    this.id = crypto.randomUUID();
    this.state.phase = "countdown";
    this.samples = [snapshot(this.state)];
    this.publish();
  }

  reset(publish = true) {
    this.state = freshFlight();
    this.accumulator = 0;
    this.tickCount = 0;
    this.samples = [];
    this.result = null;
    this.config = null;
    this.id = null;
    this.clearControls();
    if (publish) this.publish();
  }

  togglePause() {
    if (this.state.phase !== "active" && this.state.phase !== "paused") return;
    this.state.phase = this.state.phase === "active" ? "paused" : "active";
    this.clearControls();
    this.publish();
  }

  clearControls = () => this.pressed.clear();

  setTouch(source: string, control: Control, pressed: boolean) {
    if (pressed) this.pressed.set(source, control);
    else this.pressed.delete(source);
  }

  setKey(code: string, pressed: boolean) {
    if (!Object.hasOwn(controls, code)) return false;
    this.setTouch(code, controls[code as keyof typeof controls], pressed);
    return true;
  }

  private input(): FlightInput {
    if (this.pressed.size === 0) return NEUTRAL;
    const held = new Set(this.pressed.values());
    return {
      x: Number(held.has("right")) - Number(held.has("left")),
      y: Number(held.has("up")) - Number(held.has("down")),
      z: Number(held.has("back")) - Number(held.has("forward")),
      boost: held.has("boost"),
    };
  }

  frame(delta: number) {
    if (
      !this.config ||
      !this.id ||
      (this.state.phase !== "active" && this.state.phase !== "countdown")
    )
      return;
    const prev = this.state.phase;
    const checkpoint = this.state.checkpoints;
    const collision = this.state.collisions;
    const previousCount = Math.ceil(this.state.countdown);
    const previousBucket = Math.floor(this.tickCount / 12);
    const input = this.input();
    this.accumulator += Math.min(delta, 0.25);
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.tickCount++;
      advanceFlight(this.state, input, this.config.profile);
      const phase = this.getPhase();
      if (phase === "success" || phase === "timeout") break;
    }
    const current = this.getPhase();
    if (current === "active" && this.state.elapsed >= (this.samples.at(-1)?.time ?? 0) + 0.495) {
      this.samples = [...this.samples, snapshot(this.state)];
    }
    if (current === "success" || current === "timeout") {
      const last = snapshot(this.state);
      this.samples = [...this.samples.filter((sample) => sample.time < last.time), last];
      this.result = makeResult(this.id, this.config, this.state, this.samples);
      this.onFinish(this.result);
    }
    if (
      prev !== current ||
      collision !== this.state.collisions ||
      checkpoint !== this.state.checkpoints ||
      (current === "active" && previousBucket !== Math.floor(this.tickCount / 12)) ||
      Math.ceil(this.state.countdown) !== previousCount ||
      this.state.elapsed === LIMIT
    )
      this.publish();
  }
}
