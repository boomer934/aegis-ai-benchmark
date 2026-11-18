import { expect, type Page } from "@playwright/test";
import { createCourseAutopilot } from "../../src/sim/autopilot";
import { createWorld, startMission, stepWorld } from "../../src/sim/mission";
import { NEUTRAL_INPUT } from "../../src/sim/physics";
import type { EngineId } from "../../src/sim/profiles";

/** Collects uncaught page errors and console errors for a test. */
export function trackErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Expected 4xx responses from deliberate invalid-API tests are not app errors.
    if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return;
    errors.push(`console.error: ${text}`);
  });
  return () => errors;
}

export async function waitForScene(
  page: Page,
  name: "hangar" | "flight" | "telemetry",
): Promise<void> {
  await page.waitForFunction((n) => document.documentElement.dataset.sceneReady === n, name, {
    timeout: 60_000,
  });
}

export async function readNumber(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).textContent()) ?? "";
  return Number.parseFloat(text.replace(/[^0-9.-]/g, ""));
}

/** Clear persisted config so each test starts from defaults. */
export async function freshStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("aegis-test-init")) {
      localStorage.clear();
      sessionStorage.setItem("aegis-test-init", "1");
    }
  });
}

/**
 * A genuine mission result produced by flying the shared simulation with the
 * scripted autopilot (ordinary stick inputs) — the same code the browser runs.
 */
export function flownSubmission(engine: EngineId, callsign: string) {
  const w = createWorld(engine);
  startMission(w);
  while (w.mission.status === "countdown") stepWorld(w, NEUTRAL_INPUT);
  const pilot = createCourseAutopilot(w);
  while (w.mission.status === "running") stepWorld(w, pilot.input(w));
  const r = w.mission.result;
  expect(r).not.toBeNull();
  if (!r) throw new Error("no result");
  return {
    callsign,
    outcome: r.outcome,
    engine: r.engine,
    paint: "graphite" as const,
    durationMs: r.durationMs,
    score: r.score,
    checkpoints: r.checkpoints,
    collisions: r.collisions,
    maxSpeed: r.maxSpeed,
    avgSpeed: r.avgSpeed,
    energyUsed: r.energyUsed,
    splitsMs: r.splitsMs,
    telemetry: r.telemetry,
    clientBuild: "e2e",
  };
}
