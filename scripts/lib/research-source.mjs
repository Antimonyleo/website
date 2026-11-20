// Shared validation for src/data/research.ts, used by both the full release
// gate (scripts/validate-build.mjs) and the fast standalone check
// (scripts/validate-research.mjs). Keeping one copy means editing research.ts
// gets the same rule set whether you run the full `npm test` or just want an
// instant check while writing a new research group or figure.

import { access } from "node:fs/promises";
import { resolve } from "node:path";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const FIGURE_KINDS = new Set(["photograph", "paper-figure", "schematic"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

// Before the JSON migration, `as const satisfies Record<string, ResearchFigureData>`
// gave this for free at `astro check` time. A plain JSON import loses that, so this
// function re-covers the field shapes (not just the cross-references above) — a
// typo'd kind or a missing alt/caption should fail here, not ship silently.
function validateFigureShape(key, figure, report) {
  if (typeof figure !== "object" || figure === null) {
    report(`research source: figure ${key} must be an object`);
    return;
  }
  if (!FIGURE_KINDS.has(figure.kind)) {
    report(
      `research source: figure ${key} has an invalid kind (expected "photograph", "paper-figure" or "schematic", got ${JSON.stringify(figure.kind)})`,
    );
  }
  if (!isNonEmptyString(figure.src)) {
    report(`research source: figure ${key} needs a non-empty src`);
  }
  if (figure.width !== undefined && (!isFiniteNumber(figure.width) || figure.width <= 0)) {
    report(`research source: figure ${key} needs a positive numeric width`);
  }
  if (figure.height !== undefined && (!isFiniteNumber(figure.height) || figure.height <= 0)) {
    report(`research source: figure ${key} needs a positive numeric height`);
  }
  if (!isNonEmptyString(figure.alt)) {
    report(`research source: figure ${key} needs non-empty alt text`);
  }
  if (!isNonEmptyString(figure.caption)) {
    report(`research source: figure ${key} needs a non-empty caption`);
  }
  if (figure.captionLabel !== undefined && !isNonEmptyString(figure.captionLabel)) {
    report(`research source: figure ${key} captionLabel must be a non-empty string when present`);
  }
  if (figure.credit !== undefined && !isNonEmptyString(figure.credit)) {
    report(`research source: figure ${key} credit must be a non-empty string when present`);
  }
  if (figure.source !== undefined) {
    if (typeof figure.source !== "object" || figure.source === null) {
      report(`research source: figure ${key} source must be an object when present`);
    } else {
      if (!isNonEmptyString(figure.source.publicationId)) {
        report(`research source: figure ${key} source needs a non-empty publicationId`);
      }
      if (figure.source.locator !== undefined && !isNonEmptyString(figure.source.locator)) {
        report(`research source: figure ${key} source.locator must be a non-empty string when present`);
      }
      if (figure.source.showDoi !== undefined && typeof figure.source.showDoi !== "boolean") {
        report(`research source: figure ${key} source.showDoi must be a boolean when present`);
      }
    }
  }
}

function validateGroupShape(group, report) {
  const label = group?.id ?? "unknown";
  for (const field of ["index", "label", "title", "description"]) {
    if (!isNonEmptyString(group?.[field])) {
      report(`research source: group ${label} needs a non-empty ${field}`);
    }
  }
  if (!Array.isArray(group?.publications)) {
    report(`research source: group ${label} needs a non-empty publications array`);
  } else {
    for (const reference of group.publications) {
      if (!isNonEmptyString(reference?.publicationId) || !isNonEmptyString(reference?.role)) {
        report(`research source: group ${label} has a publications entry missing publicationId or role`);
      }
    }
  }
  for (const reference of group?.collaborations ?? []) {
    if (!isNonEmptyString(reference?.publicationId) || !isNonEmptyString(reference?.label)) {
      report(`research source: group ${label} has a collaborations entry missing publicationId or label`);
    }
  }
  if (group?.figureIds !== undefined && !Array.isArray(group.figureIds)) {
    report(`research source: group ${label} figureIds must be an array when present`);
  }
  if (group?.story !== undefined) {
    const story = group.story;
    const storyLabel = story?.id ?? `${label}'s story`;
    if (typeof story !== "object" || story === null) {
      report(`research source: group ${label} story must be an object when present`);
    } else {
      for (const field of ["eyebrow", "title", "description"]) {
        if (!isNonEmptyString(story[field])) {
          report(`research source: story ${storyLabel} needs a non-empty ${field}`);
        }
      }
      if (
        !Array.isArray(story.paragraphs) ||
        story.paragraphs.length === 0 ||
        story.paragraphs.some((paragraph) => !isNonEmptyString(paragraph))
      ) {
        report(`research source: story ${storyLabel} needs at least one non-empty paragraph`);
      }
      if (story.photoFigureIds !== undefined && !Array.isArray(story.photoFigureIds)) {
        report(`research source: story ${storyLabel} needs a photoFigureIds array`);
      }
      if (
        story.historicalSources !== undefined && (!Array.isArray(story.historicalSources) ||
        story.historicalSources.some(
          (source) => !isNonEmptyString(source?.label) || !isNonEmptyString(source?.href),
        ))
      ) {
        report(`research source: story ${storyLabel} needs historicalSources entries with a label and href`);
      }
    }
  }
}

/**
 * Load src/data/research.ts and check its internal shape and cross-references
 * against the known-good publication IDs.
 *
 * @param {object} params
 * @param {(message: string) => void} params.report - called once per problem found.
 * @param {Set<string>} params.publicationIds - valid publication IDs from publications.json.
 * @returns {Promise<{ figureIds: string[], groups: unknown[] }>}
 */
export async function loadResearchSource({ report, publicationIds }) {
  const researchFile = resolve("src/data/research.ts");
  if (!(await exists(researchFile))) {
    report("research source is missing: src/data/research.ts");
    return { figureIds: [], groups: [] };
  }

  let research;
  try {
    research = await import(new URL("../../src/data/research.ts", import.meta.url));
  } catch (error) {
    report(`research source could not be loaded (${error.message})`);
    return { figureIds: [], groups: [] };
  }

  const figures =
    research.researchFigures && typeof research.researchFigures === "object"
      ? Object.entries(research.researchFigures)
      : [];
  const groups = Array.isArray(research.researchScaleGroups)
    ? research.researchScaleGroups
    : [];

  const figureKeys = new Set(figures.map(([key]) => key));
  const figureIds = figures
    .map(([, figure]) => figure?.id)
    .filter((id) => typeof id === "string" && id);

  for (const [key, figure] of figures) {
    validateFigureShape(key, figure, report);
    if (
      typeof figure?.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(figure.id)
    ) {
      report(`research source: figure ${key} needs a local kebab-case id`);
    }
    if (
      figure?.source?.publicationId &&
      !publicationIds.has(figure.source.publicationId)
    ) {
      report(
        `research source: figure ${key} references missing publication ${figure.source.publicationId}`,
      );
    }
  }
  if (new Set(figureIds).size !== figureIds.length) {
    report("research source: figure ids must be unique");
  }

  const groupIds = groups.map((group) => group?.id);
  if (
    groupIds.some(
      (id) => typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id),
    )
  ) {
    report("research source: every research group needs a local kebab-case id");
  }
  if (new Set(groupIds).size !== groupIds.length) {
    report("research source: research group ids must be unique");
  }

  for (const group of groups) {
    validateGroupShape(group, report);
    const referencedFigureKeys = [
      ...(group?.figureIds ?? []),
      ...(group?.story?.photoFigureIds ?? []),
      group?.story?.paperFigureId,
    ].filter(Boolean);
    for (const figureKey of referencedFigureKeys) {
      if (!figureKeys.has(figureKey)) {
        report(
          `research source: group ${group?.id ?? "unknown"} references missing figure ${figureKey}`,
        );
      }
    }

    const referencedPublicationIds = [
      ...(group?.publications ?? []).map((item) => item?.publicationId),
      ...(group?.collaborations ?? []).map((item) => item?.publicationId),
    ].filter(Boolean);
    for (const publicationId of referencedPublicationIds) {
      if (!publicationIds.has(publicationId)) {
        report(
          `research source: group ${group?.id ?? "unknown"} references missing publication ${publicationId}`,
        );
      }
    }
  }

  const overviewFigure = research.researchPage.directions?.figureId;
  if (overviewFigure && !figureKeys.has(overviewFigure)) {
    report(`research source: Philosophy and vision references missing figure ${overviewFigure}`);
  }

  for (const id of research.researchPage.foundations.publicationIds ?? []) {
    if (!publicationIds.has(id)) report(`Earlier work: remove the link to deleted publication ${id}`);
  }
  for (const [id, figure] of figures) {
    const imagePath = resolve("public", figure.src.replace(/^[/]+/, ""));
    if (!imagePath.startsWith(resolve("public/images") + "/") || !(await exists(imagePath))) report(`Figure ${id}: choose an existing public image`);
    if (!figure.credit && !figure.source?.publicationId) report(`Figure ${id}: add a credit or select its source paper`);
  }
  return { figureIds, groups, overviewFigureId: overviewFigure?.replace(/\.json$/, "") };
}
