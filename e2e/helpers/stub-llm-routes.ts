import type { Page } from "@playwright/test";
import { minimalCritiqueFixture } from "../fixtures/critique";

/** Stub LLM-backed routes so E2E stays deterministic and free. */
export async function stubLlmRoutes(page: Page): Promise<void> {
  await page.route("**/api/critique", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ critique: minimalCritiqueFixture }),
    });
  });

  await page.route("**/api/chat", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: {
          role: "assistant",
          content: "E2E stub: workshop reply.",
        },
      }),
    });
  });
}
