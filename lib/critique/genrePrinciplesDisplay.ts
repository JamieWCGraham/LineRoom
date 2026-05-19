/** Paragraphs 2–3 of genrePrinciples for the critique pane (omit genre-general intro). */
export function genrePrinciplesReflectionsForDisplay(raw: string): string {
  const paragraphs = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return paragraphs.slice(1, 3).join("\n\n");
}
