#!/usr/bin/env node
/**
 * Robust source map extractor - handles webpack:// paths, Windows paths, etc.
 * Usage: node extract-sourcemap.mjs file.min.js.map ./recovered-app
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const mapFile = process.argv[2];
const outDir = process.argv[3] || "./recovered-app";

if (!mapFile) {
  console.error("Usage: node extract-sourcemap.mjs <source-map-file> [output-dir]");
  process.exit(1);
}

console.log(`Parsing ${mapFile} ...`);
const map = JSON.parse(readFileSync(mapFile, "utf8"));

if (!map.sources || !map.sourcesContent) {
  console.error("❌ No sourcesContent found in this map file.");
  process.exit(1);
}

console.log(`Found ${map.sources.length} sources...`);

let written = 0;
let skipped = 0;

for (let i = 0; i < map.sources.length; i++) {
  const src = map.sources[i];
  const content = map.sourcesContent[i];

  if (!content || src.includes("node_modules")) {
    skipped++;
    continue;
  }

  // === ROBUST PATH CLEANING ===
  let cleaned = src
    .replace(/^webpack:\/+/, "")           // remove webpack:// or webpack:/
    .replace(/^file:\/+/, "")              // remove file://
    .replace(/^[A-Za-z]:[\\/]/, "")        // remove C:\ or D:\
    .replace(/^[\\/]+/, "")                // remove leading / or \
    .replace(/:/g, "_")                    // replace any remaining colons
    .replace(/\\/g, "/")                   // normalize slashes
    .replace(/\/+/g, "/");                 // collapse multiple slashes

  // Final safety: remove any remaining weird characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9_.\-/]/g, "_");

  if (!cleaned) {
    skipped++;
    continue;
  }

  const outPath = resolve(outDir, cleaned);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content);
  written++;
}

console.log(`✅ Done! Wrote ${written} files to ${outDir} (skipped ${skipped})`);