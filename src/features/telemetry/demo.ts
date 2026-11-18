import { GATES, Simulation, score, type Profile } from "@/features/flight/simulation";
import { readSample, type Sample } from "@/stores/facility";
import type { RecordRow } from "@/lib/results";
/** Capture a deterministic reference circuit with the same integrator used by the pilot. */
export function referenceFlight(profile: Profile) {
  const sim = new Simulation(),
    f = sim.state;
  const samples: Sample[] = [readSample(f)];
  f.phase = "running";
  for (let i = 1; i <= 7200 && sim.state.phase === "running"; i++) {
    const gate = GATES[f.gates];
    const steer = (error: number, velocity: number) =>
      Math.max(-1, Math.min(1, error * 0.9 - velocity * 0.47));
    const aligned = Math.hypot(f.position.x - gate.x, f.position.y - gate.y) < 1.4;
    const zAim = aligned ? gate.z - 2.8 : gate.z + 2.6;
    sim.advance(
      1 / 120,
      {
        x: steer(gate.x - f.position.x, f.velocity.x),
        y: steer(gate.y - f.position.y, f.velocity.y),
        z: steer(zAim - f.position.z, f.velocity.z),
        boost: false,
      },
      profile,
    );
    if (i % 24 === 0 || sim.state.phase !== "running") samples.push(readSample(f));
  }
  const durationMs = Math.round(f.elapsed * 1000);
  const row: RecordRow = {
    id: "reference-" + profile,
    createdAt: "2026-01-01T12:00:00Z",
    profile,
    paint: "Signal",
    durationMs,
    gates: f.gates,
    collisions: f.collisions,
    score: score(f.gates, f.collisions, durationMs),
    outcome: f.gates === 5 ? "success" : "timeout",
  };
  return { row, samples, f };
}
