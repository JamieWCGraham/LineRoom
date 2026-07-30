import { isLangfuseEnabled } from "@/lib/langfuse-server";

export type LangfuseSpendSlice = {
  totalCost: number;
  totalTokens: number;
  observationCount: number;
};

export type LangfuseUserSpend = {
  total: LangfuseSpendSlice;
  chat: LangfuseSpendSlice;
  critique: LangfuseSpendSlice;
};

export type LangfuseMetricsFilter = {
  column: string;
  operator: string;
  value: string | string[] | number | boolean;
  type: string;
  key?: string;
};

export type LangfuseMetricsQuery = {
  view: "observations";
  metrics: Array<{ measure: string; aggregation: string }>;
  dimensions: Array<{ field: string }>;
  filters: LangfuseMetricsFilter[];
  fromTimestamp: string;
  toTimestamp: string;
  config?: { row_limit?: number };
};

const EMPTY_SLICE: LangfuseSpendSlice = {
  totalCost: 0,
  totalTokens: 0,
  observationCount: 0,
};

function langfuseBaseUrl(): string {
  const raw = process.env.LANGFUSE_BASE_URL?.trim();
  if (!raw) return "https://cloud.langfuse.com";
  return raw.replace(/\/+$/, "");
}

function langfuseAuthHeader(): string {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim() ?? "";
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim() ?? "";
  const token = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  return `Basic ${token}`;
}

export function buildUserSpendMetricsQuery(params: {
  userId: string;
  fromTimestamp: string;
  toTimestamp: string;
  tagsAnyOf?: string[];
}): LangfuseMetricsQuery {
  const filters: LangfuseMetricsFilter[] = [
    {
      column: "userId",
      operator: "=",
      value: params.userId,
      type: "string",
    },
  ];
  if (params.tagsAnyOf && params.tagsAnyOf.length > 0) {
    filters.push({
      column: "tags",
      operator: "any of",
      value: params.tagsAnyOf,
      type: "arrayOptions",
    });
  }
  return {
    view: "observations",
    metrics: [
      { measure: "totalCost", aggregation: "sum" },
      { measure: "totalTokens", aggregation: "sum" },
      { measure: "count", aggregation: "count" },
    ],
    dimensions: [],
    filters,
    fromTimestamp: params.fromTimestamp,
    toTimestamp: params.toTimestamp,
    config: { row_limit: 1 },
  };
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Parses a single-row Metrics v2 response into cost/token/count totals.
 */
export function parseSpendSliceFromMetricsResponse(body: unknown): LangfuseSpendSlice {
  if (!body || typeof body !== "object") return { ...EMPTY_SLICE };
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) return { ...EMPTY_SLICE };
  const row = data[0];
  if (!row || typeof row !== "object") return { ...EMPTY_SLICE };
  const record = row as Record<string, unknown>;
  return {
    totalCost: asNumber(record.sum_totalCost ?? record.totalCost),
    totalTokens: asNumber(record.sum_totalTokens ?? record.totalTokens),
    observationCount: asNumber(
      record.count_count ?? record.count ?? record.sum_count,
    ),
  };
}

export async function fetchLangfuseMetrics(
  query: LangfuseMetricsQuery,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  if (!isLangfuseEnabled()) {
    throw new Error("Langfuse is not configured");
  }
  const url = new URL(`${langfuseBaseUrl()}/api/public/v2/metrics`);
  url.searchParams.set("query", JSON.stringify(query));
  const res = await fetchImpl(url.toString(), {
    method: "GET",
    headers: {
      Authorization: langfuseAuthHeader(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Langfuse metrics failed (${res.status})${text ? `: ${text.slice(0, 300)}` : ""}`,
    );
  }
  return res.json() as Promise<unknown>;
}

export async function fetchUserLlmSpend(params: {
  userId: string;
  fromTimestamp: string;
  toTimestamp: string;
  fetchImpl?: typeof fetch;
}): Promise<LangfuseUserSpend> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const base = {
    userId: params.userId,
    fromTimestamp: params.fromTimestamp,
    toTimestamp: params.toTimestamp,
  };

  const [totalBody, chatBody, critiqueBody] = await Promise.all([
    fetchLangfuseMetrics(buildUserSpendMetricsQuery(base), fetchImpl),
    fetchLangfuseMetrics(
      buildUserSpendMetricsQuery({ ...base, tagsAnyOf: ["chat"] }),
      fetchImpl,
    ),
    fetchLangfuseMetrics(
      buildUserSpendMetricsQuery({ ...base, tagsAnyOf: ["critique"] }),
      fetchImpl,
    ),
  ]);

  return {
    total: parseSpendSliceFromMetricsResponse(totalBody),
    chat: parseSpendSliceFromMetricsResponse(chatBody),
    critique: parseSpendSliceFromMetricsResponse(critiqueBody),
  };
}
