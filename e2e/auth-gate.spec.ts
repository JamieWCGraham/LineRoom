import { test, expect } from "@playwright/test";

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page shows sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("lineroom is reachable without a prior account (guest try)", async ({
    page,
  }) => {
    await page.goto("/lineroom");
    await expect(page).not.toHaveURL(/\/login/);
    // Guest session bootstrap or editor chrome
    await expect(
      page.getByText(/Loading New LineRoom Session|Trial Mode of LineRoom|Draft|Critique/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
