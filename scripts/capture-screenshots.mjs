// Capture the deterministic benchmark screenshots from the RUNNING application.
//
//   node scripts/capture-screenshots.mjs [baseURL] [outDir]
//
// Defaults: http://localhost:3000  artifacts/screenshots
// Every view uses ?benchmark=1&seed=42, waits for the scene to report that it
// has rendered real frames (html[data-scene-ready]) and then captures.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const baseURL = process.argv[2] ?? process.env.AEGIS_URL ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "artifacts/screenshots";
mkdirSync(outDir, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const shots = [
  {
    file: "01-hangar-hero-desktop.png",
    path: "/?benchmark=1&seed=42&scene=hangar&camera=hero",
    viewport: DESKTOP,
    ready: "hangar",
  },
  {
    file: "02-hangar-top-desktop.png",
    path: "/?benchmark=1&seed=42&scene=hangar&camera=top",
    viewport: DESKTOP,
    ready: "hangar",
  },
  {
    file: "03-flight-desktop.png",
    path: "/?benchmark=1&seed=42&scene=flight&camera=chase",
    viewport: DESKTOP,
    ready: "flight",
  },
  {
    file: "04-telemetry-desktop.png",
    path: "/?benchmark=1&seed=42&scene=telemetry",
    viewport: DESKTOP,
    ready: "telemetry",
  },
  {
    file: "05-hangar-mobile.png",
    path: "/?benchmark=1&seed=42&scene=hangar&camera=hero",
    viewport: MOBILE,
    ready: "hangar",
    mobile: true,
  },
];

const browser = await chromium.launch({
  // GPU-backed ANGLE where available; falls back to SwiftShader otherwise.
  args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const errors = [];
for (const s of shots) {
  const context = await browser.newContext({
    viewport: s.viewport,
    deviceScaleFactor: 1,
    isMobile: Boolean(s.mobile),
    hasTouch: Boolean(s.mobile),
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${s.file}: ${e.message}`));
  await page.goto(baseURL + s.path, { waitUntil: "networkidle" });
  await page.waitForFunction(
    (name) => document.documentElement.dataset.sceneReady === name,
    s.ready,
    { timeout: 90_000 },
  );
  // Let late layout (fonts, data) settle; scene time is frozen in benchmark mode.
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(outDir, s.file) });
  console.log(`captured ${s.file}`);
  await context.close();
}
await browser.close();
if (errors.length) {
  console.error("Page errors during capture:\n" + errors.join("\n"));
  process.exitCode = 1;
}
