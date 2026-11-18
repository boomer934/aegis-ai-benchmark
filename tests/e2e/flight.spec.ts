import { expect, test, type Page } from "@playwright/test";
import { freshStorage, readNumber, trackErrors, waitForScene } from "./helpers";

async function startMission(page: Page) {
  await page.goto("/flight");
  await waitForScene(page, "flight");
  await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "ready");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "countdown");
  await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running", {
    timeout: 8_000,
  });
}

async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test.describe("flight simulator", () => {
  test.beforeEach(async ({ page }) => {
    await freshStorage(page);
  });

  test("keyboard controls move the simulated drone", async ({ page }) => {
    const errors = trackErrors(page);
    await startMission(page);
    expect(await readNumber(page, "hud-speed")).toBeLessThan(0.5);

    await page.keyboard.down("KeyW");
    await expect.poll(() => readNumber(page, "hud-speed"), { timeout: 5_000 }).toBeGreaterThan(4);
    await page.keyboard.up("KeyW");

    const alt0 = await readNumber(page, "hud-altitude");
    await holdKey(page, "KeyE", 900);
    await expect.poll(() => readNumber(page, "hud-altitude")).toBeGreaterThan(alt0 + 1.5);

    // Speed decays after releasing the stick (drag / braking).
    await page.waitForTimeout(2000);
    expect(await readNumber(page, "hud-speed")).toBeLessThan(3);
    expect(errors()).toEqual([]);
  });

  test("space pauses and resumes; R resets the flight", async ({ page }) => {
    await startMission(page);
    await holdKey(page, "KeyW", 400);
    await page.keyboard.press("Space");
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "paused");
    await expect(page.getByTestId("paused-overlay")).toBeVisible();
    const frozenTimer = await page.getByTestId("mission-timer").textContent();
    await holdKey(page, "KeyW", 700);
    expect(await page.getByTestId("mission-timer").textContent()).toBe(frozenTimer);

    await page.keyboard.press("Space");
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running");
    await expect
      .poll(async () => page.getByTestId("mission-timer").textContent())
      .not.toBe(frozenTimer);

    await page.keyboard.press("KeyR");
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "ready");
    await expect(page.getByTestId("mission-timer")).toHaveText("01:00.00");
    await expect(page.getByTestId("mission-score")).toHaveText("0");
  });

  test("on-screen buttons start, pause and reset (UI cannot score gates)", async ({ page }) => {
    await page.goto("/flight");
    await waitForScene(page, "flight");
    await page.getByTestId("start-mission").click();
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running", {
      timeout: 8_000,
    });
    await page.getByTestId("pause-button").click();
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "paused");
    await page.getByTestId("pause-button").click();
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running");
    await expect(page.getByTestId("mission-gates")).toHaveAttribute("data-value", "0");
    await page.getByTestId("reset-button").click();
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "ready");
  });

  test("flying through gate 1 scores a checkpoint; hitting an obstacle costs a penalty", async ({
    page,
  }) => {
    await startMission(page);
    // Climb to the gate's height band (gate 1 centre: 4 m, opening ±2.6 m).
    await page.keyboard.down("KeyE");
    await expect
      .poll(() => readNumber(page, "hud-altitude"), { intervals: [50] })
      .toBeGreaterThan(2.6);
    await page.keyboard.up("KeyE");
    // Straight ahead: gate 1 is 26 m down-range, then a low block sits on the same line.
    await page.keyboard.down("KeyW");
    await expect(page.getByTestId("mission-gates")).toHaveAttribute("data-value", "1", {
      timeout: 6_000,
    });
    await expect(page.getByTestId("mission-score")).toHaveText("1,000");
    await expect
      .poll(() => readNumber(page, "mission-collisions"), { timeout: 12_000 })
      .toBeGreaterThanOrEqual(1);
    await page.keyboard.up("KeyW");
    const hits = await readNumber(page, "mission-collisions");
    await expect(page.getByTestId("mission-score")).toHaveText(
      Math.max(0, 1000 - 250 * hits).toLocaleString("en-US"),
    );
  });

  test("engine profile changes real flight performance", async ({ page }) => {
    const topSpeedWith = async (engine: "ECO" | "RACE") => {
      await page.goto("/hangar");
      await page.getByTestId("engine-selector").locator(`[data-value="${engine}"]`).click();
      await page.getByTestId("nav-flight").click();
      await waitForScene(page, "flight");
      await page.keyboard.press("KeyR");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "running", {
        timeout: 8_000,
      });
      await page.keyboard.down("KeyE");
      await page.waitForTimeout(500);
      await page.keyboard.up("KeyE");
      await page.keyboard.down("KeyW");
      let max = 0;
      for (let i = 0; i < 14; i++) {
        await page.waitForTimeout(200);
        max = Math.max(max, await readNumber(page, "hud-speed"));
      }
      await page.keyboard.up("KeyW");
      await page.keyboard.press("KeyR");
      return max;
    };
    const eco = await topSpeedWith("ECO");
    const race = await topSpeedWith("RACE");
    expect(eco).toBeLessThanOrEqual(12.6);
    expect(race).toBeGreaterThan(eco + 4);
  });
});
