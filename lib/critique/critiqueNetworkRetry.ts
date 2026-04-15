import { APIConnectionError, APIError, RateLimitError } from "openai";

/** Delay before one retry after a transient OpenAI failure (default 2500 ms, max 60 s). */
export function getCritiqueNetworkRetryDelayMs(): number {
  const raw = process.env.LINE_ROOM_CRITIQUE_NETWORK_RETRY_DELAY_MS;
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return 2500;
  return Math.min(60_000, Math.floor(n));
}

/**
 * True for connection/timeout errors, rate limits, and HTTP 5xx from the API.
 * Not used for empty model / bad JSON / validation (application-level).
 */
export function isRetriableOpenAICritiqueError(error: unknown): boolean {
  if (error instanceof APIConnectionError) return true;
  if (error instanceof RateLimitError) return true;
  if (error instanceof APIError && typeof error.status === "number") {
    return error.status >= 500 && error.status < 600;
  }
  return false;
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
