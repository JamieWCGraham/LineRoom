import { test, expect } from "@playwright/test";
import { stubLlmRoutes } from "./helpers/stub-llm-routes";

const hasAuth =
  !!process.env.E2E_TEST_EMAIL?.trim() &&
  !!process.env.E2E_TEST_PASSWORD?.trim();

test.describe("authenticated editor", () => {
  test.skip(!hasAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await stubLlmRoutes(page);
    await page.route("**/api/billing/access", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access: {
            canGenerateCritique: true,
            hasActiveSubscription: true,
            isBypassed: true,
            remainingFreeCritiques: 99,
          },
        }),
      });
    });
  });

  test("lineroom shows draft and workshop panels", async ({ page }) => {
    await page.goto("/lineroom");
    await expect(page.getByRole("button", { name: "Draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Workshop" })).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: /draft|lyrics/i }).first(),
    ).toBeVisible();
  });

  test("critique setup and generate with stub", async ({ page }) => {
    await page.goto("/lineroom");
    const draft = page.getByRole("textbox").first();
    await draft.fill("Line one\nLine two for critique");
    await page.getByRole("button", { name: "Critique" }).click();
    await page.getByRole("button", { name: /generate/i }).click();
    await expect(page.getByText("Promising")).toBeVisible({
      timeout: 15_000,
    });
  });
});
