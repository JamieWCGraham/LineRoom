import { NextResponse } from "next/server";
import { z } from "zod";
import { summarizeCommitForDisplay } from "@/lib/evals/commitSummaryLlm";
import { requireBillingBypassSession } from "@/lib/evals/requireBillingBypassSession";
import {
  buildCommitSummaryContext,
  fetchGithubCommitDetail,
} from "@/lib/github/commitDetail";
import {
  canonicalRepositoryMatch,
  getGithubRepository,
} from "@/lib/github/commitsConfig";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const shaListSchema = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => /^[a-f0-9]{7,40}$/.test(x)),
  )
  .pipe(z.array(z.string()).max(200));

const postBodySchema = z.object({
  repository: z.string().min(3).max(200),
  commitSha: z
    .string()
    .min(7)
    .max(40)
    .regex(/^[a-f0-9]+$/i)
    .transform((s) => s.toLowerCase()),
  /** When true, skip cache and re-run the LLM (still upserts over the same row). */
  regenerate: z.boolean().optional().default(false),
  /** Optional; when non-empty, cache is skipped so the answer reflects these questions. */
  userQuestions: z
    .string()
    .max(8000)
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t && t.length > 0 ? t : undefined;
    }),
});

function parseOwnerRepo(full: string): { owner: string; repo: string } | null {
  const parts = full.trim().split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  return { owner: parts[0]!, repo: parts[1]! };
}

export async function GET(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const repository = url.searchParams.get("repository")?.trim() ?? "";
  const shasRaw = url.searchParams.get("shas")?.trim() ?? "";
  if (!repository || !shasRaw) {
    return NextResponse.json(
      { error: "Missing query: repository, shas (comma-separated)" },
      { status: 400 },
    );
  }

  const envRepo = getGithubRepository();
  if (!canonicalRepositoryMatch(repository, envRepo.fullName)) {
    return NextResponse.json(
      { error: "Repository does not match configured GITHUB_REPOSITORY" },
      { status: 400 },
    );
  }

  const parsedShas = shaListSchema.safeParse(shasRaw);
  if (!parsedShas.success) {
    return NextResponse.json({ error: "Invalid shas list" }, { status: 400 });
  }
  const shas = parsedShas.data;
  if (shas.length === 0) {
    return NextResponse.json({ summaries: {} as Record<string, string> });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 503 },
    );
  }

  const { data, error } = await admin
    .from("github_commit_summaries")
    .select("commit_sha,summary")
    .eq("repository", repository)
    .in("commit_sha", shas);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load summaries", detail: error.message },
      { status: 500 },
    );
  }

  const summaries: Record<string, string> = {};
  for (const row of data ?? []) {
    const sha = row.commit_sha as string;
    const summary = row.summary as string;
    if (sha && summary) summaries[sha] = summary;
  }

  return NextResponse.json({ summaries });
}

export async function POST(req: Request) {
  const gate = await requireBillingBypassSession();
  if (!gate.ok) return gate.response;

  if (
    !process.env.AI_GATEWAY_API_KEY?.trim() &&
    !process.env.VERCEL_AI_GATEWAY_API_KEY?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Server is not configured with AI_GATEWAY_API_KEY (commit summaries use the same gateway as critique)",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { repository, commitSha, regenerate, userQuestions } = parsed.data;
  const skipCacheBecauseQuestions = Boolean(userQuestions);
  const envRepo = getGithubRepository();
  if (!canonicalRepositoryMatch(repository, envRepo.fullName)) {
    return NextResponse.json(
      { error: "Repository does not match configured GITHUB_REPOSITORY" },
      { status: 400 },
    );
  }

  const ownerRepo = parseOwnerRepo(repository);
  if (!ownerRepo) {
    return NextResponse.json({ error: "Invalid repository format" }, { status: 400 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "config";
    return NextResponse.json(
      { error: "Supabase service role not configured", detail: msg },
      { status: 503 },
    );
  }

  if (!regenerate && !skipCacheBecauseQuestions) {
    const { data: cached, error: cacheError } = await admin
      .from("github_commit_summaries")
      .select("summary,model")
      .eq("repository", repository)
      .eq("commit_sha", commitSha)
      .maybeSingle();

    if (cacheError) {
      return NextResponse.json(
        { error: "Failed to read cache", detail: cacheError.message },
        { status: 500 },
      );
    }

    if (cached?.summary) {
      return NextResponse.json({
        summary: cached.summary as string,
        model: cached.model as string,
        commitSha,
        cached: true,
      });
    }
  }

  const gh = await fetchGithubCommitDetail(ownerRepo.owner, ownerRepo.repo, commitSha);
  if (!gh.ok) {
    return NextResponse.json(
      {
        error: "GitHub commit fetch failed",
        detail: gh.message,
        status: gh.status,
      },
      { status: gh.status === 404 ? 404 : 502 },
    );
  }

  const fullSha = gh.data.sha.toLowerCase();

  if (!regenerate && !skipCacheBecauseQuestions) {
    const { data: cachedAfterSha, error: cacheErr2 } = await admin
      .from("github_commit_summaries")
      .select("summary,model")
      .eq("repository", repository)
      .eq("commit_sha", fullSha)
      .maybeSingle();

    if (!cacheErr2 && cachedAfterSha?.summary) {
      return NextResponse.json({
        summary: cachedAfterSha.summary as string,
        model: cachedAfterSha.model as string,
        commitSha: fullSha,
        cached: true,
      });
    }
  }

  let summaryText: string;
  let modelId: string;
  try {
    const ctx = buildCommitSummaryContext(gh.data);
    const out = await summarizeCommitForDisplay(ctx, { userQuestions });
    summaryText = out.summary;
    modelId = out.model;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM failed";
    console.error("[commit summary]", msg);
    return NextResponse.json({ error: "Summary generation failed", detail: msg }, { status: 502 });
  }

  const { error: upsertError } = await admin.from("github_commit_summaries").upsert(
    {
      repository,
      commit_sha: fullSha,
      summary: summaryText,
      model: modelId,
    },
    { onConflict: "repository,commit_sha" },
  );

  if (upsertError) {
    console.error("[commit summary] upsert", upsertError.message);
    return NextResponse.json(
      { error: "Failed to save summary", detail: upsertError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    summary: summaryText,
    model: modelId,
    commitSha: fullSha,
    cached: false,
    regenerated: regenerate,
    usedUserQuestions: Boolean(userQuestions),
  });
}
