import { test, expect } from "@playwright/test";

test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login page shows sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  test("forgot password page shows email form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Forgot password" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send reset link" }),
    ).toBeVisible();
  });

  test("reset password without recovery session shows expired message", async ({
    page,
  }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByRole("heading", { name: "Reset password" }),
    ).toBeVisible();
    await expect(
      page.getByText(/invalid or has expired/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Forgot password" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  test("login page shows Google OAuth when enabled", async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED !== "true",
      "NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED is not true",
    );
    await page.goto("/login");
    const google = page.getByRole("link", { name: /Continue with Google/i });
    await expect(google).toBeVisible();
    await expect(google).toHaveAttribute(
      "href",
      "/auth/oauth?provider=google",
    );
    if (process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED !== "true") {
      await expect(
        page.getByRole("link", { name: /Continue with Apple/i }),
      ).toHaveCount(0);
    }
  });

  test("login page shows Apple OAuth when enabled", async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED !== "true",
      "NEXT_PUBLIC_OAUTH_APPLE_ENABLED is not true",
    );
    await page.goto("/login");
    const apple = page.getByRole("link", { name: /Continue with Apple/i });
    await expect(apple).toBeVisible();
    await expect(apple).toHaveAttribute(
      "href",
      "/auth/oauth?provider=apple",
    );
    if (process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED !== "true") {
      await expect(
        page.getByRole("link", { name: /Continue with Google/i }),
      ).toHaveCount(0);
    }
  });

  test("login page shows OAuth on mobile viewport", async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED !== "true" &&
        process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED !== "true",
      "OAuth UI is not enabled",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    if (process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED === "true") {
      await expect(
        page.getByRole("link", { name: /Continue with Google/i }),
      ).toBeVisible();
    }
    if (process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED === "true") {
      await expect(
        page.getByRole("link", { name: /Continue with Apple/i }),
      ).toBeVisible();
    }
  });

  test("oauth start redirects toward Google via Supabase", async ({
    request,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED !== "true",
      "NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED is not true",
    );
    const res = await request.get("/auth/oauth?provider=google", {
      maxRedirects: 0,
    });
    expect([302, 303, 307, 308]).toContain(res.status());
    const location = res.headers().location ?? "";
    expect(location).toMatch(/supabase\.co\/auth\/v1\/authorize/);
    expect(location).toMatch(/provider=google/);
  });

  test("oauth start redirects toward Apple via Supabase", async ({
    request,
  }) => {
    test.skip(
      process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED !== "true",
      "NEXT_PUBLIC_OAUTH_APPLE_ENABLED is not true",
    );
    const res = await request.get("/auth/oauth?provider=apple", {
      maxRedirects: 0,
    });
    expect([302, 303, 307, 308]).toContain(res.status());
    const location = res.headers().location ?? "";
    expect(location).toMatch(/supabase\.co\/auth\/v1\/authorize/);
    expect(location).toMatch(/provider=apple/);
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
