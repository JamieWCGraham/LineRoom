import type { NextConfig } from "next";
import { getAppBuildId } from "./lib/navigation/appBuildId";

/**
 * OpenTelemetry + Langfuse are loaded from `instrumentation.ts` and API routes.
 * Bundling them into webpack vendor chunks can produce missing `./vendor-chunks/@opentelemetry.js`
 * in dev (stale or split chunks). Keeping them external matches Node resolution and avoids that.
 */
const nextConfig: NextConfig = {
  generateBuildId: async () => getAppBuildId(),
  serverExternalPackages: [
    "@opentelemetry/api",
    "@opentelemetry/api-logs",
    "@opentelemetry/context-async-hooks",
    "@opentelemetry/core",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/otlp-exporter-base",
    "@opentelemetry/otlp-transformer",
    "@opentelemetry/resources",
    "@opentelemetry/sdk-logs",
    "@opentelemetry/sdk-metrics",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/semantic-conventions",
    "@langfuse/core",
    "@langfuse/openai",
    "@langfuse/otel",
    "@langfuse/tracing",
  ],
};

export default nextConfig;
