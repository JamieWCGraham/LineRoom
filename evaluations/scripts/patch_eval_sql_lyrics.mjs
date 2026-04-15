#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..", "..");
const SQL_PATH = resolve(ROOT, "evaluations/evaluation_set_inserts.sql");
const PATCH_PATH =
  process.argv[2] || resolve(ROOT, "evaluations/manual_lyrics_patch.json");

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function parsePatchInput(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Patch input must be a JSON object keyed by numeric IDs.");
  }

  const entries = [];
  for (const [key, value] of Object.entries(parsed)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id < 1 || id > 60) {
      throw new Error(`Invalid song id key '${key}'. Expected integer 1-60.`);
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Value for id '${key}' must be a non-empty lyrics string.`);
    }
    entries.push({ id, lyrics: value.trim() });
  }

  return entries.sort((a, b) => a.id - b.id);
}

function replaceLyricsForId(sql, id, lyrics) {
  const escapedLyrics = escapeSql(lyrics);
  const blockRe = new RegExp(
    `(VALUES\\s*\\(\\s*\\n\\s*${id},\\s*\\n[\\s\\S]*?\\n\\s*'[^']*(?:''[^']*)*')(\\s*,\\s*\\n\\s*'\\[)`,
    "m",
  );

  const match = sql.match(blockRe);
  if (!match) {
    throw new Error(`Could not locate SQL block for id ${id}.`);
  }

  const block = match[1];
  const lyricLineRe = /(\n\s*)'[^']*(?:''[^']*)*'(\s*,\s*\n\s*'\[)/m;
  if (!lyricLineRe.test(block)) {
    throw new Error(`Could not locate lyrics line for id ${id}.`);
  }

  const updatedBlock = block.replace(lyricLineRe, `$1'${escapedLyrics}'$2`);
  return sql.replace(block, updatedBlock);
}

async function main() {
  const [sqlRaw, patchRaw] = await Promise.all([
    readFile(SQL_PATH, "utf8"),
    readFile(PATCH_PATH, "utf8"),
  ]);

  const patchEntries = parsePatchInput(patchRaw);
  if (patchEntries.length === 0) {
    throw new Error("Patch input contains no entries.");
  }

  let sql = sqlRaw;
  const patchedIds = [];
  const skippedIds = [];

  for (const { id, lyrics } of patchEntries) {
    const idNeedle = new RegExp(`VALUES\\s*\\(\\s*\\n\\s*${id},\\s*\\n`, "m");
    if (!idNeedle.test(sql)) {
      throw new Error(`No INSERT found for id ${id}.`);
    }

    const blockWithNeedsReviewRe = new RegExp(
      `VALUES\\s*\\(\\s*\\n\\s*${id},\\s*\\n[\\s\\S]*?\\n\\s*'NEEDS_REVIEW',\\s*\\n\\s*'\\[`,
      "m",
    );

    if (!blockWithNeedsReviewRe.test(sql)) {
      skippedIds.push(id);
      continue;
    }

    sql = replaceLyricsForId(sql, id, lyrics);
    patchedIds.push(id);
  }

  await writeFile(SQL_PATH, sql, "utf8");

  console.log(`Patched ${patchedIds.length} row(s): ${patchedIds.join(", ") || "(none)"}`);
  if (skippedIds.length > 0) {
    console.log(`Skipped non-NEEDS_REVIEW row(s): ${skippedIds.join(", ")}`);
  }
  console.log(`Updated file: ${SQL_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
