import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { after } from "next/server";

let loggerProvider: LoggerProvider | null | undefined;

function getLoggerProvider(): LoggerProvider | null {
  if (loggerProvider !== undefined) return loggerProvider;

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!projectToken || !host) {
    if (process.env.NODE_ENV === "development") {
      const missingVariable = projectToken
        ? "NEXT_PUBLIC_POSTHOG_HOST"
        : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN";
      throw new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
      );
    }
    loggerProvider = null;
    return loggerProvider;
  }

  loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({ "service.name": "lineroom" }),
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({
          url: `${host.replace(/\/$/, "")}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${projectToken}`,
            "Content-Type": "application/json",
          },
        }),
      ),
    ],
  });
  return loggerProvider;
}

/** Initializes the dedicated PostHog exporter without attaching existing loggers. */
export function startPostHogLogs(): void {
  getLoggerProvider();
}

/** Schedules delivery before a serverless route handler can be frozen. */
export function schedulePostHogLogFlush(): void {
  after(async () => {
    await loggerProvider?.forceFlush();
  });
}

/** Emits only purpose-written integration logs to the dedicated exporter. */
export const posthogLog = {
  info(message: string, attributes: Record<string, string | boolean>): void {
    getLoggerProvider()
      ?.getLogger("lineroom.posthog")
      .emit({ body: message, severityNumber: SeverityNumber.INFO, attributes });
  },
};
