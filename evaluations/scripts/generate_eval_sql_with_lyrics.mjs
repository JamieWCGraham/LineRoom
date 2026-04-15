#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = process.cwd();
const CURATE_PATH = resolve(ROOT, "evaluations/CURATE_EVALS.md");
const OUTPUT_PATH = resolve(ROOT, "evaluations/evaluation_set_inserts.sql");

const SCORE_HEADER_RE = /^###\s+\d+[–-]\d+\.\s+(Needs Work|Promising|Strong|Standout)\s*$/;
const SONG_RE = /^\s*(\d+)\.\s+\*\*(.+?)\*\*\s+—\s+(.+)$/;
const GENRE_RE = /^\s*\*\s*Genre tags:\s*(.+)$/;
const OVERALL_RE = /^\s*\*\s*Overall rating band:\s*\*\*(.+?)\*\*\s*$/;
const NOTES_RE = /^\s*\*\s*Notes:\s*(.+)$/;

const ARTIST_CLEANUPS = [
  [/ ft\. /gi, " "],
  [/ feat\. /gi, " "],
  [/ featuring /gi, " "],
];

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function normalizeGenreTag(tag) {
  return tag
    .trim()
    .toLowerCase()
    .replace("stomp-folk", "indie folk")
    .replace("folk-pop", "folk pop")
    .replace("mainstream rap", "hip-hop")
    .replace("mainstream pop", "pop")
    .replace("adult pop", "pop")
    .replace("club pop", "dance-pop")
    .replace("arena pop-rock", "pop-rock")
    .replace("inspirational pop-rock", "pop-rock")
    .replace("novelty country", "country-pop")
    .replace("piano ballad", "pop ballad")
    .replace("power ballad", "pop ballad")
    .replace("folk-country", "folk");
}

function dedupeAndLimit(values, max) {
  const out = [];
  for (const value of values) {
    if (!value || out.includes(value)) {
      continue;
    }
    out.push(value);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

function normalizeArtistForSearch(artist) {
  let current = artist;
  for (const [pattern, replacement] of ARTIST_CLEANUPS) {
    current = current.replace(pattern, replacement);
  }
  return current.split(",")[0].trim();
}

function titleVariants(title) {
  const variants = new Set([title]);
  variants.add(title.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim());
  variants.add(title.replaceAll("’", "'"));
  variants.add(title.replace(/\?/g, "").trim());
  return Array.from(variants).filter(Boolean);
}

function parseCurateMarkdown(markdown) {
  const songs = [];
  let currentScore = null;
  let currentSong = null;

  for (const line of markdown.split("\n")) {
    const scoreMatch = line.match(SCORE_HEADER_RE);
    if (scoreMatch) {
      currentScore = scoreMatch[1];
      continue;
    }

    const songMatch = line.match(SONG_RE);
    if (songMatch) {
      if (currentSong) songs.push(currentSong);
      currentSong = {
        id: Number(songMatch[1]),
        title: songMatch[2].trim(),
        artist: songMatch[3].trim(),
        overall_score: currentScore,
        genre: [],
        rationale_short: "",
      };
      continue;
    }

    if (!currentSong) continue;

    const genreMatch = line.match(GENRE_RE);
    if (genreMatch) {
      const rawGenres = genreMatch[1].split(",").map(normalizeGenreTag);
      currentSong.genre = dedupeAndLimit(rawGenres, 3);
      continue;
    }

    const overallMatch = line.match(OVERALL_RE);
    if (overallMatch) {
      currentSong.overall_score = overallMatch[1].trim();
      continue;
    }

    const notesMatch = line.match(NOTES_RE);
    if (notesMatch) {
      currentSong.rationale_short = notesMatch[1].trim();
    }
  }

  if (currentSong) songs.push(currentSong);

  return songs.sort((a, b) => a.id - b.id);
}

async function fetchLyrics(title, artist) {
  const artistQuery = normalizeArtistForSearch(artist);
  const attempts = [];

  for (const candidateTitle of titleVariants(title)) {
    attempts.push({ title: candidateTitle, artist: artistQuery });
  }

  for (const attempt of attempts) {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(attempt.artist)}/${encodeURIComponent(attempt.title)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      if (data?.lyrics && typeof data.lyrics === "string" && data.lyrics.trim().length > 0) {
        return data.lyrics.trim();
      }
    } catch (_error) {
      // Try the next fallback query.
    }
  }

  return null;
}

function buildInsertStatement(song, lyricsValue) {
  const genresJson = JSON.stringify(song.genre.length ? song.genre : ["pop"]);
  return [
    "INSERT INTO generate_critique_eval_set (id, title, lyrics, genre, overall_score, artist, rationale_short)",
    "VALUES (",
    `  ${song.id},`,
    `  '${escapeSql(song.title)}',`,
    `  '${escapeSql(lyricsValue)}',`,
    `  '${escapeSql(genresJson)}',`,
    `  '${escapeSql(song.overall_score)}',`,
    `  '${escapeSql(song.artist)}',`,
    `  '${escapeSql(song.rationale_short || "Included as a calibration anchor for this score band.")}'`,
    ");",
    "",
  ].join("\n");
}

async function main() {
  const markdown = await readFile(CURATE_PATH, "utf8");
  const songs = parseCurateMarkdown(markdown);

  if (songs.length !== 60) {
    throw new Error(`Expected 60 songs in CURATE_EVALS.md, found ${songs.length}.`);
  }

  let matched = 0;
  const statements = [
    "-- Generated from CURATE_EVALS.md by evaluations/scripts/generate_eval_sql_with_lyrics.mjs",
    "-- Lyrics fetched via lyrics.ovh with fallback title normalization. Unmatched records remain NEEDS_REVIEW.",
    "",
  ];

  for (const song of songs) {
    const lyrics = await fetchLyrics(song.title, song.artist);
    if (lyrics) matched += 1;
    statements.push(buildInsertStatement(song, lyrics ?? "NEEDS_REVIEW"));
  }

  await writeFile(OUTPUT_PATH, statements.join("\n"), "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Lyrics matched: ${matched}/${songs.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
