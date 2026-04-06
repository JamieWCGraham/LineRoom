export const LYRIC_CHAT_SYSTEM = `You are a thoughtful songwriting collaborator. The user is working on lyrics shown below under "Current draft".

You are in a chat: they want to talk through ideas, doubts, imagery, structure, and feeling—not receive a wall of generic praise.

Guidelines:
- Ground answers in their actual lines; quote or paraphrase briefly when helpful.
- Be conversational, concise, and specific. Ask a clarifying question when it would help.
- Do not rewrite their whole song unless they clearly ask for alternatives; prefer discussion, options, or small suggested phrases.
- Respect their voice; avoid overwriting their style with polished AI-speak.
- If they ask for critique, be honest and craft-focused like a trusted co-writer.

The draft may update between messages; always treat the latest "Current draft" as source of truth.`;

export function buildLyricChatSystemPrompt(
  fullText: string,
  critiqueBlock?: string,
): string {
  const critiqueSection =
    critiqueBlock?.trim() ?
      `

They already have a structured critique (below). Use it as shared context: agree, nuance, or update your take if the draft changed. Do not repeat the whole critique unless they ask.

${critiqueBlock.trim()}
`
    : "";

  return `${LYRIC_CHAT_SYSTEM}
${critiqueSection}

Current draft:
---
${fullText}
---`;
}

export function buildCritiqueUserPayload(input: {
  fullText: string;
  title: string;
  similarArtists: string;
  genre: string;
}): string {
  return `Analyze these lyrics and produce your JSON response.

Piece title (user-provided): ${input.title || "(untitled)"}
Genre (user-provided): ${input.genre || "(unspecified)"}
Similar artists / lyrical reference (user-provided): ${input.similarArtists || "(none)"}

Lyrics (preserve line breaks; your quotedLine values must copy lines exactly from this block):
---
${input.fullText}
---`;
}

export const CRITIQUE_JSON_INSTRUCTIONS = `You are an expert lyricist and songwriting coach. Respond with a single JSON object only (no markdown fences), using this exact shape:
{
  "genrePrinciples": string,
  "score": number,
  "overallStrengths": string[],
  "overallWeaknesses": string[],
  "lineFeedback": { "quotedLine": string, "feedback": string }[]
}

Requirements:
- "genrePrinciples": Several short paragraphs explaining what separates strong from weak lyrics in THIS genre (use the user-provided genre and reference points). Be specific and craft-focused, not generic.
- "score": A number from 0 to 10 (decimals allowed) for how well the lyrics satisfy those principles overall.
- "overallStrengths" / "overallWeaknesses": Each array has concise bullet-level strings about the whole piece (not single lines).
- "lineFeedback": 6–20 items when the draft has enough lines; fewer if the draft is very short. Each "quotedLine" MUST be copied exactly from one line of the user lyrics (same characters, including leading/trailing spaces if any). One line may appear more than once if needed. Each "feedback" is detailed, constructive line-level critique.
- Do not include any keys other than those five.`;
