/**
 * One-time backfill: earliest song_versions critique per draft fingerprint → registry.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 *
 * Usage: node scripts/backfill-lyric-draft-registry.mjs
 */
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const MIN_NORMALIZED_DRAFT_LENGTH = 40;

function normalizeDraftForFingerprint(text) {
  return text.replace(/\s+/gu, "");
}

function draftFingerprint(text) {
  const normalized = normalizeDraftForFingerprint(text);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function parseSubscores(raw) {
  if (!raw || typeof raw !== "object") return null;
  const s = raw.subscores ?? raw;
  const keys = [
    "emotional_impact",
    "imagery_specificity",
    "originality_voice",
    "prosody_singability",
    "structure_cohesion",
    "lyrical_economy",
    "hook_strength",
  ];
  const out = {};
  for (const k of keys) {
    const v = s[k];
    if (typeof v !== "number") return null;
    out[k] = Math.max(1, Math.min(5, Math.round(v)));
  }
  return out;
}

const BANDS = new Set(["Needs Work", "Promising", "Strong", "Standout"]);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let offset = 0;
  const pageSize = 200;
  let scanned = 0;
  let inserted = 0;
  let skippedShort = 0;
  let skippedInvalid = 0;
  let skippedConflict = 0;

  const seen = new Set();

  for (;;) {
    const { data, error } = await supabase
      .from("song_versions")
      .select("id, draft_text, critique, created_at")
      .not("critique", "is", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    if (!data?.length) break;

    for (const row of data) {
      scanned += 1;
      const draft = row.draft_text ?? "";
      if (normalizeDraftForFingerprint(draft).length < MIN_NORMALIZED_DRAFT_LENGTH) {
        skippedShort += 1;
        continue;
      }

      const fp = draftFingerprint(draft);
      if (seen.has(fp)) {
        skippedConflict += 1;
        continue;
      }

      const critique = row.critique;
      if (!critique || typeof critique !== "object") {
        skippedInvalid += 1;
        continue;
      }

      const band = critique.overallRatingBand;
      const subscores = parseSubscores(critique);
      if (!band || !BANDS.has(band) || !subscores) {
        skippedInvalid += 1;
        continue;
      }

      const { error: insErr } = await supabase.rpc(
        "register_lyric_draft_critique_registry",
        {
          p_fingerprint: fp,
          p_overall_rating_band: band,
          p_subscores: subscores,
          p_source_song_version_id: row.id,
        },
      );

      if (insErr) {
        console.error("register failed", fp.slice(0, 8), insErr.message);
        continue;
      }

      seen.add(fp);
      inserted += 1;
    }

    offset += data.length;
    if (data.length < pageSize) break;
  }

  console.log({
    scanned,
    inserted,
    skippedShort,
    skippedInvalid,
    skippedConflict,
    uniqueFingerprints: seen.size,
  });
}

main();
