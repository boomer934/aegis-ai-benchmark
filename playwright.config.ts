import { defineConfig, devices } from "@playwright/test";

// Give each worktree its own port when several benchmark environments run on
// the same machine, e.g. PLAYWRIGHT_PORT=3101 npm run test:e2e
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;
// E2E runs against its own SQLite file so it never touches the dev database.
const e2eDatabaseUrl = "file:./prisma/e2e.db";

// On Windows, headless Chromium can use the real GPU through ANGLE/D3D11;
// elsewhere it falls back to SwiftShader (slower, still correct).
const gpuArgs =
  process.platform === "win32"
    ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"]
    : [];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: { args: gpuArgs },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx prisma migrate deploy && npm run dev -- --port ${port}`,
    url: baseURL,
    env: { DATABASE_URL: e2eDatabaseUrl, NEXT_TELEMETRY_DISABLED: "1" },
    // Never attach to a server that is already running: on a shared machine it
    // could belong to another benchmark worktree.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
