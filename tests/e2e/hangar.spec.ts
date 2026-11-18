import { expect, test } from "@playwright/test";
import { freshStorage, trackErrors, waitForScene } from "./helpers";

test.describe("hangar customization", () => {
  test.beforeEach(async ({ page }) => {
    await freshStorage(page);
  });

  test("paint, engine, lights, camera and inspection controls update state", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/hangar");
    await waitForScene(page, "hangar");

    const paint = page.getByTestId("paint-selector");
    await paint.locator('[data-value="arctic"]').click();
    await expect(paint.locator('[data-value="arctic"]')).toHaveAttribute("aria-checked", "true");
    await expect(paint.locator('[data-value="graphite"]')).toHaveAttribute("aria-checked", "false");

    const engine = page.getByTestId("engine-selector");
    await engine.locator('[data-value="RACE"]').click();
    await expect(engine.locator('[data-value="RACE"]')).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("engine-stats")).toContainText("23 m/s");
    await engine.locator('[data-value="ECO"]').click();
    await expect(page.getByTestId("engine-stats")).toContainText("12 m/s");

    const lights = page.getByTestId("lights-toggle");
    await expect(lights).toHaveAttribute("aria-checked", "true");
    await lights.click();
    await expect(lights).toHaveAttribute("aria-checked", "false");

    const camera = page.getByTestId("camera-selector");
    await camera.locator('[data-value="top"]').click();
    await expect(camera.locator('[data-value="top"]')).toHaveAttribute("aria-checked", "true");
    await camera.locator('[data-value="side"]').click();
    await expect(camera.locator('[data-value="side"]')).toHaveAttribute("aria-checked", "true");

    const inspect = page.getByTestId("inspection-toggle");
    await inspect.click();
    await expect(inspect).toHaveAttribute("aria-pressed", "true");
    const panel = page.getByTestId("inspection-panel").first();
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/Propulsion/);
    await expect
      .poll(async () => (await panel.textContent())?.match(/(\d+)%/)?.[1] ?? "0")
      .not.toBe("0");
    await inspect.click();
    await expect(inspect).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("inspection-panel")).toHaveCount(0);
    expect(errors()).toEqual([]);
  });

  test("configuration persists across modules and reloads", async ({ page }) => {
    await page.goto("/hangar");
    await page.getByTestId("paint-selector").locator('[data-value="vanta"]').click();
    await page.getByTestId("engine-selector").locator('[data-value="RACE"]').click();
    await page.getByTestId("lights-toggle").click();

    await page.getByTestId("nav-control").click();
    await expect(page.getByTestId("config-summary")).toHaveText("Vanta Strike · RACE · lights off");

    await page.getByTestId("nav-flight").click();
    await waitForScene(page, "flight");
    await expect(page.getByTestId("telemetry-cluster")).toContainText("RACE");

    await page.reload();
    await page.getByTestId("nav-hangar").click();
    await expect(
      page.getByTestId("paint-selector").locator('[data-value="vanta"]'),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByTestId("engine-selector").locator('[data-value="RACE"]'),
    ).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("lights-toggle")).toHaveAttribute("aria-checked", "false");
  });

  test("controls are keyboard accessible with visible focus", async ({ page }) => {
    await page.goto("/hangar");
    const race = page.getByTestId("engine-selector").locator('[data-value="SPORT"]');
    await race.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByTestId("engine-selector").locator('[data-value="RACE"]'),
    ).toHaveAttribute("aria-checked", "true");
    const lights = page.getByTestId("lights-toggle");
    await lights.focus();
    const outline = await lights.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(lights).toHaveAttribute("aria-checked", "false");
  });
});
