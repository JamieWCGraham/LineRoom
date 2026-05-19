import { test, expect } from "@playwright/test";

const hasAuth =
  !!process.env.E2E_TEST_EMAIL?.trim() &&
  !!process.env.E2E_TEST_PASSWORD?.trim();

test.describe("account", () => {
  test.skip(!hasAuth, "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

  test("account page loads", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /account/i })).toBeVisible();
  });
});
