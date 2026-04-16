import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CritiqueRequestPayload } from "@/lib/prompts";
import type { CritiqueEngineModelRouting } from "@/lib/critique_engine/config/critique_engine_config";
import { PROMPT_VERSIONS } from "@/lib/critique_engine/config/critique_engine_config";

export type PersistCritiqueEngineRunInput = {
  userId?: string;
  sessionId: string;
  payload: CritiqueRequestPayload;
  nodeOutputs: unknown;
  finalOutput: unknown;
  modelConfigs: CritiqueEngineModelRouting;
  timings: Record<string, number> | undefined;
  success: boolean;
  error?: string;
};

/**
 * Best-effort persistence when table `critique_engine_runs` exists and
 * `CRITIQUE_ENGINE_RUNS_ENABLED=1`.
 */
export async function persistCritiqueEngineRun(
  input: PersistCritiqueEngineRunInput,
): Promise<void> {
  if (process.env.CRITIQUE_ENGINE_RUNS_ENABLED?.trim() !== "1") {
    return;
  }
  if (!input.userId) {
    return;
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("critique_engine_runs").insert({
      user_id: input.userId,
      session_id: input.sessionId,
      success: input.success,
      error: input.error ?? null,
      request: input.payload,
      node_outputs: input.nodeOutputs,
      final_output: input.finalOutput,
      model_configs: input.modelConfigs,
      timings: input.timings ?? {},
      prompt_versions: PROMPT_VERSIONS,
    });

    if (error) {
      console.error("[persistCritiqueEngineRun]", error.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[persistCritiqueEngineRun] skipped:", msg);
  }
}
