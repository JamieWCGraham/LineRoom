import { z } from "zod";

export const evalSongInputSchema = z.object({
  title: z.string().min(1, "title required"),
  artist: z.string().min(1, "artist required"),
  genre: z.string(),
  overall_score: z.string().min(1, "overall_score required"),
  rationale_short: z.string(),
});

export type EvalSongInput = z.infer<typeof evalSongInputSchema>;

/** Match existing eval SQL: JSON array string in the `genre` column. */
export function genreToDbColumn(genreRaw: string): string {
  const t = genreRaw.trim();
  if (!t) return JSON.stringify(["pop"]);
  if (t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        const tags = parsed.map((s) => s.trim()).filter(Boolean);
        return JSON.stringify(tags.length ? tags : ["pop"]);
      }
    } catch {
      /* fall through */
    }
  }
  const tags = t.split(",").map((s) => s.trim()).filter(Boolean);
  return JSON.stringify(tags.length ? tags : ["pop"]);
}

/**
 * RFC4180-style CSV parser (quoted fields, newlines inside quotes).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const flushField = () => {
    row.push(field);
    field = "";
  };

  const flushRow = () => {
    flushField();
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && c === ",") {
      flushField();
    } else if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      flushRow();
    } else {
      field += c;
    }
  }
  if (inQuotes) {
    throw new Error("Unterminated quoted field in CSV");
  }
  if (field.length > 0 || row.length > 0) {
    flushField();
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

const HEADER_ALIASES: Record<string, keyof EvalSongInput> = {
  title: "title",
  artist: "artist",
  genre: "genre",
  overall_score: "overall_score",
  overallscore: "overall_score",
  "overall score": "overall_score",
  rationale_short: "rationale_short",
  rationaleshort: "rationale_short",
  "rationale short": "rationale_short",
  rationale: "rationale_short",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Parse CSV with a header row; returns validated rows or throws with a message. */
export function parseEvalSongCsv(text: string): EvalSongInput[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const grid = parseCsv(trimmed);
  if (grid.length < 2) {
    throw new Error("CSV needs a header row and at least one data row.");
  }
  const headerCells = grid[0]!.map((h) => normalizeHeader(h));
  const colIndex: Partial<Record<keyof EvalSongInput, number>> = {};
  for (let i = 0; i < headerCells.length; i++) {
    const key = HEADER_ALIASES[headerCells[i]!.replace(/\s+/g, "")] ??
      HEADER_ALIASES[headerCells[i]!];
    if (key != null) colIndex[key] = i;
  }
  const required: (keyof EvalSongInput)[] = [
    "title",
    "artist",
    "genre",
    "overall_score",
    "rationale_short",
  ];
  for (const k of required) {
    if (colIndex[k] == null) {
      throw new Error(
        `CSV header must include: ${required.join(", ")} (found: ${headerCells.join(", ")})`,
      );
    }
  }

  const out: EvalSongInput[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r]!;
    const pick = (k: keyof EvalSongInput) => {
      const idx = colIndex[k]!;
      return (line[idx] ?? "").trim();
    };
    const raw = {
      title: pick("title"),
      artist: pick("artist"),
      genre: pick("genre"),
      overall_score: pick("overall_score"),
      rationale_short: pick("rationale_short"),
    };
    if (!raw.title && !raw.artist && !raw.genre && !raw.overall_score && !raw.rationale_short) {
      continue;
    }
    const parsed = evalSongInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Row ${r + 1}: ${parsed.error.flatten().formErrors.join("; ")}`);
    }
    out.push(parsed.data);
  }
  return out;
}

export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function rowsToCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const body = rows.map((r) => r.map(escapeCsvField).join(",")).join("\r\n");
  return `${headerLine}\r\n${body}`;
}
