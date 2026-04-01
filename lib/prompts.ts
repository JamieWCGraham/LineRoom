import type { RewriteAction } from "./types";

export const REWRITE_SYSTEM = `You are an elite lyric editor helping a songwriter refine existing lyrics.

Your job is not to generate generic AI poetry.
Your job is to preserve the writer's voice, emotional intent, and singability while improving the selected lines according to the requested edit goal.

Priorities:
1. Preserve core meaning unless the instruction says otherwise.
2. Avoid cliché, abstraction, and bland polished language.
3. Prefer specific, vivid, human phrasing.
4. Preserve line breaks and lyrical shape where possible.
5. Do not explain the lyric inside the rewrite.
6. Return distinct options rather than near-duplicates.`;

export function buildRewriteUserPrompt(params: {
  fullText: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  voiceNotes: string;
  action: RewriteAction;
  customInstruction: string;
  n: number;
}): string {
  const {
    fullText,
    selectedText,
    contextBefore,
    contextAfter,
    voiceNotes,
    action,
    customInstruction,
    n,
  } = params;
  return `Full draft:
${fullText}

Selected text:
${selectedText}

Context before:
${contextBefore}

Context after:
${contextAfter}

Voice notes:
${voiceNotes}

Edit action:
${action}

Custom instruction:
${customInstruction}

Return exactly ${n} rewrite options as JSON with this shape only (no markdown):
{"options":[{"label":"string","rationale":"string","text":"string"},...]}

Important:
- rewrite only the selected text
- preserve emotional meaning unless explicitly asked otherwise
- keep roughly similar length unless the action implies compression/expansion
- keep the language lyrical and singable
- make each option meaningfully distinct`;
}

export const CRITIQUE_SYSTEM = `You are a world-class lyric editor.

Provide concise, high-signal editorial feedback on selected lyrics.
Be honest, direct, and useful.
Do not flatter.
Do not give academic literary analysis.
Respond like a trusted collaborator focused on craft.`;

export function buildCritiqueUserPrompt(params: {
  fullText: string;
  selectedText: string;
  contextBefore: string;
  contextAfter: string;
  voiceNotes: string;
}): string {
  const { fullText, selectedText, contextBefore, contextAfter, voiceNotes } =
    params;
  return `Full draft:
${fullText}

Selected text:
${selectedText}

Context before:
${contextBefore}

Context after:
${contextAfter}

Voice notes:
${voiceNotes}

Provide JSON only (no markdown) with this exact shape:
{"strengths":["string",...],"weaknesses":["string",...],"strongestLine":"string or omit","weakestLine":"string or omit","clicheRisk":"string or omit","emotionalClarity":"string or omit","nextMove":"string or omit"}

Include 3 to 5 strengths and 3 to 5 weaknesses.`;
}
