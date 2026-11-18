import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { platform, release } from "node:os";
import { chromium } from "playwright";

const base = new URL(process.env.BENCHMARK_URL ?? "http://localhost:3000");
const fixed = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const mobile = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
};
const screenshotDir = "artifacts/screenshots";
const output = "test-results/benchmark-observations.json";
const shots = [
  { file: "01-hangar-hero-desktop.png", query: "hangar&camera=hero" },
  { file: "02-hangar-top-desktop.png", query: "hangar&camera=top" },
  { file: "03-flight-desktop.png", query: "flight&camera=chase" },
  { file: "04-telemetry-desktop.png", query: "telemetry", chart: true },
  { file: "05-hangar-mobile.png", query: "hangar&camera=hero", mobile: true },
];

const hardware = process.env.AEGIS_CHROMIUM_GPU === "1";
const browser = await chromium.launch({
  args: hardware
    ? ["--enable-gpu", ...(platform() === "win32" ? ["--use-angle=d3d11"] : [])]
    : ["--enable-unsafe-swiftshader"],
});
const observations = {
  environment: {
    os: platform() + " " + release(),
    node: process.version,
    chromium: browser.version(),
  },
  captures: [],
  performance: {},
  javascript: {},
  issues: {
    failedRequests: [],
    httpErrors: [],
    externalRequests: [],
    pageErrors: [],
    consoleErrors: [],
  },
};

function observe(page, scene) {
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base.origin) {
      observations.issues.externalRequests.push({ scene, url: request.url() });
    }
  });
  page.on("requestfailed", (request) =>
    observations.issues.failedRequests.push({
      scene,
      url: request.url(),
      reason: request.failure()?.errorText,
    }),
  );
  page.on("response", (response) => {
    if (response.status() >= 400)
      observations.issues.httpErrors.push({
        scene,
        status: response.status(),
        url: response.url(),
      });
  });
  page.on("pageerror", (error) =>
    observations.issues.pageErrors.push({ scene, error: error.message }),
  );
  page.on("console", (message) => {
    if (message.type() === "error")
      observations.issues.consoleErrors.push({ scene, text: message.text() });
  });
}

async function open(page, path, chart = false) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "load" });
  if (!response?.ok()) throw new Error("HTTP " + response?.status() + " at " + path);
  await page.evaluate(() => document.fonts.ready);
  if (chart) {
    await page.locator(".trace-svg").waitFor({ state: "visible" });
  } else {
    const canvas = page.locator("[data-scene-ready=true] canvas");
    await canvas.waitFor({ state: "visible", timeout: 45_000 });
    const dpr = await canvas.evaluate((element) => element.width / element.clientWidth);
    if (Math.abs(dpr - 1.5) > 0.004) throw new Error("Unexpected canvas DPR " + dpr);
  }
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function javascript(page) {
  return page.evaluate(() => {
    const resources = performance
      .getEntriesByType("resource")
      .filter(
        (entry) =>
          new URL(entry.name).origin === location.origin &&
          /\.(js|mjs)$/.test(new URL(entry.name).pathname),
      );
    const distinct = [...new Map(resources.map((entry) => [entry.name, entry])).values()];
    return {
      chunks: distinct.length,
      decodedBytes: distinct.reduce((total, entry) => total + entry.decodedBodySize, 0),
      encodedBytes: distinct.reduce((total, entry) => total + entry.encodedBodySize, 0),
      transferredBytes: distinct.reduce((total, entry) => total + entry.transferSize, 0),
    };
  });
}

async function capture(shot, save = true) {
  const page = await browser.newPage(shot.mobile ? mobile : fixed);
  observe(page, save ? shot.file : "repeat hero");
  try {
    await open(page, "/?benchmark=1&seed=42&scene=" + shot.query, shot.chart);
    if (await page.locator("[data-testid=perf]").count())
      throw new Error("Debug overlay in presentation view");
    const pixels = await page.screenshot({
      path: save ? screenshotDir + "/" + shot.file : undefined,
      animations: "disabled",
      timeout: 30_000,
    });
    if (save) {
      observations.captures.push({
        file: shot.file,
        width: pixels.readUInt32BE(16),
        height: pixels.readUInt32BE(20),
      });
      if (!shot.mobile) observations.javascript[shot.query] = await javascript(page);
      console.log("Captured", shot.file);
    }
    return createHash("sha256").update(pixels).digest("hex");
  } finally {
    await page.close();
  }
}

try {
  await mkdir(screenshotDir, { recursive: true });
  await mkdir("test-results", { recursive: true });
  let heroHash;
  for (const [index, shot] of shots.entries()) {
    const hash = await capture(shot);
    if (index === 0) heroHash = hash;
  }
  observations.heroRepeatIdentical = (await capture(shots[0], false)) === heroHash;
  for (const scene of ["hangar", "flight"]) {
    const page = await browser.newPage(fixed);
    observe(page, scene + " performance");
    try {
      await open(page, "/?perf=1&seed=42&scene=" + scene);
      const renderer = await page.locator(".canvas-stage canvas").evaluate((canvas) => {
        const gl = canvas.getContext("webgl2");
        const debug = gl?.getExtension("WEBGL_debug_renderer_info");
        return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
      });
      await page.locator("[data-stats]").waitFor({ timeout: 35_000 });
      if (scene === "flight") {
        await page.getByRole("button", { name: "Start 60s trial" }).click();
        await page.locator('[data-testid="flight-status"][data-phase="active"]').waitFor();
      }
      // Give the end of the rolling window a settled hangar or active hover.
      await page.waitForTimeout(12_000);
      const raw = await page.locator("[data-stats]").getAttribute("data-stats");
      if (!raw) throw new Error("Perf panel did not report samples");
      const stats = JSON.parse(raw);
      if (stats.dpr !== 1.5) throw new Error("Perf DPR was " + stats.dpr);
      observations.performance[scene] = {
        renderer,
        scenario: scene === "hangar" ? "Hero, manual inspection" : "Running trial, neutral input",
        ...stats,
      };
      console.log("Measured", scene, JSON.stringify(observations.performance[scene]));
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(output, JSON.stringify(observations, null, 2) + "\n");
  console.log("Observed metrics written to", output);
}
if (Object.values(observations.issues).some((issues) => issues.length)) process.exitCode = 1;
