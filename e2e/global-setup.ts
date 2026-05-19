import { chromium, type FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const authDir = path.join(__dirname, ".auth");
const authFile = path.join(authDir, "user.json");

async function globalSetup(config: FullConfig): Promise<void> {
  fs.mkdirSync(authDir, { recursive: true });

  const email = process.env.E2E_TEST_EMAIL?.trim();
  const password = process.env.E2E_TEST_PASSWORD?.trim();
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://127.0.0.1:3000";

  if (!email || !password) {
    fs.writeFileSync(
      authFile,
      JSON.stringify({ cookies: [], origins: [] }),
      "utf8",
    );
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  });
  await page.context().storageState({ path: authFile });
  await browser.close();
}

export default globalSetup;
