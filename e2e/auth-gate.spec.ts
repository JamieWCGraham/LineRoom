import { test, expect } from "@playwright/test";

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page shows sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("lineroom redirects to login when not signed in", async ({ page }) => {
    await page.goto("/lineroom");
    await expect(page).toHaveURL(/\/login/);
  });
});
