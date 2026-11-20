// Shared by Astro and the release checks. CMS files are the only editable source.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";

export function readRecords(directory: string): Record<string, any>[] {
  let names: string[];
  try { names = readdirSync(resolve(directory)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  return names.filter((name) => name.endsWith(".json"))
    .sort().map((name) => ({ ...JSON.parse(readFileSync(resolve(directory, name), "utf8")), id: name.slice(0, -5) }));
}

export const referenceId = (value: string) => value.replace(/\.json$/, "");

export function normalizePublication(input: any) {
  if (!input || typeof input !== "object") return input;
  const record = structuredClone(input);
  const doi = (value: string) => value?.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  record.doi = doi(record.doi);
  record.url = `https://doi.org/${record.doi}`;
  // Keep the linked preprint's citation intact while recording journal acceptance.
  if (record.kind !== "preprint" || !record.acceptedIn?.trim()) delete record.acceptedIn;
  else record.acceptedIn = record.acceptedIn.trim();
  const statuses: Record<string, string> = { article: "peer-reviewed", commentary: "editorial", preprint: "preprint-not-peer-reviewed" };
  record.recordStatus = record.acceptedIn ? "accepted" : statuses[record.kind];
  record.featured ??= false;
  record.topics ??= [];
  const person = parse(readFileSync(resolve("src/content/people/hao-liu.md"), "utf8").split("---")[1]);
  for (const author of record.authors ?? []) {
    if (author.name === person.name) author.memberId = "hao-liu";
    for (const contribution of author.contributions ?? []) {
      const bases: Record<string, string> = { "equal-contribution": "explicit-equal-contribution-note", "corresponding-author": "explicit-corresponding-author-note" };
      contribution.basis = bases[contribution.role];
      contribution.sourceUrl ||= record.url;
    }
  }
  record.memberIds = [...new Set((record.authors ?? []).map((author: any) => author.memberId).filter(Boolean))];
  if (record.kind === "preprint") delete record.volumePages;
  if (record.kind !== "preprint" || record.acceptedIn) delete record.manuscriptStatus;
  if (!record.featured) delete record.selectedOrder;
  if (record.provenance) record.provenance.canonicalSource = {
    label: record.provenance.canonicalSource?.label || "Publisher DOI record", url: record.url,
  };
  for (const item of record.relatedItems ?? []) {
    item.doi = doi(item.doi);
    item.url = `https://doi.org/${item.doi}`;
    item.relation = "author-correction";
    item.counted = false;
  }
  return record;
}

export function readPublications() {
  return readRecords("src/content/publications").map(normalizePublication)
    .sort((a, b) => b.year - a.year || (a.order ?? 9999) - (b.order ?? 9999) || a.id.localeCompare(b.id));
}
