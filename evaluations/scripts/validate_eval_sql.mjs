#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "..", "..");
const SQL_PATH = resolve(ROOT, "evaluations/evaluation_set_inserts.sql");

function unique(values) {
  return [...new Set(values)];
}

async function main() {
  const sql = await readFile(SQL_PATH, "utf8");

  const insertMatches = Array.from(
    sql.matchAll(/INSERT INTO generate_critique_eval_set/g),
  );
  const idMatches = Array.from(sql.matchAll(/VALUES\s*\(\s*\n\s*(\d+),/g)).map((m) =>
    Number(m[1]),
  );
  const needsReviewMatches = Array.from(sql.matchAll(/'NEEDS_REVIEW'/g));

  const insertCount = insertMatches.length;
  const ids = idMatches;
  const uniqueIds = unique(ids).sort((a, b) => a - b);

  const expectedIds = Array.from({ length: 60 }, (_, i) => i + 1);
  const missingIds = expectedIds.filter((id) => !uniqueIds.includes(id));
  const duplicateIds = uniqueIds.filter((id) => ids.filter((x) => x === id).length > 1);

  console.log(`Insert count: ${insertCount}`);
  console.log(`ID count: ${ids.length}`);
  console.log(`Unique IDs: ${uniqueIds.length}`);
  console.log(`NEEDS_REVIEW placeholders: ${needsReviewMatches.length}`);

  if (insertCount !== 60) {
    throw new Error(`Expected 60 INSERT statements, found ${insertCount}.`);
  }
  if (ids.length !== 60) {
    throw new Error(`Expected 60 VALUES id rows, found ${ids.length}.`);
  }
  if (missingIds.length > 0) {
    throw new Error(`Missing IDs: ${missingIds.join(", ")}`);
  }
  if (duplicateIds.length > 0) {
    throw new Error(`Duplicate IDs: ${duplicateIds.join(", ")}`);
  }
  if (needsReviewMatches.length > 0) {
    throw new Error("SQL still contains NEEDS_REVIEW placeholders.");
  }

  console.log("Validation passed: 60 fully populated rows, IDs 1-60, no placeholders.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
