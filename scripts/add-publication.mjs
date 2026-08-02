#!/usr/bin/env node
// Draft a publications.json record from a DOI.
//
//   npm run add-pub -- 10.1021/acsnano.4c10796
//   npm run add-pub -- 10.26434/chemrxiv-2025-abcde --status "In revision"
//
// Metadata comes from Crossref. The record is inserted newest-first and left
// with a TODO summary, because the one-sentence summary is yours to write.
// Always run `npm test` afterwards — the schema is the real gate.

import { readFileSync, writeFileSync } from "node:fs";

const DATA = new URL("../src/data/publications.json", import.meta.url);
const ME = "Hao Liu";
const MEMBER_ID = "hao-liu";

const args = process.argv.slice(2);
const doi = args.find((a) => !a.startsWith("--"))?.replace(/^https?:\/\/doi\.org\//, "");
const statusIndex = args.indexOf("--status");
const manuscriptStatus = statusIndex === -1 ? undefined : args[statusIndex + 1];

if (!doi) {
  console.error("Usage: npm run add-pub -- <doi> [--status \"Submitted\"|\"In revision\"]");
  process.exit(1);
}

const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
  headers: { "User-Agent": "hao-liu-research-site/1.0 (mailto:leoliuh127@gmail.com)" },
});
if (!res.ok) {
  console.error(`Crossref lookup failed for ${doi} (HTTP ${res.status}).`);
  console.error("Check the DOI, or add the record by hand following CONTENT.md.");
  process.exit(1);
}
const m = (await res.json()).message;

const year = (m.published ?? m.issued)["date-parts"][0][0];
const venue = (m["short-container-title"]?.[0] || m["container-title"]?.[0] || m.institution?.[0]?.name || "").trim();
const isPreprint = m.type === "posted-content" || m.subtype === "preprint";
const isEditorial = /editorial|news|comment/i.test(m.type) || /news\s*&\s*views/i.test(m.title?.[0] ?? "");

const authors = (m.author ?? []).map((a) => {
  const name = [a.given, a.family].filter(Boolean).join(" ").trim() || a.name || "";
  return name === ME ? { name, memberId: MEMBER_ID } : { name };
});
const mine = authors.some((a) => a.memberId);
if (!mine) {
  console.warn(`! "${ME}" not found in the Crossref author list — check the name spelling and set memberId/memberIds by hand.`);
}

// Existing records use an en dash in page ranges; Crossref returns a hyphen.
const pageRange = [m.volume, m.page?.replace(/-/g, "–")].filter(Boolean).join(", ");

const slug = `${(m.title?.[0] ?? "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").split("-").filter(Boolean).slice(0, 3).join("-")}-${year}`;

const record = {
  id: slug,
  title: m.title?.[0] ?? "",
  authors,
  memberIds: mine ? [MEMBER_ID] : [],
  year,
  venue,
  ...(isPreprint ? {} : { volumePages: pageRange }),
  kind: isPreprint ? "preprint" : isEditorial ? "commentary" : "article",
  recordStatus: isPreprint ? "preprint-not-peer-reviewed" : isEditorial ? "editorial" : "peer-reviewed",
  ...(isPreprint && manuscriptStatus ? { manuscriptStatus } : {}),
  doi: m.DOI,
  url: `https://doi.org/${m.DOI}`,
  featured: false,
  summary: "TODO: one sentence saying what this paper established.",
  topics: [],
  provenance: {
    canonicalSource: { label: "Publisher DOI record", url: `https://doi.org/${m.DOI}` },
    sourceCheckedAt: new Date().toISOString().slice(0, 10),
  },
};

const file = JSON.parse(readFileSync(DATA, "utf8"));
const list = Array.isArray(file) ? file : file.publications;

if (list.some((p) => p.doi === record.doi)) {
  console.error(`Already present: ${record.doi}`);
  process.exit(1);
}
let at = list.findIndex((p) => p.year < record.year);
if (at === -1) at = list.length;
list.splice(at, 0, record);

writeFileSync(DATA, `${JSON.stringify(file, null, 2)}\n`);

console.log(`Added "${record.title.slice(0, 60)}" as ${record.id}`);
console.log(`  ${record.kind} · ${record.venue} · ${record.year}${record.volumePages ? ` · ${record.volumePages}` : ""}`);
console.log(`  ${authors.length} authors, position ${authors.findIndex((a) => a.memberId) + 1 || "?"} for ${ME}`);
console.log("\nNext:");
console.log("  1. Write the `summary` sentence (currently TODO).");
console.log("  2. Add `contributions` marks if you are equal-contribution or corresponding.");
console.log("  3. Set `topics`, and `featured`/`selectedOrder` only if it belongs on the home page.");
console.log("  4. npm test");
