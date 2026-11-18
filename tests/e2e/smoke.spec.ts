import { expect, test } from "@playwright/test";
import { freshStorage, trackErrors, waitForScene } from "./helpers";

test.describe("application shell", () => {
  test("root redirects to the hangar and renders the 3D scene without errors", async ({ page }) => {
    const errors = trackErrors(page);
    await freshStorage(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/hangar$/);
    await waitForScene(page, "hangar");
    await expect(page.getByTestId("canvas-hangar").locator("canvas")).toBeVisible();
    await expect(page.getByRole("heading", { name: /AX-7 Kestrel/i })).toBeVisible();
    expect(errors()).toEqual([]);
  });

  test("navigation between modules updates the URL and active state", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/hangar");
    await expect(page.getByTestId("nav-hangar")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("nav-flight").click();
    await expect(page).toHaveURL(/\/flight$/);
    await expect(page.getByTestId("nav-flight")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-hangar")).not.toHaveAttribute("aria-current", "page");
    await waitForScene(page, "flight");
    await expect(page.getByTestId("mission-status")).toHaveText(/ready/i);

    await page.getByTestId("nav-control").click();
    await expect(page).toHaveURL(/\/control$/);
    await expect(page.getByRole("heading", { name: /mission control/i })).toBeVisible();
    await expect(page.getByTestId("nav-control")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("nav-hangar").click();
    await expect(page).toHaveURL(/\/hangar$/);
    expect(errors()).toEqual([]);
  });

  test("benchmark URLs route to deterministic views without debug panels", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/?benchmark=1&seed=42&scene=flight&camera=chase");
    await expect(page).toHaveURL(/\/flight\?/);
    await waitForScene(page, "flight");
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running");
    await expect(page.getByTestId("mission-gates")).toHaveAttribute("data-value", "1");
    await expect(page.getByTestId("perf-panel")).toHaveCount(0);
    // Staged state is frozen: timer does not move.
    const t1 = await page.getByTestId("mission-timer").textContent();
    await page.waitForTimeout(700);
    expect(await page.getByTestId("mission-timer").textContent()).toBe(t1);

    await page.goto("/?benchmark=1&seed=42&scene=telemetry");
    await waitForScene(page, "telemetry");
    await expect(page.getByTestId("demo-badge").first()).toBeVisible();
    await expect(page.getByTestId("history-row").first()).toBeVisible();
    expect(errors()).toEqual([]);
  });

  test("perf mode shows live renderer statistics from real frames", async ({ page }) => {
    await page.goto("/hangar?perf=1");
    await waitForScene(page, "hangar");
    await expect(page.getByTestId("perf-panel")).toBeVisible();
    await expect
      .poll(async () => Number(await page.getByTestId("perf-calls").textContent()))
      .toBeGreaterThan(20);
    const summary = await page.evaluate(() => window.__AEGIS_PERF__?.summarize());
    // window.__AEGIS_PERF__ is declared in src/components/three/SceneCanvas.tsx
    expect(summary?.samples).toBeGreaterThan(5);
    expect(summary?.dpr).toBe(1.5);
    expect(summary?.quality).toBe("HIGH");
  });
});
