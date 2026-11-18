import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { GATES } from "../../src/features/flight/simulation";
const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  issues.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("Failed to load resource"))
      errors.push(m.text());
  });
});
test.afterEach(async ({ page }) => expect(issues.get(page)).toEqual([]));
const ready = (page: Page) => expect(page.locator('[data-rendered="yes"]')).toBeVisible();
test("hangar configurations, orbit presets, inspection and graphics survive module navigation", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: "Glacier", exact: true }).click();
  await page.getByRole("button", { name: "RACE", exact: true }).click();
  await page.getByRole("switch", { name: "Navigation lights" }).click();
  await page.getByRole("button", { name: "Side", exact: true }).click();
  await page.getByRole("button", { name: "Inspect", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop inspection" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Stop inspection" }).click();
  await page.getByRole("button", { name: "Graphics settings" }).click();
  await page.getByRole("button", { name: "LOW", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Enter flight arena" }).click();
  await ready(page);
  await expect(page.locator(".mission-readout")).toContainText("RACE");
  await page.getByRole("button", { name: "Mission control", exact: true }).click();
  await expect(page.locator(".mission-readout")).toContainText("Glacier / RACE");
  await page.getByRole("button", { name: "Hangar", exact: true }).click();
  await ready(page);
  await expect(page.getByRole("button", { name: "Glacier", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("switch")).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Side", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("keyboard flight changes altitude and velocity; pause freezes flight, reset restores the pad", async ({
  page,
}) => {
  await page.goto("/?scene=flight");
  await ready(page);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page.getByTestId("phase")).toHaveText("running");
  await page.keyboard.down("e");
  await page.keyboard.down("Shift");
  await expect
    .poll(async () => parseFloat(await page.getByTestId("altitude").innerText()))
    .toBeGreaterThan(3.5);
  await page.keyboard.up("Shift");
  await page.keyboard.up("e");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("phase")).toHaveText("paused");
  const h = await page.getByTestId("altitude").innerText();
  await page.waitForTimeout(250);
  expect(await page.getByTestId("altitude").innerText()).toBe(h);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("phase")).toHaveText("running");
  await page.keyboard.press("r");
  await expect(page.getByTestId("phase")).toHaveText("standby");
  await expect(page.getByTestId("altitude")).toHaveText("3.0 m");
  await expect(page.getByTestId("velocity")).toHaveText("0.0 m/s");
});
test("fly a complete circuit using only keyboard inputs, archive result, inspect live trace and replay", async ({
  page,
}) => {
  test.setTimeout(85000);
  await page.goto("/?scene=flight");
  await ready(page);
  await page.getByRole("button", { name: "Start challenge" }).click();
  await expect(page.getByTestId("phase")).toHaveText("running");
  // A closed-loop test pilot reads the visible HUD's instrument values. Only key transitions move the drone.
  const held = new Set<string>();
  let last = { x: 0, y: 3, z: 20 },
    lastAt = Date.now();
  for (let i = 0; i < 580; i++) {
    const phase = await page.getByTestId("phase").textContent();
    if (phase !== "running") break;
    const count = Number(
      (await page.locator(".mission-readout b").nth(2).innerText()).split("/")[0],
    );
    const g = GATES[count];
    if (!g) break;
    const p = JSON.parse((await page.locator(".flight-hud").getAttribute("data-position"))!);
    const now = Date.now(),
      dt = Math.max(0.08, (now - lastAt) / 1000);
    const align = Math.hypot(g.x - p.x, g.y - p.y) < 1.5,
      goal = { x: g.x, y: g.y, z: g.z + (align ? -3 : 2.6) };
    for (const [axis, pos, neg] of [
      ["x", "d", "a"],
      ["y", "e", "q"],
      ["z", "s", "w"],
    ] as const) {
      const force = (goal[axis] - p[axis]) * 0.9 - ((p[axis] - last[axis]) / dt) * 0.47;
      for (const [key, active] of [
        [pos, force > 0.22],
        [neg, force < -0.22],
      ] as const) {
        if (active && !held.has(key)) {
          await page.keyboard.down(key);
          held.add(key);
        }
        if (!active && held.has(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      }
    }
    last = p;
    lastAt = now;
    await page.waitForTimeout(110);
  }
  for (const k of held) await page.keyboard.up(k);
  await expect(page.getByTestId("phase")).toHaveText("success");
  await expect(page.getByRole("status")).toContainText("Mission archived");
  await page.getByRole("button", { name: "Mission control", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("success");
  await expect(page.locator("tbody")).toContainText("5/5");
  await page.getByRole("button", { name: "Energy", exact: true }).click();
  const slider = page.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  await page.getByRole("button", { name: "Leaderboard" }).click();
  await expect(page.locator("tbody")).toContainText("#1");
  await page.getByRole("button", { name: "Flight arena", exact: true }).click();
  await page.getByRole("button", { name: "Fly again" }).click();
  await expect(page.getByTestId("phase")).toHaveText("countdown");
});
test("API validates malformed and inconsistent input, supports retry and persists across page reloads", async ({
  page,
  request,
}) => {
  const record = {
    id: randomUUID(),
    outcome: "timeout",
    durationMs: 60000,
    gates: 2,
    collisions: 1,
    score: 1850,
    profile: "ECO",
    paint: "Ion",
  };
  expect((await request.post("/api/missions", { data: "{" })).status()).toBe(400);
  expect(
    (await request.post("/api/missions", { data: { ...record, score: 999999 } })).status(),
  ).toBe(422);
  for (let i = 0; i < 2; i++)
    expect((await request.post("/api/missions", { data: record })).ok()).toBe(true);
  expect(
    (await request.post("/api/missions", { data: { ...record, paint: "Signal" } })).status(),
  ).toBe(409);
  const data = await (await request.get("/api/missions")).json();
  expect(data.recent.filter((r: { id: string }) => r.id === record.id)).toHaveLength(1);
  await page.goto("/?scene=telemetry");
  await page.reload();
  await expect(page.locator("tbody")).toContainText(record.id.slice(0, 8).toUpperCase());
});
test("mobile layout exposes usable controls and accepts held pointer input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await ready(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Ion", exact: true }).click();
  await page.getByRole("button", { name: "Enter flight arena" }).click();
  await ready(page);
  await page.getByRole("button", { name: "Start challenge", exact: true }).first().click();
  await expect(page.getByTestId("phase")).toHaveText("running");
  const button = page
    .getByRole("button", { name: "Ascend", exact: true })
    .filter({ visible: true })
    .first();
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  const touch = await page.context().newCDPSession(page);
  await touch.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
  });
  await expect
    .poll(async () => parseFloat(await page.getByTestId("altitude").innerText()))
    .toBeGreaterThan(3.4);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await touch.detach();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("telemetry recovers from archive error and explains an empty recorder", async ({ page }) => {
  await page.route("**/api/missions", (r) =>
    r.fulfill({ status: 503, json: { error: "unavailable" } }),
  );
  await page.goto("/?scene=telemetry");
  await expect(page.getByText("Archive unavailable.", { exact: false })).toBeVisible();
  await page.unroute("**/api/missions");
  await page.route("**/api/missions", (r) => r.fulfill({ json: { recent: [], leaders: [] } }));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText(/No missions recorded/)).toBeVisible();
  await expect(page.getByText("Start a flight to record telemetry.")).toBeVisible();
});
