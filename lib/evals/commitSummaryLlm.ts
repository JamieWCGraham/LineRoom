import {
  createCritiqueGatewayOpenAI,
  getCritiqueGatewayModelId,
} from "@/lib/aiGatewayCritique";

function sanitizeForLlmRequest(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "");
}

function getCommitSummaryModelId(): string {
  return (
    process.env.COMMIT_SUMMARY_GATEWAY_MODEL?.trim() || getCritiqueGatewayModelId()
  );
}

export type SummarizeCommitOptions = {
  /** Optional natural-language question(s); answered in the same prose summary. */
  userQuestions?: string | null;
};

/**
 * Plain-language summary of a single commit for internal tooling (evals commits page).
 */
export async function summarizeCommitForDisplay(
  commitContext: string,
  options?: SummarizeCommitOptions,
): Promise<{
  summary: string;
  model: string;
}> {
  const client = createCritiqueGatewayOpenAI();
  const model = getCommitSummaryModelId();
  const q = options?.userQuestions?.trim() ?? "";
  const userContent = sanitizeForLlmRequest(commitContext).slice(0, 120_000);
  const userBlocks = [
    userContent,
    q ?
      [
        "",
        "---",
        "The reader also asked (answer within your summary, clearly and concretely; if the diff does not support an answer, say so):",
        q,
      ].join("\n")
    : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemParts = [
    "You summarize git commits for developers who want a quick plain-English recap.",
    "Write 2–5 short sentences: what changed, which areas of the codebase, and the apparent intent.",
    "If the diff is truncated, say what you can infer and avoid inventing specifics you did not see.",
    "No markdown headings or bullet labels; flowing prose only.",
  ];
  if (q) {
    systemParts.push(
      "When the reader asked extra questions, weave direct answers into the same flowing paragraphs (do not use a separate Q&A or numbered list).",
    );
  }

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: q ? 700 : 450,
    messages: [
      {
        role: "system",
        content: systemParts.join(" "),
      },
      { role: "user", content: userBlocks },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error("Empty model response");
  return { summary: raw, model };
}
