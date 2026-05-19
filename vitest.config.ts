import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setupTests.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/songs/persist/persistQueue.ts",
        "lib/songs/persist/buildAutosavePayload.ts",
        "lib/billing/config.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 50,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
