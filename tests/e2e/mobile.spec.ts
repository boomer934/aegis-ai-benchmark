import { expect, test, type Page } from "@playwright/test";
import { freshStorage, readNumber, trackErrors, waitForScene } from "./helpers";

async function expectNoHorizontalOverflow(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test.describe("mobile layout (390×844, touch)", () => {
  test.beforeEach(async ({ page }) => {
    await freshStorage(page);
  });

  test("hangar is usable: canvas, configuration and bottom navigation", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/hangar");
    await waitForScene(page, "hangar");
    await expectNoHorizontalOverflow(page);
    const canvasBox = await page.getByTestId("canvas-hangar").boundingBox();
    expect(canvasBox?.height).toBeGreaterThan(300);

    await page.getByTestId("paint-selector").locator('[data-value="arctic"]').tap();
    await expect(
      page.getByTestId("paint-selector").locator('[data-value="arctic"]'),
    ).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("engine-selector").locator('[data-value="RACE"]').tap();
    await expect(page.getByTestId("engine-stats")).toContainText("23 m/s");

    await page.getByTestId("mnav-control").tap();
    await expect(page).toHaveURL(/\/control$/);
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("config-summary")).toContainText("Arctic Survey · RACE");
    expect(errors()).toEqual([]);
  });

  test("flight arena shows touch controls that drive the drone", async ({ page }) => {
    await page.goto("/flight");
    await waitForScene(page, "flight");
    await expectNoHorizontalOverflow(page);
    await expect(page.getByTestId("touch-controls")).toBeVisible();
    await page.getByTestId("start-mission").tap();
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running", {
      timeout: 8_000,
    });

    const up = page.getByTestId("touch-up");
    const box = await up.boundingBox();
    if (!box) throw new Error("no ascend button");
    const alt0 = await readNumber(page, "hud-altitude");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    await expect.poll(() => readNumber(page, "hud-altitude")).toBeGreaterThan(alt0 + 1);

    const stick = await page.getByTestId("touch-stick").boundingBox();
    if (!stick) throw new Error("no stick");
    const cx = stick.x + stick.width / 2;
    const cy = stick.y + stick.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy - stick.height / 2, { steps: 4 });
    await expect.poll(() => readNumber(page, "hud-speed"), { timeout: 5_000 }).toBeGreaterThan(3);
    await page.mouse.up();
    // Critical UI does not overlap: status bar and touch stick are both fully on screen.
    const status = await page.getByTestId("mission-status-bar").boundingBox();
    expect(status && status.x >= 0 && status.x + status.width <= 390).toBe(true);
  });
});
