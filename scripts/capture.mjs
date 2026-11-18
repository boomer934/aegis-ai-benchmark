import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const base = process.env.AEGIS_BASE_URL ?? "http://127.0.0.1:3101";
const folder = path.resolve("artifacts/screenshots");
await fs.mkdir(folder, { recursive: true });
const browser = await chromium.launch({
  args:
    process.platform === "win32"
      ? ["--enable-gpu", "--use-angle=d3d11"]
      : ["--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const errors = [],
  failures = [],
  responses = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("requestfailed", (r) => failures.push({ url: r.url(), error: r.failure()?.errorText }));
page.on("response", (r) => {
  if (r.status() >= 400) responses.push({ url: r.url(), status: r.status() });
});
try {
  for (const [file, scene, camera] of [
    ["01-hangar-hero-desktop", "hangar", "hero"],
    ["02-hangar-top-desktop", "hangar", "top"],
    ["03-flight-desktop", "flight", "chase"],
    ["04-telemetry-desktop", "telemetry", "hero"],
    ["05-hangar-mobile", "hangar", "hero"],
  ]) {
    if (file.endsWith("mobile")) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/?benchmark=1&seed=42&scene=" + scene + "&camera=" + camera, {
      waitUntil: "networkidle",
    });
    if (scene !== "telemetry")
      await page.locator('[data-rendered="yes"]').waitFor({ timeout: 45000 });
    else await page.getByText("Deterministic demo data").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(folder, file + ".png"), animations: "disabled" });
    console.log(file);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(base + "/?perf=1&scene=hangar&camera=hero", { waitUntil: "networkidle" });
  await page.locator('[data-perf]:not([data-perf=""])').waitFor({ timeout: 45000 });
  await page.waitForTimeout(2500);
  const runtime = await page.evaluate(async () => {
    const frames = [],
      draws = [],
      triangles = [];
    let last;
    await new Promise((resolve) => {
      function sample(t) {
        if (last !== undefined) frames.push(t - last);
        last = t;
        const raw = document.querySelector("[data-perf]")?.getAttribute("data-perf");
        if (raw) {
          const p = JSON.parse(raw);
          draws.push(p.draws);
          triangles.push(p.triangles);
        }
        if (frames.length < 300) requestAnimationFrame(sample);
        else resolve();
      }
      requestAnimationFrame(sample);
    });
    function quantile(values, fraction) {
      return values.sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
    }
    const scripts = performance
      .getEntriesByType("resource")
      .filter((r) => new URL(r.name).pathname.endsWith(".js"));
    const gpu = document.querySelector("canvas").getContext("webgl2");
    const ext = gpu.getExtension("WEBGL_debug_renderer_info");
    return {
      fpsMedian: quantile(
        frames.map((ms) => 1000 / ms),
        0.5,
      ),
      fpsP05: quantile(
        frames.map((ms) => 1000 / ms),
        0.05,
      ),
      frameTimeP95Ms: quantile(frames, 0.95),
      medianDrawCalls: quantile(draws, 0.5),
      medianTriangles: quantile(triangles, 0.5),
      frames: frames.length,
      renderer: ext
        ? gpu.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gpu.getParameter(gpu.RENDERER),
      quality: "HIGH",
      dpr: JSON.parse(document.querySelector("[data-perf]").dataset.perf).dpr,
      jsResources: scripts.length,
      jsDecodedBytes: scripts.reduce((s, r) => s + r.decodedBodySize, 0),
      jsEncodedBytes: scripts.reduce((s, r) => s + r.encodedBodySize, 0),
    };
  });
  const evidence = {
    browser: browser.version(),
    runtime,
    failedNetworkRequests: failures,
    uncaughtBrowserErrors: errors,
    httpErrors: responses,
  };
  await fs.writeFile("artifacts/runtime.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
  if (failures.length || errors.length || responses.length) process.exitCode = 1;
} finally {
  await browser.close();
}
