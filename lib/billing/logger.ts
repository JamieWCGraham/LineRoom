type LogPayload = Record<string, unknown>;

/**
 * Structured logger for billing and Stripe operations.
 *
 * Every entry is emitted as a single JSON line with a consistent shape,
 * making it trivial to filter in log aggregators (e.g. `module:"billing"`).
 */
function emit(
  level: "info" | "warn" | "error",
  message: string,
  payload?: LogPayload,
): void {
  const entry = { ts: new Date().toISOString(), module: "billing", message, ...payload };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const billingLog = {
  info: (msg: string, p?: LogPayload) => emit("info", msg, p),
  warn: (msg: string, p?: LogPayload) => emit("warn", msg, p),
  error: (msg: string, p?: LogPayload) => emit("error", msg, p),
};
