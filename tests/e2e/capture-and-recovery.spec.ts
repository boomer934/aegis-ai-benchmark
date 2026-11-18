import { expect, test } from "@playwright/test";
test("benchmark camera is reproducible, with visible changes for zoom, paint and orbit", async ({
  page,
}) => {
  const url = "/?benchmark=1&seed=42&scene=hangar&camera=hero";
  const capture = async () => {
    await expect(page.locator('[data-rendered="yes"]')).toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    return page.locator("canvas").screenshot();
  };
  await page.goto(url);
  const hero = await capture();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await capture()).equals(hero)).toBe(false);
  await page.reload();
  expect((await capture()).equals(hero)).toBe(true);
  await page.getByRole("button", { name: "Ion", exact: true }).click();
  const paint = await capture();
  expect(paint.equals(hero)).toBe(false);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 130, box.y + box.height / 2 + 20, { steps: 12 });
  await page.mouse.up();
  expect((await capture()).equals(paint)).toBe(false);
  await page.getByRole("button", { name: "Top", exact: true }).click();
  expect((await capture()).equals(hero)).toBe(false);
  await expect(page.locator("[data-perf]")).toHaveCount(0);
});
test("a timed-out flight survives a database outage and archives exactly once after reload", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.route("**/api/missions", (r) =>
    r.request().method() === "POST"
      ? r.fulfill({ status: 503, json: { error: "unavailable" } })
      : r.continue(),
  );
  await page.goto("/?scene=flight");
  await expect(page.locator('[data-rendered="yes"]')).toBeVisible();
  await page.getByRole("button", { name: "Start challenge", exact: true }).click();
  await expect(page.getByTestId("phase")).toHaveText("running");
  await expect(page.getByTestId("phase")).toHaveText("timeout", { timeout: 66000 });
  await expect(page.getByRole("button", { name: /Retry save/ })).toBeVisible();
  const id = await page.evaluate(() =>
    Object.keys(localStorage)
      .find((k) => k.startsWith("aegis.pending."))
      ?.slice("aegis.pending.".length),
  );
  expect(id).toBeTruthy();
  await page.unroute("**/api/missions");
  await page.goto("/?scene=telemetry");
  await expect(page.locator("tbody")).toContainText(id!.slice(0, 8).toUpperCase());
  await page.reload();
  const data = await (await request.get("/api/missions")).json();
  const rows = data.recent.filter((r: { id: string }) => r.id === id);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    outcome: "timeout",
    durationMs: 60000,
    gates: 0,
    collisions: 0,
    score: 0,
  });
});
