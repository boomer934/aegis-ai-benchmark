import { expect, test } from "@playwright/test";

test("starter page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AEGIS — Benchmark Starter" })).toBeVisible();
  await expect(page.getByText("Ready for AI agent evaluation.")).toBeVisible();
});
