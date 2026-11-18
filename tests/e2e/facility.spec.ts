import { expect, test, type Page } from "@playwright/test";
import { GATES } from "../../src/features/flight/physics";
import type { MissionLog } from "../../src/features/telemetry/validation";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const critical: string[] = [];
  errors.set(page, critical);
  page.on("pageerror", (error) => critical.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") critical.push(message.text());
  });
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));

async function ready(page: Page) {
  const stage = page.locator("[data-scene-ready=true]");
  await expect(stage).toBeVisible({ timeout: 35_000 });
  await expect(stage.locator("canvas")).toBeVisible();
}

const flightTab = (page: Page) => page.getByRole("button", { name: "Flight", exact: true });
const telemetryTab = (page: Page) =>
  page.getByRole("button", { name: "Mission Control", exact: true });
const status = (page: Page) => page.getByTestId("flight-status");
const select = (page: Page) => page.getByRole("combobox", { name: "Graphics quality" });

test("renders the hangar, changes view and paint, and carries setup through module navigation", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await expect(page).toHaveTitle(/Drone Test Facility/);
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await expect(page.getByRole("button", { name: "Top", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Ember" }).click();
  await expect(page.getByTestId("paint-description")).toHaveText("Ceramic vermilion");
  await page.getByRole("button", { name: "RACE", exact: true }).click();
  await page.getByRole("switch", { name: "Navigation lights" }).click();
  await page.getByRole("switch", { name: "Inspection orbit" }).click();
  await expect(page.getByRole("switch", { name: "Inspection orbit" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await select(page).selectOption("MEDIUM");
  await page.getByRole("button", { name: "Enter flight range" }).click();
  await expect(flightTab(page)).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("RACE ENGINE PROFILE")).toBeVisible();
  await telemetryTab(page).click();
  const aircraft = page.getByRole("complementary", { name: "Aircraft and selected run" });
  await expect(aircraft.getByText("Ember")).toBeVisible();
  await expect(aircraft.getByText("RACE", { exact: true })).toBeVisible();
  await expect(aircraft.getByText("Off", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(flightTab(page)).toHaveAttribute("aria-current", "page");
});

test("keyboard thrust changes the real airframe state, Space pauses and R resets", async ({
  page,
}) => {
  await page.goto("/?scene=flight");
  await select(page).selectOption("LOW");
  await ready(page);
  await page.getByRole("button", { name: "Start 60s trial" }).click();
  await expect(status(page)).toHaveText("Starting");
  await expect(status(page)).toHaveText("In flight", { timeout: 12_000 });
  await page.locator(".flight-window").focus();
  await page.keyboard.down("w");
  await page.keyboard.down("e");
  await expect
    .poll(async () => parseFloat(await page.getByTestId("flight-speed").innerText()))
    .toBeGreaterThan(2);
  await expect
    .poll(async () => parseFloat(await page.getByTestId("flight-altitude").innerText()))
    .toBeGreaterThan(2.2);
  await page.keyboard.up("w");
  await page.keyboard.up("e");
  await page.keyboard.press("Space");
  await expect(status(page)).toHaveText("Paused");
  const time = await page.getByTestId("flight-timer").innerText();
  await expect(page.getByTestId("flight-timer")).toHaveText(time);
  await page.getByRole("button", { name: "Resume flight" }).click();
  await expect(status(page)).toHaveText("In flight");
  await page.keyboard.press("r");
  await expect(status(page)).toHaveText("Ready");
  await expect(page.getByTestId("flight-timer")).toHaveText("01:00.0");
  await expect(page.getByTestId("flight-speed")).toHaveText("0.0 m/s");
});

test("successfully pilots all five physical gates, persists the run and reopens its trace", async ({
  page,
  request,
}) => {
  test.setTimeout(100_000);
  await page.goto("/?scene=flight");
  await select(page).selectOption("LOW");
  await ready(page);
  await page.getByRole("button", { name: "Start 60s trial" }).click();
  await expect(status(page)).toHaveText("In flight", { timeout: 12_000 });
  // Pilot through the public keyboard interface using the aircraft readouts.
  // No test bridge mutates the simulation or increments a checkpoint.
  await page.evaluate(
    (gates) =>
      new Promise<void>((resolve, reject) => {
        const windowEl = document.querySelector<HTMLElement>(".flight-window");
        const statusEl = document.querySelector<HTMLElement>("[data-testid=flight-status]");
        if (!windowEl || !statusEl) return reject(new Error("Flight instruments missing"));
        const codes = ["KeyA", "KeyD", "KeyE", "KeyQ", "KeyW", "KeyS"];
        const held = new Set<string>();
        function keys(next: string[]) {
          for (const code of codes) {
            const down = next.includes(code);
            if (down === held.has(code)) continue;
            window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));
            if (down) held.add(code);
            else held.delete(code);
          }
        }
        const timer = setInterval(() => {
          const status = statusEl.dataset.phase;
          const [x, y, z] = (windowEl.dataset.position ?? "").split(",").map(Number);
          const [vx, vy, vz] = (windowEl.dataset.velocity ?? "").split(",").map(Number);
          const index = Number(windowEl.dataset.checkpoints);
          if (status === "success" || status === "timeout") {
            clearInterval(timer);
            keys([]);
            return status === "success"
              ? resolve()
              : reject(new Error(`Timeout with ${index} gates at ${x},${y},${z}`));
          }
          if (status !== "active") return;
          const {
            center: [gx, gy, gz],
            width,
            height,
          } = gates[index];
          const dx = gx - x;
          const dy = gy - y;
          const dz = z - gz;
          const vxTarget = Math.min(6, Math.max(-6, dx * 1.3));
          const vyTarget = Math.min(3.5, Math.max(-3.5, dy * 1.8));
          const aligned = Math.abs(dx) < width * 0.35 && Math.abs(dy) < height * 0.32;
          const vzTarget = dz < -0.5 ? 4 : aligned || dz > 8 ? -7.4 : -Math.max(0, dz * 0.48 - 0.7);
          const next: string[] = [];
          if (vxTarget - vx > 0.48) next.push("KeyD");
          if (vxTarget - vx < -0.48) next.push("KeyA");
          if (vyTarget - vy > 0.28) next.push("KeyE");
          if (vyTarget - vy < -0.28) next.push("KeyQ");
          if (vzTarget - vz < -0.55) next.push("KeyW");
          if (vzTarget - vz > 0.55) next.push("KeyS");
          keys(next);
        }, 55);
      }),
    GATES,
  );
  await expect(status(page)).toHaveText("Course complete");
  await expect(page.getByText("Mission saved", { exact: true })).toBeVisible();
  const get = await request.get("/api/missions");
  expect(get.status()).toBe(200);
  const log: MissionLog = await get.json();
  const row = log.history.find((record) => record.outcome === "success");
  expect(row).toBeDefined();
  if (!row) throw new Error("Saved run missing");
  expect(row.checkpoints).toBe(5);
  expect(row.samples.length).toBeGreaterThan(10);
  expect(log.leaderboard[0].id).toBe(row.id);
  const { createdAt, ...original } = row;
  const duplicate = await request.post("/api/missions", { data: original });
  expect(duplicate.status()).toBe(201);
  expect((await duplicate.json()).createdAt).toBe(createdAt);
  expect(
    (
      await request.post("/api/missions", { data: { ...original, lights: !original.lights } })
    ).status(),
  ).toBe(409);
  await page.getByRole("button", { name: "View mission log" }).click();
  await page.reload();
  await page.getByRole("button", { name: row.id.slice(0, 8).toUpperCase(), exact: true }).click();
  const trace = page.getByTestId("trace-value");
  await expect(trace).toContainText("m/s");
  await page.getByRole("button", { name: "Altitude", exact: true }).click();
  await expect(trace).toContainText(/ m @/);
  await page.getByRole("slider", { name: "Sample position" }).press("Home");
  await expect(trace).toContainText("00:00.00");
  await page.getByRole("button", { name: "Leaderboard", exact: true }).click();
  await expect(page.getByRole("button", { name: "01", exact: true })).toBeVisible();
});

test("rejects malformed and inconsistent records", async ({ request }) => {
  const malformed = await request.post("/api/missions", {
    data: Buffer.from("{"),
    headers: { "Content-Type": "application/json" },
  });
  expect(malformed.status()).toBe(400);
  const result = await request.post("/api/missions", {
    data: { outcome: "success", checkpoints: 9, score: 9999 },
  });
  expect(result.status()).toBe(422);
  const response = await result.json();
  expect(response.issues).toEqual(
    expect.arrayContaining([expect.objectContaining({ path: ["checkpoints"] })]),
  );
  const oversized = await request.post("/api/missions", { data: Buffer.alloc(34_000, 32) });
  expect(oversized.status()).toBe(413);
});

test.describe("mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  test("keeps the canvas usable without horizontal overflow and supports held touch thrust", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await select(page).selectOption("LOW");
    await ready(page);
    const noOverflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    expect(await noOverflow()).toBe(true);
    await flightTab(page).tap();
    await ready(page);
    await page.getByRole("button", { name: "Start 60s trial" }).tap();
    await expect(status(page)).toHaveText("In flight", { timeout: 12_000 });
    const ascend = page.getByRole("button", { name: "Ascend", exact: true });
    await ascend.scrollIntoViewIfNeeded();
    const bounds = await ascend.boundingBox();
    if (!bounds) throw new Error("Ascend control is missing");
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, id: 1 }],
    });
    try {
      await expect
        .poll(async () => parseFloat(await page.getByTestId("flight-altitude").innerText()))
        .toBeGreaterThan(2.3);
    } finally {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    }
    await page.getByRole("button", { name: "Reset flight" }).tap();
    await expect(status(page)).toHaveText("Ready");
    expect(await noOverflow()).toBe(true);
    await telemetryTab(page).tap();
    expect(await noOverflow()).toBe(true);
  });
});
