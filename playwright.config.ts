import { defineConfig, devices } from "@playwright/test";

// Give each worktree its own port when several benchmark environments run on
// the same machine, e.g. PLAYWRIGHT_PORT=3101 npm run test:e2e
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    // Never attach to a server that is already running: on a shared machine it
    // could belong to another benchmark worktree.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
