import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildUserSpendMetricsQuery,
  parseSpendSliceFromMetricsResponse,
  fetchUserLlmSpend,
} from "@/lib/langfuse/metrics";

describe("langfuse metrics helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a user spend query with optional tag filter", () => {
    const base = buildUserSpendMetricsQuery({
      userId: "user-1",
      fromTimestamp: "2026-07-01T00:00:00.000Z",
      toTimestamp: "2026-07-30T00:00:00.000Z",
    });
    expect(base.view).toBe("observations");
    expect(base.filters).toEqual([
      {
        column: "userId",
        operator: "=",
        value: "user-1",
        type: "string",
      },
    ]);
    expect(base.metrics).toEqual([
      { measure: "totalCost", aggregation: "sum" },
      { measure: "totalTokens", aggregation: "sum" },
      { measure: "count", aggregation: "count" },
    ]);

    const tagged = buildUserSpendMetricsQuery({
      userId: "user-1",
      fromTimestamp: "2026-07-01T00:00:00.000Z",
      toTimestamp: "2026-07-30T00:00:00.000Z",
      tagsAnyOf: ["chat"],
    });
    expect(tagged.filters).toContainEqual({
      column: "tags",
      operator: "any of",
      value: ["chat"],
      type: "arrayOptions",
    });
  });

  it("parses sum_* metric fields from a metrics response row", () => {
    expect(
      parseSpendSliceFromMetricsResponse({
        data: [
          {
            sum_totalCost: "1.25",
            sum_totalTokens: "900",
            count_count: "12",
          },
        ],
      }),
    ).toEqual({
      totalCost: 1.25,
      totalTokens: 900,
      observationCount: 12,
    });
  });

  it("returns zeros for empty metrics payloads", () => {
    expect(parseSpendSliceFromMetricsResponse({ data: [] })).toEqual({
      totalCost: 0,
      totalTokens: 0,
      observationCount: 0,
    });
  });

  it("fetchUserLlmSpend queries total, chat, and critique slices", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const query = JSON.parse(
        new URL(url).searchParams.get("query") ?? "{}",
      ) as {
        filters?: Array<{ column: string; value: unknown }>;
      };
      const tagFilter = query.filters?.find((f) => f.column === "tags");
      const tag =
        Array.isArray(tagFilter?.value) ? String(tagFilter.value[0]) : "total";
      const cost =
        tag === "chat" ? "0.10"
        : tag === "critique" ? "0.40"
        : "0.50";
      return new Response(
        JSON.stringify({
          data: [
            {
              sum_totalCost: cost,
              sum_totalTokens: "100",
              count_count: "1",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };

    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "pk-test");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "sk-test");

    const spend = await fetchUserLlmSpend({
      userId: "user-1",
      fromTimestamp: "2026-07-01T00:00:00.000Z",
      toTimestamp: "2026-07-30T00:00:00.000Z",
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(calls).toHaveLength(3);
    expect(spend.total.totalCost).toBe(0.5);
    expect(spend.chat.totalCost).toBe(0.1);
    expect(spend.critique.totalCost).toBe(0.4);
  });
});
