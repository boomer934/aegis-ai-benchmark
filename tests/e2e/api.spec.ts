import { expect, test } from "@playwright/test";
import { flownSubmission, trackErrors } from "./helpers";

const unique = () => `E2E-${Date.now().toString(36).slice(-6).toUpperCase()}`;

test.describe("mission records API", () => {
  test("persists a flown mission and retrieves it via list, detail and leaderboard", async ({
    request,
  }) => {
    const callsign = unique();
    const body = flownSubmission("RACE", callsign);
    const created = await request.post("/api/missions", { data: body });
    expect(created.status()).toBe(201);
    const { mission } = await created.json();
    expect(mission.callsign).toBe(callsign);
    expect(mission.score).toBe(body.score);

    const list = await (await request.get("/api/missions?limit=50")).json();
    expect(list.missions.some((m: { id: string }) => m.id === mission.id)).toBe(true);
    expect(list.total).toBeGreaterThan(0);

    const detail = await request.get(`/api/missions/${mission.id}`);
    expect(detail.status()).toBe(200);
    const d = (await detail.json()).mission;
    expect(d.telemetry.length).toBe(body.telemetry.length);
    expect(d.splitsMs).toEqual(body.splitsMs);

    const board = await (await request.get("/api/leaderboard?engine=RACE&limit=50")).json();
    expect(board.entries.some((m: { id: string }) => m.id === mission.id)).toBe(true);
    const scores = board.entries.map((m: { score: number }) => m.score);
    expect(scores).toEqual([...scores].sort((a: number, b: number) => b - a));
  });

  test("rejects invalid input with clear errors", async ({ request }) => {
    const valid = flownSubmission("SPORT", unique());

    const badJson = await request.post("/api/missions", {
      headers: { "Content-Type": "application/json" },
      data: "{nope",
    });
    expect(badJson.status()).toBe(400);

    const wrongType = await request.post("/api/missions", {
      headers: { "Content-Type": "text/plain" },
      data: "hello",
    });
    expect(wrongType.status()).toBe(415);

    const schema = await request.post("/api/missions", {
      data: { ...valid, checkpoints: 9, engine: "WARP" },
    });
    expect(schema.status()).toBe(400);
    const schemaBody = await schema.json();
    expect(schemaBody.error).toBe("Invalid mission record");
    expect(schemaBody.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(["checkpoints", "engine"]),
    );

    const forgedScore = await request.post("/api/missions", {
      data: { ...valid, score: valid.score + 5000 },
    });
    expect(forgedScore.status()).toBe(422);

    const tooFast = await request.post("/api/missions", {
      data: {
        ...valid,
        durationMs: 900,
        splitsMs: [100, 200, 300, 400, 900],
        telemetry: [],
        score: 5000 + Math.floor((60000 - 900) / 20),
      },
    });
    expect(tooFast.status()).toBe(422);
    expect(JSON.stringify(await tooFast.json())).toMatch(/faster than/);

    expect((await request.get("/api/missions?limit=999")).status()).toBe(400);
    expect((await request.get("/api/missions/doesnotexist123")).status()).toBe(404);
    expect((await request.get("/api/missions/bad%20id!")).status()).toBe(400);
    expect((await request.get("/api/leaderboard?engine=WARP")).status()).toBe(400);
  });

  test("mission history UI shows persisted records and their telemetry", async ({
    page,
    request,
  }) => {
    const errors = trackErrors(page);
    const callsign = unique();
    const res = await request.post("/api/missions", { data: flownSubmission("ECO", callsign) });
    expect(res.status()).toBe(201);

    await page.goto("/control");
    const row = page.getByTestId("history-row").filter({ hasText: callsign });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: callsign }).click();
    await expect(page.getByTestId("chart-title")).toContainText(callsign);
    await expect(page.getByTestId("chart-speed")).toBeVisible();
    // Hover produces a crosshair readout.
    await page.getByTestId("chart-speed").hover({ position: { x: 200, y: 40 } });
    await expect(page.getByTestId("chart-tooltip")).toContainText("t =");
    await expect(page.getByTestId("leaderboard-list")).toBeVisible();

    await page.getByRole("radio", { name: "Failed" }).click();
    await expect(page.getByTestId("history-row").filter({ hasText: callsign })).toHaveCount(0);
    expect(errors()).toEqual([]);
  });
});
