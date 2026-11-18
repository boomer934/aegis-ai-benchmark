/** Simulation runs at a fixed 120 Hz regardless of display refresh rate. */
export const SIM_DT = 1 / 120;
/** Longest frame we will catch up on; avoids a spiral of death after a tab stall. */
export const MAX_FRAME_DT = 0.1;

/**
 * Fixed-timestep accumulator. `advance` converts a variable frame delta into a
 * whole number of deterministic `SIM_DT` steps and returns the interpolation
 * factor for rendering between the previous and current step.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    readonly dt: number = SIM_DT,
    readonly maxFrame: number = MAX_FRAME_DT,
  ) {}

  advance(frameDt: number, step: (dt: number) => void): { steps: number; alpha: number } {
    if (!Number.isFinite(frameDt) || frameDt < 0) frameDt = 0;
    this.accumulator += Math.min(frameDt, this.maxFrame);
    let steps = 0;
    // Small epsilon guards against float drift leaving 0.9999 of a step behind.
    while (this.accumulator + 1e-9 >= this.dt) {
      step(this.dt);
      this.accumulator -= this.dt;
      steps++;
    }
    if (this.accumulator < 0) this.accumulator = 0;
    return { steps, alpha: this.accumulator / this.dt };
  }

  reset(): void {
    this.accumulator = 0;
  }
}
