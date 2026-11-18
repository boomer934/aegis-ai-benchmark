import type { MissionDetail } from "@/domain/mission";
import { createCourseAutopilot } from "@/sim/autopilot";
import { createWorld, startMission, stepWorld } from "@/sim/mission";
import { NEUTRAL_INPUT } from "@/sim/physics";
import type { EngineId } from "@/sim/profiles";
import { createRng, deriveSeed } from "@/sim/rng";

/**
 * Deterministic DEMO data for benchmark screenshots. Every record is produced
 * by actually flying the simulation with the scripted autopilot (or letting a
 * hovering drone time out), so the numbers obey the real flight model.
 * The UI always labels these as demo data.
 */
function fly(engine: EngineId, cruise: number, timeout: boolean): MissionDetail {
  const w = createWorld(engine);
  startMission(w);
  while (w.mission.status === "countdown") stepWorld(w, NEUTRAL_INPUT);
  const pilot = createCourseAutopilot(w, cruise);
  let gatesBeforeHover = 0;
  while (w.mission.status === "running") {
    const stop = timeout && w.mission.nextGate >= 3;
    if (stop && !gatesBeforeHover) gatesBeforeHover = w.mission.nextGate;
    stepWorld(w, stop ? NEUTRAL_INPUT : pilot.input(w));
  }
  const r = w.mission.result;
  if (!r) throw new Error("demo flight produced no result");
  return {
    id: "",
    createdAt: "",
    callsign: "",
    outcome: r.outcome,
    engine: r.engine,
    paint: "graphite",
    durationMs: r.durationMs,
    score: r.score,
    checkpoints: r.checkpoints,
    collisions: r.collisions,
    maxSpeed: r.maxSpeed,
    avgSpeed: r.avgSpeed,
    energyUsed: r.energyUsed,
    telemetry: r.telemetry,
    splitsMs: r.splitsMs,
  };
}

let cache: { seed: number; missions: MissionDetail[] } | null = null;

export function demoMissions(seed: number): MissionDetail[] {
  if (cache?.seed === seed) return cache.missions;
  const rng = createRng(deriveSeed(seed, "demo-missions"));
  const plan: { engine: EngineId; cruise: number; timeout: boolean; callsign: string; paint: MissionDetail["paint"] }[] = [
    { engine: "RACE", cruise: 0.9, timeout: false, callsign: "DEMO-VIPER", paint: "vanta" },
    { engine: "SPORT", cruise: 0.95, timeout: false, callsign: "DEMO-KESTREL", paint: "graphite" },
    { engine: "ECO", cruise: 1, timeout: false, callsign: "DEMO-ARCTIC", paint: "arctic" },
    { engine: "SPORT", cruise: 0.7, timeout: true, callsign: "DEMO-ROOKIE", paint: "graphite" },
    { engine: "RACE", cruise: 0.75, timeout: false, callsign: "DEMO-FALCON", paint: "arctic" },
    { engine: "ECO", cruise: 0.8, timeout: false, callsign: "DEMO-HERON", paint: "vanta" },
  ];
  const base = Date.UTC(2026, 10, 18, 9, 0, 0);
  const missions = plan.map((p, i) => ({
    ...fly(p.engine, p.cruise, p.timeout),
    id: `demo${String(i + 1).padStart(4, "0")}`,
    callsign: p.callsign,
    paint: p.paint,
    createdAt: new Date(base - i * 3_600_000 - Math.floor(rng() * 1_800_000)).toISOString(),
  }));
  cache = { seed, missions };
  return missions;
}
