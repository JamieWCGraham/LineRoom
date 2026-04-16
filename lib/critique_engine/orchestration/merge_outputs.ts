import type { CritiqueResult, LineFeedbackItem as LegacyLineFeedback } from "@/lib/types";
import type { CalibrationScoringOutput } from "@/lib/critique_engine/schemas/calibration_scoring";
import type { GenreContextOutput } from "@/lib/critique_engine/schemas/genre_context";
import type { LineFeedbackItem } from "@/lib/critique_engine/schemas/line_feedback";
import type { SynthesisOutput } from "@/lib/critique_engine/schemas/synthesis";
import type { CritiqueRequestPayload } from "@/lib/prompts";
import type { SegmentedLyric } from "@/lib/critique_engine/utils/lyric_segmentation";

function genrePrinciplesFromContext(g: GenreContextOutput): string {
  const lens = g.evaluationLensSummary.trim();
  const traits = g.styleTraits.map((t) => `- ${t}`).join("\n");
  const principles = g.songwritingPrinciples.map((p) => `- ${p}`).join("\n");
  const genres = g.normalizedGenres.join(", ") || "(unspecified)";
  const infl =
    g.normalizedInfluences.length ? g.normalizedInfluences.join(", ") : "(none named)";

  return `Normalized genres: ${genres}
Voice / influence references: ${infl}

Evaluation lens:
${lens}

Style traits:
${traits}

Songwriting principles for this lens:
${principles}`;
}

function subscoresToLegacy(c: CalibrationScoringOutput): CritiqueResult["subscores"] {
  return {
    emotional_impact: c.subscores.emotionalImpact,
    imagery_specificity: c.subscores.imagerySpecificity,
    originality_voice: c.subscores.originalityVoice,
    prosody_singability: c.subscores.prosodySingability,
    structure_cohesion: c.subscores.structureCohesion,
    lyrical_economy: c.subscores.lyricalEconomy,
    hook_strength: c.subscores.hookStrength,
  };
}

function rationalesToRecord(
  r: CalibrationScoringOutput["subscoreRationales"],
): Record<string, string> {
  return {
    emotional_impact: r.emotionalImpact,
    imagery_specificity: r.imagerySpecificity,
    originality_voice: r.originalityVoice,
    prosody_singability: r.prosodySingability,
    structure_cohesion: r.structureCohesion,
    lyrical_economy: r.lyricalEconomy,
    hook_strength: r.hookStrength,
  };
}

function lineFeedbackToLegacy(
  items: LineFeedbackItem[],
  segmented: SegmentedLyric,
): LegacyLineFeedback[] {
  const lineByIndex = new Map(segmented.lines.map((l) => [l.index, l.text]));

  return items.map((item) => {
    const singleLineText = lineByIndex.get(item.lineIndexStart) ?? item.quotedText;
    let quotedLine = item.quotedText.trim();
    if (
      item.lineIndexEnd != null &&
      item.lineIndexEnd > item.lineIndexStart
    ) {
      const span = segmented.lines
        .filter((l) => l.index >= item.lineIndexStart && l.index <= item.lineIndexEnd!)
        .map((l) => l.text)
        .join("\n");
      if (span.trim()) quotedLine = span;
    } else if (!quotedLine) {
      quotedLine = singleLineText;
    }

    const parts = [item.commentary.trim()];
    if (item.rewriteDirection?.trim()) {
      parts.push(`Direction: ${item.rewriteDirection.trim()}`);
    }
    if (item.suggestedRevision?.trim()) {
      parts.push(`Optional rewrite: ${item.suggestedRevision.trim()}`);
    }
    const feedback = parts.join("\n\n");

    const category: LegacyLineFeedback["category"] =
      item.feedbackType === "praise" ? "praise" : "constructive";

    const strength =
      item.label === "strong" ? "strong"
      : item.label === "promising" ? "promising"
      : "weak";

    return {
      quotedLine,
      feedback,
      category,
      strength,
    };
  });
}

export function mergeCritiqueNodeOutputs(params: {
  payload: CritiqueRequestPayload;
  genre: GenreContextOutput;
  calibration: CalibrationScoringOutput;
  synthesis: SynthesisOutput;
  lineAnnotations: LineFeedbackItem[];
  segmented: SegmentedLyric;
}): CritiqueResult {
  const { genre, calibration, synthesis, lineAnnotations, segmented } = params;

  const prioritiesBlock =
    synthesis.revisionPriorities.length > 0 ?
      `Revision priorities:\n${synthesis.revisionPriorities.map((p) => `- ${p}`).join("\n")}`
    : "";

  const overallBandRationale = [
    synthesis.overallSummary.trim(),
    prioritiesBlock,
    synthesis.nextBandGuidance.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const diagnostics = {
    diagnosticSummaryShort: calibration.diagnosticSummaryShort,
    calibrationConfidence: calibration.calibrationConfidence,
    subscoreRationales: rationalesToRecord(calibration.subscoreRationales),
  };

  return {
    genrePrinciples: genrePrinciplesFromContext(genre),
    overallRatingBand: calibration.overallRatingBand,
    overallBandRationale,
    subscores: subscoresToLegacy(calibration),
    overallStrengths: synthesis.topStrengths,
    overallWeaknesses: synthesis.topWeaknesses,
    lineFeedback: lineFeedbackToLegacy(lineAnnotations, segmented),
    diagnostics,
  };
}
