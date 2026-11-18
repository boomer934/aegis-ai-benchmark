// Live performance measurement against the RUNNING application (use `npm run start`).
//
//   node scripts/measure-perf.mjs [baseURL] [outFile]
//
// Method: each scene is opened with ?perf=1 (HIGH quality, DPR fixed to 1.5,
// no auto-degrade), warmed up for 3 s, then the in-app PerfProbe ring buffer is
// reset and 10 s of real requestAnimationFrame intervals are sampled. The flight
// scene is measured while the drone is actually flying (W + E held).
// Two browser configurations are reported:
//   - "vsync":   default Chromium (frame rate capped by the display refresh)
//   - "uncapped": --disable-frame-rate-limit --disable-gpu-vsync (GPU headroom)
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const baseURL = process.argv[2] ?? "http://localhost:3000";
const outFile = process.argv[3] ?? "artifacts/perf/perf-results.json";
const gpu =
  process.platform === "win32"
    ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
    : [];
const SAMPLE_MS = 10_000;

async function measure(browser, scene) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`${baseURL}/${scene}?perf=1`, { waitUntil: "load" });
  await page.waitForFunction((n) => document.documentElement.dataset.sceneReady === n, scene, {
    timeout: 90_000,
  });
  if (scene === "flight") {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3300);
    await page.keyboard.down("KeyE");
    await page.waitForTimeout(400);
    await page.keyboard.up("KeyE");
    await page.keyboard.down("KeyW");
  }
  await page.waitForTimeout(3000);
  await page.evaluate((s) => window.__AEGIS_PERF__.reset(s), scene);
  await page.waitForTimeout(SAMPLE_MS);
  const summary = await page.evaluate(() => window.__AEGIS_PERF__.summarize());
  await context.close();
  return { ...summary, pageErrors: errors, failedRequests: failed };
}

const results = {
  measuredAt: new Date().toISOString(),
  baseURL,
  sampleWindowMs: SAMPLE_MS,
  viewport: "1440x900",
  runs: {},
};
for (const [label, args] of [
  ["vsync", gpu],
  ["uncapped", [...gpu, "--disable-frame-rate-limit", "--disable-gpu-vsync"]],
]) {
  const browser = await chromium.launch({ args });
  results.runs[label] = {};
  for (const scene of ["hangar", "flight"]) {
    results.runs[label][scene] = await measure(browser, scene);
    const r = results.runs[label][scene];
    console.log(
      `${label.padEnd(8)} ${scene.padEnd(6)} fps p50 ${r.fpsMedian?.toFixed(1)} p5 ${r.fpsP5?.toFixed(1)} frame p95 ${r.frameMsP95?.toFixed(2)} ms · ${r.drawCalls} calls · ${r.triangles} tris · ${r.renderer}`,
    );
  }
  await browser.close();
}
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(results, null, 2));
console.log(`wrote ${outFile}`);
