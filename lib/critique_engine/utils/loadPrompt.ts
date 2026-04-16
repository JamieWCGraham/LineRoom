import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const promptsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "prompts");

export function loadCritiquePrompt(filename: string): string {
  return readFileSync(join(promptsDir, filename), "utf8");
}
