#!/usr/bin/env node
// Fast, standalone check for src/data/research.ts.
//
//   npm run check:research
//
// Catches broken figure/publication cross-references, duplicate or malformed
// IDs, and empty collections in seconds, without waiting for `npm run build`.
// This is the research.ts equivalent of the red squiggles publications.json
// gets from its JSON Schema — same rules as `npm test`, just faster to reach
// while editing. It reads only source files, so it is safe to run any time.

import { readPublications } from "../src/lib/content-source.ts";
import { loadResearchSource } from "./lib/research-source.mjs";

const errors = [];
const report = (message) => errors.push(message);

let publications;
try {
  publications = readPublications();
} catch (error) {
  console.error(`Could not read src/content/publications/ (${error.message}).`);
  process.exit(1);
}
if (!Array.isArray(publications)) {
  console.error("src/content/publications/ must be a top-level array.");
  process.exit(1);
}

const publicationIds = new Set(publications.map((publication) => publication.id));

const { figureIds, groups } = await loadResearchSource({ report, publicationIds });

if (errors.length > 0) {
  console.error(`research source: ${errors.length} problem(s) found\n`);
  for (const message of errors) {
    console.error(`  - ${message}`);
  }
  process.exitCode = 1;
}

if (errors.length === 0) console.log(
  `research source: OK — ${figureIds.length} figure(s) and ${groups.length} group(s) reference valid IDs.`,
);
