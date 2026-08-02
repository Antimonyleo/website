import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const rootDir = resolve(".");
const distDir = resolve("dist");
const sourceDirs = [resolve("src"), resolve("public")];
const publicationsFile = resolve("src/data/publications.json");
const basePath = "/website/";
const publicOrigin = "https://antimonyleo.github.io";
const publicBase = `${publicOrigin}${basePath}`;
const doiPattern = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const knownPublicationTitle =
  "Inverse design of a pyrochlore lattice of DNA origami through model-driven experiments";
const correctionDoi = "10.1038/s41557-020-00611-z";
const publicationBibFile = resolve(
  "dist/publications/hao-liu-publications.bib",
);
const expectedResearchStories = new Map([
  ["tetrahedral-lattices-2026", "programmable-assembly"],
  ["polycubes-2025", "programmable-assembly"],
  ["pyrochlore-2024", "programmable-assembly"],
  ["dna-origami-tessellations-2023", "programmable-assembly"],
  ["rna-strand-displacement-2021", "rna-strand-displacement"],
]);
const expectedFeaturedSignificance = new Map([
  [
    "pyrochlore-2024",
    "It demonstrates a model-driven route for carrying designed particle-interaction rules into the experimental realization of a complex three-dimensional DNA-origami lattice.",
  ],
  [
    "tetrahedral-lattices-2026",
    "It shows that changing only the programmed vertex interactions of one DNA-origami tetrahedron can select distinct open crystal topologies without redesigning the scaffold itself.",
  ],
  [
    "polycubes-2025",
    "It provides an inverse-design route to finite objects and extended lattices using a minimal target-specific set of DNA-origami cube types while explicitly avoiding competing assemblies.",
  ],
  [
    "rna-strand-displacement-2021",
    "It supplies experimentally grounded design guidance for tuning RNA:RNA strand-displacement kinetics through toehold length, substrate-end placement, and mismatch position.",
  ],
]);
const approvedContributions = new Map([
  [
    "tetrahedral-lattices-2026",
    new Map([
      ["Hao Liu", ["corresponding-author"]],
      ["John Russo", ["corresponding-author"]],
      ["Petr Šulc", ["corresponding-author"]],
    ]),
  ],
  [
    "polycubes-2025",
    new Map([
      ["Thong Diep", ["equal-contribution"]],
      ["Hao Liu", ["equal-contribution", "corresponding-author"]],
      ["Hao Yan", ["corresponding-author"]],
      ["Petr Šulc", ["corresponding-author"]],
    ]),
  ],
]);
const scholarUrl =
  "https://scholar.google.com/citations?hl=en&user=Yo-IDJwAAAAJ&view_op=list_works&sortby=pubdate";
const publicEmail = "leoliuh127@gmail.com";
const errors = [];
const warnings = [];
let sourcePublications = [];
let sourceResearchFigureIds = [];
const defaultPrivateGuardFile = resolve("files/site-private-guard-terms.txt");

const expectedRoutes = new Map([
  ["Home", "index.html"],
  ["Research", join("research", "index.html")],
  ["Publications", join("publications", "index.html")],
  ["Experience", join("experience", "index.html")],
  ["Contact", join("contact", "index.html")],
  ["Not found", "404.html"],
]);

const textExtensions = new Set([
  ".astro",
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".txt",
  ".xml",
]);

const genericPublicSafetyPatterns = [
  { label: "manuscript in preparation", pattern: /\bmanuscripts?\s+in\s+preparation\b/i },
  {
    label: "private research-statement document path",
    pattern:
      /(?:^|[("'`\s])(?:\.\.?[/\\])?[^"'`\s/\\]*research[-_ ]?statements?[^"'`\s/\\]*\.(?:pdf|docx?)(?=$|[)"'`\s])/im,
  },
  {
    label: "private CV document path",
    pattern:
      /(?:^|[("'`\s])(?:\.\.?[/\\])?[^"'`\s/\\]*(?:cv|curriculum[-_ ]?vitae)[^"'`\s/\\]*\.(?:pdf|docx?)(?=$|[)"'`\s])/im,
  },
  { label: "private files directory", pattern: /(?:^|[("'`\s])(?:\.\.?\/)?files\//im },
  {
    label: "absolute user-home path",
    pattern: /\/(?:home|Users)\/[^/\\\s"'`]+(?:\/|\\)/i,
  },
];

function report(message) {
  errors.push(message);
}

function advise(message) {
  warnings.push(message);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function filesUnder(directory) {
  if (!(await exists(directory))) {
    return [];
  }
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return nested.flat();
}

function displayPath(path) {
  return relative(rootDir, path).split(sep).join("/");
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePrivateGuardTerms(value) {
  return value
    .split(/\r?\n/)
    .map((term) => term.trim())
    .filter((term) => term && !term.startsWith("#"));
}

async function loadPrivateGuardTerms() {
  const configuredFile = process.env.SITE_PRIVATE_GUARD_FILE
    ? resolve(process.env.SITE_PRIVATE_GUARD_FILE)
    : defaultPrivateGuardFile;
  const sources = [];

  if (process.env.SITE_PRIVATE_GUARD_TERMS) {
    sources.push({
      label: "SITE_PRIVATE_GUARD_TERMS",
      terms: parsePrivateGuardTerms(process.env.SITE_PRIVATE_GUARD_TERMS),
    });
  }

  try {
    sources.push({
      label: displayPath(configuredFile),
      terms: parsePrivateGuardTerms(await readFile(configuredFile, "utf8")),
    });
  } catch (error) {
    if (error.code !== "ENOENT") {
      report(
        `could not read optional private guard file ${displayPath(configuredFile)} (${error.message})`,
      );
    }
  }

  const uniqueTerms = new Map();
  for (const source of sources) {
    for (const term of source.terms) {
      if (term.length < 3) {
        report(
          `private guard input ${source.label}: terms must contain at least 3 characters`,
        );
        continue;
      }
      const key = term.toLocaleLowerCase("en-US");
      if (!uniqueTerms.has(key)) {
        uniqueTerms.set(key, { term, source: source.label });
      }
    }
  }
  return [...uniqueTerms.values()];
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'");
}

function visibleHtml(html) {
  return html
    .replace(/<head\b[\s\S]*?<\/head>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

function openingTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    (match) => match[0],
  );
}

function attribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? match[1] ?? match[2] : undefined;
}

function localTarget(url) {
  let decoded;
  try {
    decoded = decodeURI(url.split(/[?#]/, 1)[0]);
  } catch {
    return undefined;
  }
  const relativeUrl = decoded.slice(basePath.length);
  if (!relativeUrl || decoded.endsWith("/")) {
    return join(distDir, relativeUrl, "index.html");
  }
  return join(distDir, relativeUrl);
}

function jsonLdObjects(html, label) {
  const objects = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      objects.push(JSON.parse(decodeHtml(match[1])));
    } catch (error) {
      report(`${label}: invalid JSON-LD (${error.message})`);
    }
  }
  return objects;
}

function findTypedObjects(value, type, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      findTypedObjects(item, type, found);
    }
  } else if (value && typeof value === "object") {
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.includes(type)) {
      found.push(value);
    }
    for (const child of Object.values(value)) {
      findTypedObjects(child, type, found);
    }
  }
  return found;
}

function validateHeadingOutline(html, label) {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!mainMatch) {
    return;
  }
  const levels = [...mainMatch[1].matchAll(/<h([1-6])\b/gi)].map((match) =>
    Number(match[1]),
  );
  if (levels.length === 0) {
    report(`${label}: main landmark has no heading`);
    return;
  }
  if (levels[0] !== 1) {
    report(`${label}: the first heading in main must be h1`);
  }
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      report(
        `${label}: heading level jumps from h${levels[index - 1]} to h${levels[index]}`,
      );
    }
  }
}

function validateSemantics(html, label) {
  const body = visibleHtml(html);
  if (!/<html\b[^>]*\blang=(?:"en"|'en')/i.test(html)) {
    report(`${label}: expected html[lang="en"]`);
  }
  if (countMatches(body, /<main\b/gi) !== 1) {
    report(`${label}: expected exactly one main landmark`);
  }
  if (!/<main\b[^>]*\bid=(?:"main-content"|'main-content')/i.test(body)) {
    report(`${label}: main landmark must have id="main-content"`);
  }
  if (!/<a\b[^>]*\bhref=(?:"#main-content"|'#main-content')[^>]*>\s*Skip to content\s*<\/a>/i.test(body)) {
    report(`${label}: expected a skip link targeting #main-content`);
  }
  if (!/<header\b/i.test(body) || !/<footer\b/i.test(body)) {
    report(`${label}: expected header and footer landmarks`);
  }
  if (countMatches(body, /<h1\b/gi) !== 1) {
    report(`${label}: expected exactly one h1`);
  }
  for (const nav of openingTags(body, "nav")) {
    if (!attribute(nav, "aria-label") && !attribute(nav, "aria-labelledby")) {
      report(`${label}: every nav landmark must have an accessible label`);
    }
  }
  validateHeadingOutline(body, label);

  const ids = openingTags(body, "[a-z][a-z0-9:-]*")
    .map((tag) => attribute(tag, "id"))
    .filter(Boolean);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  for (const id of duplicateIds) {
    report(`${label}: duplicate id="${id}"`);
  }
  const idSet = new Set(ids);
  for (const tag of openingTags(body, "[a-z][a-z0-9:-]*")) {
    for (const referenceAttribute of ["aria-labelledby", "aria-describedby"]) {
      const references = (attribute(tag, referenceAttribute) ?? "")
        .split(/\s+/)
        .filter(Boolean);
      for (const reference of references) {
        if (!idSet.has(reference)) {
          report(
            `${label}: ${referenceAttribute} references missing id="${reference}"`,
          );
        }
      }
    }
  }

  for (const anchor of openingTags(body, "a")) {
    if (attribute(anchor, "target") !== "_blank") {
      continue;
    }
    const rel = attribute(anchor, "rel") ?? "";
    if (!rel.split(/\s+/).includes("noopener")) {
      report(`${label}: target="_blank" link is missing rel="noopener"`);
    }
  }
}

function researchFigures(html) {
  return [...html.matchAll(
    /<figure\b[^>]*\bdata-research-figure(?:=(?:"[^"]*"|'[^']*'))?[^>]*>[\s\S]*?<\/figure>/gi,
  )].map((match) => match[0]);
}

function validateResearchFigures(researchHtml) {
  const figures = researchFigures(researchHtml);
  const expectedFigureSources = new Map([
    ["polycubes-public-evidence", "10.26434/chemrxiv-2025-qbk3f"],
    ["pyrochlore-published-evidence", "10.1126/science.adl5549"],
    ["meteor-crater-field-photo", "Photo by Hao Liu"],
    ["canyon-diablo-specimen", "Photo by Hao Liu"],
    [
      "hexagonal-diamond-public-evidence",
      "10.26434/chemrxiv.15004426/v1",
    ],
  ]);
  const figuresById = new Map();
  for (const [index, figure] of figures.entries()) {
    const opening = figure.match(/<figure\b[^>]*>/i)?.[0] ?? "";
    const figureId = attribute(opening, "data-research-figure");
    if (!figureId) {
      report(`research figure ${index + 1}: data-research-figure needs a stable value`);
    } else {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(figureId)) {
        report(
          `research figure ${figureId}: data-research-figure must be a local kebab-case ID`,
        );
      }
      const occurrences = figuresById.get(figureId) ?? [];
      occurrences.push(figure);
      figuresById.set(figureId, occurrences);
    }
    if (!/<figcaption\b/i.test(figure)) {
      report(`research figure ${figureId ?? index + 1}: missing figcaption`);
    }
    const hasTextAlternative =
      /\bdata-figure-description(?:=|\s|>)/i.test(figure) ||
      /<img\b[^>]*\balt=(?:"[^"]+"|'[^']+')/i.test(figure) ||
      /<svg\b[^>]*(?:\baria-label=(?:"[^"]+"|'[^']+')|\baria-labelledby=(?:"[^"]+"|'[^']+'))/i.test(
        figure,
      );
    if (!hasTextAlternative) {
      report(
        `research figure ${figureId ?? index + 1}: missing a non-empty text alternative`,
      );
    }
  }

  for (const [figureId, occurrences] of figuresById) {
    if (occurrences.length !== 1) {
      report(
        `research page: data-research-figure="${figureId}" must occur exactly once`,
      );
    }
  }

  const uniqueFigureIds = new Set(figuresById.keys());
  if (
    sourceResearchFigureIds.length > 0 &&
    (uniqueFigureIds.size !== sourceResearchFigureIds.length ||
      sourceResearchFigureIds.some((id) => !uniqueFigureIds.has(id)))
  ) {
    report(
      "research page: rendered figure ids must match src/data/research.ts",
    );
  }
  if (
    uniqueFigureIds.size !== expectedFigureSources.size ||
    [...expectedFigureSources.keys()].some((id) => !uniqueFigureIds.has(id))
  ) {
    advise(
      `Design audit: the Research page changed from the approved evidence/field figure set; found ${[
        ...uniqueFigureIds,
      ].join(", ") || "none"}`,
    );
  }

  const visibleResearch = decodeHtml(visibleHtml(researchHtml));
  if (!visibleResearch.includes("10.1021/acssynbio.1c00336")) {
    report("research page: strand-displacement source DOI is missing");
  }
  for (const term of [
    "toehold length",
    "substrate-end placement",
    "mismatch position",
    "RNA:DNA",
  ]) {
    if (!visibleResearch.toLowerCase().includes(term.toLowerCase())) {
      report(`research page: missing tested strand-displacement variable “${term}”`);
    }
  }

  for (const [figureId, sourceMarker] of expectedFigureSources) {
    const figure = figuresById.get(figureId)?.[0];
    if (!figure) {
      continue;
    }
    if (!decodeHtml(figure).includes(sourceMarker)) {
      report(`${figureId}: approved source marker is missing`);
    }
    if (!/<img\b[^>]*\balt=(?:"[^"]+"|'[^']+')/i.test(figure)) {
      report(`${figureId}: figure needs descriptive alt text`);
    }
  }

  const chapterIds = [
    ...researchHtml.matchAll(
      /\bdata-research-chapter=(?:"([^"]+)"|'([^']+)')/gi,
    ),
  ].map((match) => match[1] ?? match[2]);
  const expectedChapterIds = [
    "programmable-assembly",
    "rna-strand-displacement",
  ];
  if (
    chapterIds.length !== expectedChapterIds.length ||
    expectedChapterIds.some((id, index) => chapterIds[index] !== id)
  ) {
    report(
      `research page: assembly must lead the two research chapters; found ${chapterIds.join(", ") || "none"}`,
    );
  }

  const excludedResearchTopics = [
    "excitonic",
    "light harvesting",
    "synthetic antibody",
  ];
  for (const term of excludedResearchTopics) {
    if (visibleResearch.toLowerCase().includes(term)) {
      report(`research page: “${term}” must remain off the focused research-program page`);
    }
  }

  const assemblyWorkIds = [
    ...researchHtml.matchAll(
      /\bdata-assembly-work=(?:"([^"]+)"|'([^']+)')/gi,
    ),
  ].map((match) => match[1] ?? match[2]);
  const expectedAssemblyWorkIds = [
    "dna-origami-tessellations-2023",
    "pyrochlore-2024",
    "polycubes-2025",
    "tetrahedral-lattices-2026",
  ];
  if (
    assemblyWorkIds.length !== expectedAssemblyWorkIds.length ||
    expectedAssemblyWorkIds.some((id) => !assemblyWorkIds.includes(id))
  ) {
    report(
      `research page: expected four public assembly outcomes; found ${assemblyWorkIds.join(", ") || "none"}`,
    );
  }
  if (countMatches(researchHtml, /\bNot peer reviewed\b/gi) < 2) {
    report("research page: both assembly preprints need visible not-peer-reviewed labels");
  }

  const collaborativeWorkIds = [
    ...researchHtml.matchAll(
      /\bdata-collaborative-work=(?:"([^"]+)"|'([^']+)')/gi,
    ),
  ].map((match) => match[1] ?? match[2]);
  const expectedCollaborativeWorkIds = [
    "meta-dna-2020",
    "hairygami-2024",
    "finite-state-machine-2022",
  ];
  if (
    collaborativeWorkIds.length !== expectedCollaborativeWorkIds.length ||
    expectedCollaborativeWorkIds.some(
      (id) => !collaborativeWorkIds.includes(id),
    )
  ) {
    report(
      `research page: collaborative experience labels are incomplete; found ${collaborativeWorkIds.join(", ") || "none"}`,
    );
  }

  for (const id of approvedContributions.keys()) {
    const publication = sourcePublications.find((item) => item.id === id);
    const haoAuthor = publication?.authors?.find((author) => author.memberId === "hao-liu");
    const haoRoles = new Set(
      (haoAuthor?.contributions ?? []).map((contribution) => contribution.role),
    );
    const authorshipLabel = haoRoles.has("equal-contribution")
      ? "Co-first and co-corresponding author"
      : "First and co-corresponding author";
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const work = researchHtml.match(
      new RegExp(
        `<article\\b[^>]*\\bdata-assembly-work=(?:"${escapedId}"|'${escapedId}')[^>]*>[\\s\\S]*?<\\/article>`,
        "i",
      ),
    )?.[0];
    if (
      !work ||
      !decodeHtml(work).includes(authorshipLabel) ||
      (publication?.manuscriptStatus &&
        !decodeHtml(work)
          .toLowerCase()
          .includes(publication.manuscriptStatus.toLowerCase()))
    ) {
      report(`${id}: Research page is missing the approved authorship or manuscript status`);
    }
  }

  // The research page must still name the design-through-experiment chain.
  // Wording may evolve; these are the load-bearing methods, not fixed phrasing.
  for (const term of [
    "negative design",
    "patchy-particle",
    "DNA origami",
    "scattering",
    "microscopy",
  ]) {
    if (!visibleResearch.toLowerCase().includes(term.toLowerCase())) {
      report(`research page: methods narrative is missing “${term}”`);
    }
  }
}

function validateResearchPublicationReferences(researchHtml) {
  const publicationIds = new Set(
    sourcePublications.map((publication) => publication.id),
  );
  const referencedIds = [
    ...researchHtml.matchAll(
      /\bdata-(?:assembly|collaborative)-work=(?:"([^"]+)"|'([^']+)')/gi,
    ),
  ].map((match) => match[1] ?? match[2]);

  for (const id of new Set(referencedIds)) {
    if (!publicationIds.has(id)) {
      report(`research page: referenced publication ID does not exist: ${id}`);
    }
  }
}

async function validateResearchSource() {
  const researchFile = resolve("src/data/research.ts");
  if (!(await exists(researchFile))) {
    report("research source is missing: src/data/research.ts");
    return;
  }

  let research;
  try {
    research = await import(new URL("../src/data/research.ts", import.meta.url));
  } catch (error) {
    report(`research source could not be loaded (${error.message})`);
    return;
  }

  const figures =
    research.researchFigures &&
    typeof research.researchFigures === "object"
      ? Object.entries(research.researchFigures)
      : [];
  const groups = Array.isArray(research.researchScaleGroups)
    ? research.researchScaleGroups
    : [];
  if (figures.length === 0) {
    report("research source: researchFigures must be a non-empty record");
  }
  if (groups.length === 0) {
    report("research source: researchScaleGroups must be a non-empty array");
  }

  const publicationIds = new Set(
    sourcePublications.map((publication) => publication.id),
  );
  const figureKeys = new Set(figures.map(([key]) => key));
  const figureIds = figures.map(([, figure]) => figure?.id);
  sourceResearchFigureIds = figureIds.filter(
    (id) => typeof id === "string" && id,
  );

  for (const [key, figure] of figures) {
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
  if (new Set(sourceResearchFigureIds).size !== sourceResearchFigureIds.length) {
    report("research source: figure ids must be unique");
  }

  const groupIds = groups.map((group) => group?.id);
  if (
    groupIds.some(
      (id) =>
        typeof id !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id),
    )
  ) {
    report("research source: every research group needs a local kebab-case id");
  }
  if (new Set(groupIds).size !== groupIds.length) {
    report("research source: research group ids must be unique");
  }

  for (const group of groups) {
    const referencedFigureKeys = [
      group?.figureId,
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
}

async function validatePublicationSource() {
  if (!(await exists(publicationsFile))) {
    report("publication source is missing");
    return;
  }

  let publications;
  try {
    publications = JSON.parse(await readFile(publicationsFile, "utf8"));
  } catch (error) {
    report(`publication source is not valid JSON (${error.message})`);
    return;
  }

  if (!Array.isArray(publications)) {
    report("publication source must be a top-level array");
    return;
  }
  sourcePublications = publications;
  if (publications.length === 0) {
    report("publication source is empty");
  }
  const ids = publications.map((publication) => publication.id);
  const dois = publications.map((publication) => publication.doi?.toLowerCase());
  if (ids.some((id) => typeof id !== "string" || !id.trim())) {
    report("publication source: every record needs a non-empty id");
  }
  if (new Set(ids).size !== ids.length) {
    report("publication source: publication ids must be unique");
  }
  if (dois.some((doi) => typeof doi !== "string" || !doi.trim())) {
    report("publication source: every substantive record needs a DOI");
  }
  if (new Set(dois).size !== dois.length) {
    report("publication source: substantive publication DOIs must be unique");
  }
  const featuredPublications = publications.filter((publication) => publication.featured);
  if (
    featuredPublications.some(
      (publication) => !Number.isInteger(publication.selectedOrder),
    )
  ) {
    report("publication source: every featured record needs an integer selectedOrder");
  }
  const selectedOrders = featuredPublications.map(
    (publication) => publication.selectedOrder,
  );
  if (new Set(selectedOrders).size !== selectedOrders.length) {
    report("publication source: featured selectedOrder values must be unique");
  }
  if (
    publications.some(
      (publication) => !publication.featured && publication.selectedOrder !== undefined,
    )
  ) {
    report("publication source: non-featured records must not define selectedOrder");
  }
  if (!publications.some((publication) => publication.title === knownPublicationTitle)) {
    report(`publication source: known title is missing: ${knownPublicationTitle}`);
  }
  if (publications.some((publication) => publication.doi?.toLowerCase() === correctionDoi)) {
    report("publication source: Meta-DNA Author Correction must not be a substantive record");
  }
  for (let index = 1; index < publications.length; index += 1) {
    if (publications[index].year > publications[index - 1].year) {
      report("publication source: records must remain newest to oldest");
      break;
    }
  }

  for (const publication of publications) {
    const doi = publication.doi;
    if (typeof doi !== "string" || !doiPattern.test(doi)) {
      report(`${publication.id}: DOI syntax is invalid`);
    } else {
      const expectedDoiUrl = `https://doi.org/${doi}`;
      if (publication.url !== expectedDoiUrl) {
        report(`${publication.id}: url must be exactly ${expectedDoiUrl}`);
      }
      if (publication.provenance?.canonicalSource?.url !== expectedDoiUrl) {
        report(
          `${publication.id}: canonical source URL must be exactly ${expectedDoiUrl}`,
        );
      }
    }

    const sourceCheckedAt = publication.provenance?.sourceCheckedAt;
    const parsedSourceDate = new Date(`${sourceCheckedAt}T00:00:00Z`);
    if (
      typeof sourceCheckedAt !== "string" ||
      !isoDatePattern.test(sourceCheckedAt) ||
      Number.isNaN(parsedSourceDate.valueOf()) ||
      !parsedSourceDate.toISOString().startsWith(sourceCheckedAt)
    ) {
      report(`${publication.id}: provenance.sourceCheckedAt must be a valid ISO date (YYYY-MM-DD)`);
    }

    const validRecordShape =
      (publication.kind === "article" &&
        publication.recordStatus === "peer-reviewed" &&
        typeof publication.volumePages === "string" &&
        publication.volumePages.trim() &&
        publication.manuscriptStatus === undefined) ||
      (publication.kind === "commentary" &&
        publication.recordStatus === "editorial" &&
        typeof publication.volumePages === "string" &&
        publication.volumePages.trim() &&
        publication.manuscriptStatus === undefined) ||
      (publication.kind === "preprint" &&
        publication.recordStatus === "preprint-not-peer-reviewed" &&
        publication.volumePages === undefined &&
        (publication.manuscriptStatus === undefined ||
          ["Submitted", "In revision"].includes(publication.manuscriptStatus)));
    if (!validRecordShape) {
      report(
        `${publication.id}: kind, recordStatus, volumePages, and manuscriptStatus form an inconsistent publication state`,
      );
    }

    for (const relatedItem of publication.relatedItems ?? []) {
      const relatedDoi = relatedItem.doi;
      if (typeof relatedDoi !== "string" || !doiPattern.test(relatedDoi)) {
        report(`${publication.id}: related-item DOI syntax is invalid`);
        continue;
      }
      const expectedRelatedUrl = `https://doi.org/${relatedDoi}`;
      if (relatedItem.url !== expectedRelatedUrl) {
        report(
          `${publication.id}: related-item URL must be exactly ${expectedRelatedUrl}`,
        );
      }
    }

    if (!Array.isArray(publication.authors) || publication.authors.length === 0) {
      report(`${publication.id ?? "unknown publication"}: authors must be a non-empty structured array`);
      continue;
    }
    const validAuthors = publication.authors.every(
      (author) =>
        typeof author === "object" &&
        author !== null &&
        typeof author.name === "string" &&
        author.name.trim(),
    );
    if (!validAuthors) {
      report(`${publication.id}: every structured author needs a non-empty name`);
    }
    const haoEntries = publication.authors.filter(
      (author) => author?.memberId === "hao-liu" || author?.isHao === true,
    );
    if (haoEntries.length !== 1) {
      report(`${publication.id}: expected exactly one structured Hao Liu author entry`);
    }
    const expectedAuthorContributions = approvedContributions.get(publication.id);
    for (const author of publication.authors) {
      const contributions = author?.contributions ?? [];
      const actualRoles = contributions.map((item) => item.role).sort();
      const expectedRoles = [...(expectedAuthorContributions?.get(author.name) ?? [])].sort();
      if (new Set(actualRoles).size !== actualRoles.length) {
        report(`${publication.id}: ${author.name} has duplicate contribution roles`);
      }
      for (const contribution of contributions) {
        const expectedBasis =
          contribution.role === "equal-contribution"
            ? "explicit-equal-contribution-note"
            : contribution.role === "corresponding-author"
              ? "explicit-corresponding-author-note"
              : undefined;
        if (
          !expectedBasis ||
          contribution.basis !== expectedBasis ||
          typeof contribution.sourceUrl !== "string" ||
          !/^https:\/\//.test(contribution.sourceUrl) ||
          contribution.sourceUrl !== publication.url
        ) {
          report(
            `${publication.id}: ${author.name} contribution metadata needs a supported role, matching evidence basis, and public HTTPS source`,
          );
        }
      }
      if (
        expectedAuthorContributions &&
        (actualRoles.length !== expectedRoles.length ||
          actualRoles.some((role, index) => role !== expectedRoles[index]))
      ) {
        report(`${publication.id}: ${author.name} contribution marks do not match the approved public manuscript`);
      }
    }
    for (const authorName of expectedAuthorContributions?.keys() ?? []) {
      if (!publication.authors.some((author) => author.name === authorName)) {
        report(`${publication.id}: approved contributing author is missing: ${authorName}`);
      }
    }

    const expectedStory = expectedResearchStories.get(publication.id);
    if (expectedStory) {
      if (publication.researchStoryId !== expectedStory) {
        report(
          `${publication.id}: researchStoryId must be exactly ${expectedStory}`,
        );
      }
    } else if (publication.researchStoryId !== undefined) {
      report(
        `${publication.id}: researchStoryId is not approved without an exact on-site evidence story`,
      );
    }

    const expectedSignificance = expectedFeaturedSignificance.get(publication.id);
    if (expectedSignificance) {
      if (publication.significance !== expectedSignificance) {
        report(
          `${publication.id}: featured significance must match the science-reviewed public-evidence wording`,
        );
      }
    } else if (publication.significance !== undefined) {
      report(
        `${publication.id}: significance copy requires an explicit science review`,
      );
    }
  }

  const metaDna = publications.find((publication) => publication.id === "meta-dna-2020");
  if (!metaDna) {
    report("publication source: Meta-DNA record is missing");
  } else {
    const correctionItems = (metaDna.relatedItems ?? []).filter(
      (item) => item.doi?.toLowerCase() === correctionDoi,
    );
    if (correctionItems.length !== 1) {
      report("publication source: Meta-DNA must nest exactly one Author Correction");
    } else if (
      correctionItems[0].relation !== "author-correction" ||
      correctionItems[0].counted !== false
    ) {
      report(
        "publication source: Meta-DNA Author Correction must use relation=author-correction and counted=false",
      );
    }
  }
}

async function validatePrivacyAndLegacyReferences(files) {
  const privateGuardTerms = await loadPrivateGuardTerms();
  const privateGuardPatterns = privateGuardTerms.map(({ term, source }) => ({
    label: `private local guard term from ${source}`,
    pattern: new RegExp(escapeRegExp(term), "iu"),
  }));

  for (const file of files) {
    const label = displayPath(file);
    if (extname(file).toLowerCase() === ".pdf") {
      report(`${label}: private/public build trees must not contain PDF files`);
    }
    if (/HeroVisual|ResearchGlyph|hero-assembly|hero-visual/i.test(label)) {
      report(`${label}: legacy generated/generic research visual must be removed`);
    }
    if (!textExtensions.has(extname(file).toLowerCase())) {
      continue;
    }
    const content = await readFile(file, "utf8");
    for (const { label: guardLabel, pattern } of [
      ...genericPublicSafetyPatterns,
      ...privateGuardPatterns,
    ]) {
      if (pattern.test(content)) {
        report(`${label}: privacy guard matched ${guardLabel}`);
      }
    }
    if (/HeroVisual|ResearchGlyph|hero-assembly|hero-visual/i.test(content)) {
      report(`${label}: contains a legacy generated/generic research visual reference`);
    }
    if (/\bpublic-author-order\b|\bfirst-listed author\b/i.test(content)) {
      report(
        `${label}: unsupported first-author inference remains; contribution labels require an explicit public note`,
      );
    }
  }

  await validatePrivateGuardSourcePolicy(privateGuardTerms);
}

async function validatePrivateGuardSourcePolicy(privateGuardTerms) {
  const policyFiles = [
    resolve("scripts/validate-build.mjs"),
    resolve("README.md"),
    resolve("AUDIT_AND_REDESIGN_PLAN.md"),
  ];
  const policyContents = await Promise.all(
    policyFiles.map(async (file) => ({
      file,
      content: (await exists(file)) ? await readFile(file, "utf8") : "",
    })),
  );
  const validatorSource =
    policyContents.find((entry) => entry.file.endsWith("validate-build.mjs"))
      ?.content ?? "";

  if (
    /label\s*:\s*["'][^"']*(?:project|topic)[^"']*["']\s*,\s*pattern\s*:/i.test(
      validatorSource,
    ) ||
    /(?:private|confidential|sensitive)[A-Za-z]*(?:terms|patterns)\s*=\s*(?:Object\.freeze\(\s*)?\[/i.test(
      validatorSource,
    )
  ) {
    report(
      "source policy: tracked validation code must not contain a hardcoded private project/topic guard list",
    );
  }

  for (const { term } of privateGuardTerms) {
    const normalizedTerm = term.toLocaleLowerCase("en-US");
    for (const { file, content } of policyContents) {
      if (content.toLocaleLowerCase("en-US").includes(normalizedTerm)) {
        report(
          `${displayPath(file)}: contains a term supplied through the private local guard input`,
        );
      }
    }
  }

  const ignoreFile = resolve(".gitignore");
  const ignoreRules = (await exists(ignoreFile))
    ? await readFile(ignoreFile, "utf8")
    : "";
  if (
    !/^(?:\/)?files\/(?:\s*(?:#.*)?)?$/m.test(ignoreRules) &&
    !/^(?:\/)?files\/site-private-guard-terms\.txt(?:\s*(?:#.*)?)?$/m.test(
      ignoreRules,
    )
  ) {
    report(
      "source policy: files/site-private-guard-terms.txt must be covered by .gitignore",
    );
  }
}

async function validateSingleSourceArchitecture(sourceFiles) {
  const legacyResearchDirectory = resolve("src/content/research");
  if (await exists(legacyResearchDirectory)) {
    report("single-source policy: legacy src/content/research must remain absent");
  }

  const searchableFiles = sourceFiles.filter((file) =>
    textExtensions.has(extname(file).toLowerCase()),
  );
  for (const file of searchableFiles) {
    const content = await readFile(file, "utf8");
    const label = displayPath(file);
    if (
      /\bSITE\.features\b|\bshowAwards\b|\bshowPeople\b|\bshowRecruiting\b/.test(
        content,
      )
    ) {
      report(`${label}: dead feature flag is forbidden by the single-source policy`);
    }
    if (
      /\bgetCollection\(\s*["']research["']\s*\)/.test(content) ||
      /\bgetEntry\(\s*["']research["']\s*,/.test(content)
    ) {
      report(`${label}: legacy research content collection consumer remains`);
    }
  }

  const contentConfigFile = resolve("src/content.config.ts");
  const contentConfig = (await exists(contentConfigFile))
    ? await readFile(contentConfigFile, "utf8")
    : "";
  if (
    /\bconst\s+research\s*=\s*defineCollection\s*\(/.test(contentConfig) ||
    /export\s+const\s+collections\s*=\s*\{[^}]*\bresearch\b/s.test(contentConfig)
  ) {
    report("single-source policy: legacy research collection registration remains");
  }
}

async function validateCssOverflowGuards() {
  const cssFiles = (await filesUnder(resolve("src"))).filter(
    (file) => extname(file).toLowerCase() === ".css",
  );
  if (
    cssFiles.length !== 1 ||
    displayPath(cssFiles[0] ?? "") !== "src/styles/global.css"
  ) {
    advise(
      `Design audit: the current single-stylesheet architecture changed; found ${cssFiles.map(displayPath).join(", ") || "none"}`,
    );
  }
  const css = (
    await Promise.all(cssFiles.map((file) => readFile(file, "utf8")))
  ).join("\n");
  if (!css) {
    report("CSS source is missing");
    return;
  }
  if (/\bwidth\s*:\s*100vw\b/i.test(css)) {
    report("CSS overflow guard: avoid width: 100vw for page-width sections");
  }
  if (/(?:^|})\s*(?:html|body|html\s*,\s*body)[^{]*\{[^}]*overflow-x\s*:\s*hidden/ims.test(css)) {
    report("CSS overflow guard: do not hide page-level horizontal overflow");
  }
  if (!/(?:overflow-wrap\s*:\s*(?:anywhere|break-word)|word-break\s*:\s*break-word)/i.test(css)) {
    report("CSS overflow guard: expected an overflow-wrap rule for long titles, DOIs, and email");
  }
  if (/@font-face\b|fonts\.(?:googleapis|gstatic)\.com/i.test(css)) {
    advise("Design audit: a webfont is loaded; confirm the added request is intentional");
  }
  if (/\bInter\b|font-weight\s*:\s*720\b/i.test(css)) {
    advise("Design audit: Inter or a 720 weight appears in the current type system");
  }
  if (/(?:--serif\b|font-family\s*:[^;}]*\b(?<!sans-)serif\b)/i.test(css)) {
    advise("Design audit: a serif display style appears in the current type system");
  }
  if (
    /:(?:hover|focus-visible)[^{]*\{[^}]*transform\s*:\s*translate(?:3d|y)?\s*\(/ims.test(
      css,
    )
  ) {
    advise("Design audit: hover/focus translation appears in an interactive style");
  }
  if (/\bborder-radius\s*:\s*999(?:9)?px\b/i.test(css)) {
    advise("Design audit: decorative pill styling appears in the current visual system");
  }
  if (/#f4f0e6\b|#ef6943\b/i.test(css)) {
    advise("Design audit: a previous cream/orange palette token appears in the CSS");
  }
  const undersizedFontValues = [
    ...new Set(
      [...css.matchAll(/\bfont-size\s*:\s*(\d+(?:\.\d+)?)px\b/gi)]
        .map((match) => Number(match[1]))
        .filter((value) => value < 13),
    ),
  ].sort((a, b) => a - b);
  if (undersizedFontValues.length > 0) {
    report(
      `CSS typography guard: font sizes below the agreed 13px floor remain (${undersizedFontValues.join(", ")}px)`,
    );
  }
  if (!/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(css)) {
    report("CSS accessibility guard: prefers-reduced-motion handling is missing");
  }
  if (
    !/\.copy-citation\s*\[\s*hidden\s*\]\s*\{[^}]*\bdisplay\s*:\s*none\b/ims.test(
      css,
    )
  ) {
    report(
      "CSS progressive-enhancement guard: hidden copy-citation controls must remain display:none without JavaScript",
    );
  }
  const siteHeaderRule = css.match(/\.site-header\b[^{]*\{([^}]*)\}/i)?.[1] ?? "";
  const hasStickyHeader = /\bposition\s*:\s*sticky\b/i.test(siteHeaderRule);
  if (!hasStickyHeader) {
    advise("Design audit: the site header is no longer sticky");
  } else if (!/\bscroll-margin-top\s*:/i.test(css)) {
    report("CSS accessibility guard: sticky-header anchor offset is missing");
  }
}

await validatePublicationSource();
await validateResearchSource();

const distFiles = await filesUnder(distDir);
if (distFiles.length === 0) {
  report("dist is missing or empty; run the production build first");
}
const sourceFiles = (
  await Promise.all(sourceDirs.map((directory) => filesUnder(directory)))
).flat();
await validatePrivacyAndLegacyReferences([...sourceFiles, ...distFiles]);
await validateSingleSourceArchitecture(sourceFiles);
await validateCssOverflowGuards();

for (const [routeName, routePath] of expectedRoutes) {
  if (!(await exists(join(distDir, routePath)))) {
    report(`${routeName} route is missing: ${routePath}`);
  }
}

const htmlFiles = distFiles.filter((file) => extname(file).toLowerCase() === ".html");
const htmlByRoute = new Map();
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const label = relative(distDir, file);
  htmlByRoute.set(label, html);
  validateSemantics(html, label);

  if (!/<meta\b[^>]*name=(?:"viewport"|'viewport')[^>]*content=(?:"[^"]*width=device-width[^"]*"|'[^']*width=device-width[^']*')/i.test(html)) {
    report(`${label}: viewport metadata must include width=device-width`);
  }

  const attributeUrls = [
    ...html.matchAll(/\b(?:href|src)="([^"]+)"/g),
    ...html.matchAll(/\bsrcset="([^"]+)"/g),
  ].flatMap((match) =>
    match[0].startsWith("srcset")
      ? match[1].split(",").map((candidate) => candidate.trim().split(/\s+/)[0])
      : [match[1]],
  );

  for (const encodedUrl of attributeUrls) {
    const url = decodeHtml(encodedUrl);
    if (
      !url ||
      url.startsWith("#") ||
      url.startsWith("data:") ||
      url.startsWith("mailto:") ||
      url.startsWith("tel:") ||
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("//")
    ) {
      continue;
    }
    if (!url.startsWith(basePath)) {
      report(`${label}: internal URL escapes ${basePath}: ${url}`);
      continue;
    }
    const target = localTarget(url);
    if (!target) {
      report(`${label}: internal URL cannot be decoded: ${url}`);
    } else if (!(await exists(target))) {
      report(`${label}: internal URL does not resolve: ${url}`);
    }
  }

  const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/gi)];
  if (canonicals.length !== 1 || !decodeHtml(canonicals[0][1]).startsWith(publicBase)) {
    report(`${label}: expected one canonical URL under ${publicBase}`);
  }

  if (
    label === "404.html" &&
    !/<meta\b[^>]*name="robots"[^>]*content="noindex, nofollow"/i.test(html)
  ) {
    report("404.html: expected a noindex, nofollow robots directive");
  }
  if (
    label !== "index.html" &&
    label !== join("experience", "index.html") &&
    html.includes('"@type":"ProfilePage"')
  ) {
    report(`${label}: ProfilePage schema is only valid on Home and Experience`);
  }
}

const publicationsHtml = htmlByRoute.get(join("publications", "index.html")) ?? "";
const homeHtml = htmlByRoute.get("index.html") ?? "";
const researchHtml = htmlByRoute.get(join("research", "index.html")) ?? "";
const experienceHtml = htmlByRoute.get(join("experience", "index.html")) ?? "";

if (researchFigures(homeHtml).length !== 0) {
  advise("Design audit: detailed research figures now appear on the Home page");
}
if (/\bclass=(?:"[^"]*\bresearch-map\b[^"]*"|'[^']*\bresearch-map\b[^']*')/i.test(homeHtml)) {
  advise("Design audit: a full research map now appears on the Home page");
}
if (/\bclass=(?:"[^"]*\bselected-publication\b[^"]*"|'[^']*\bselected-publication\b[^']*')/i.test(homeHtml)) {
  report("index.html: detailed publication cards must remain off the concise homepage");
}
if (researchFigures(researchHtml).length !== 5) {
  advise("Design audit: the Research page no longer renders the current five-figure composition");
}

const renderedStoryPreviews = [
  ...homeHtml.matchAll(
    /\bdata-research-story-preview=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
const expectedHomeResearchRouteIds = [
  "finite-assemblies",
  "two-dimensional-arrays",
  "open-crystal-lattices",
];
if (renderedStoryPreviews.length !== 0) {
  report(
    `index.html: detailed research-story previews must remain on the Research page; found ${renderedStoryPreviews.join(", ")}`,
  );
}
const renderedSelectedPublicationIds = [
  ...publicationsHtml.matchAll(
    /\bdata-selected-publication=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
if (renderedSelectedPublicationIds.length !== 0) {
  report(
    `publications/index.html: selected papers must not duplicate the complete list; found ${renderedSelectedPublicationIds.join(", ")}`,
  );
}
const expectedSelectedPublicationIds = sourcePublications
  .filter((publication) => publication.featured)
  .sort((a, b) => a.selectedOrder - b.selectedOrder)
  .slice(0, 3)
  .map((publication) => publication.id);
const renderedHomeSelectedPublicationIds = [
  ...homeHtml.matchAll(
    /\bdata-home-selected-publication=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
if (
  renderedHomeSelectedPublicationIds.length !== expectedSelectedPublicationIds.length ||
  expectedSelectedPublicationIds.some(
    (id) => !renderedHomeSelectedPublicationIds.includes(id),
  )
) {
  report(
    `index.html: expected the led Science paper and two current public manuscripts; found ${renderedHomeSelectedPublicationIds.join(", ") || "none"}`,
  );
}
if (
  countMatches(homeHtml, /\bdata-home-bio(?:=|\s|>)/gi) !== 1
) {
  report("index.html: the public prose biography is missing");
}
if (decodeHtml(homeHtml).includes("Southern University of Science and Technology")) {
  report("index.html: early training details belong on the Experience page, not the concise homepage");
}
const homeHeroPhoto = homeHtml.match(
  /<(?:figure|div)\b[^>]*\bclass=(?:"[^"]*\bhome-hero-photo\b[^"]*"|'[^']*\bhome-hero-photo\b[^']*')[^>]*>[\s\S]*?<\/(?:figure|div)>/i,
)?.[0];
if (
  !homeHeroPhoto ||
  !/<img\b[^>]*\balt=(?:"[^"]+"|'[^']+')/i.test(homeHeroPhoto)
) {
  report("index.html: the approved hero portrait and descriptive alt text are missing");
}
const renderedHomeResearchRoutes = [
  ...homeHtml.matchAll(
    /\bdata-home-research-route=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
if (
  renderedHomeResearchRoutes.length !== expectedHomeResearchRouteIds.length ||
  expectedHomeResearchRouteIds.some(
    (id) => !renderedHomeResearchRoutes.includes(id),
  )
) {
  advise(
    `Design audit: the concise Home research-route set changed; found ${renderedHomeResearchRoutes.join(", ") || "none"}`,
  );
}
for (const storyId of expectedHomeResearchRouteIds) {
  const target = `${basePath}research/#${storyId}`;
  if (!decodeHtml(homeHtml).includes(`href="${target}"`)) {
    advise(`Design audit: Home research route is missing for ${storyId}`);
  }
}

const renderedPublicationCount = countMatches(
  publicationsHtml,
  /\bdata-publication-record(?:=|\s|>)/gi,
);
if (renderedPublicationCount === 0) {
  report("publications/index.html: rendered publication collection is empty");
}
if (renderedPublicationCount !== sourcePublications.length) {
  report(
    `publications/index.html: expected ${sourcePublications.length} rendered publication records, found ${renderedPublicationCount}`,
  );
}
const renderedPublicationOrder = [
  ...publicationsHtml.matchAll(
    /\bdata-publication-id=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
const expectedPublicationOrder = [...sourcePublications]
  .sort((a, b) => b.year - a.year)
  .map((publication) => publication.id);
if (
  renderedPublicationOrder.length !== expectedPublicationOrder.length ||
  expectedPublicationOrder.some(
    (id, index) => renderedPublicationOrder[index] !== id,
  )
) {
  report("publications/index.html: records must render once in newest-to-oldest source order");
}
if (!decodeHtml(publicationsHtml).includes(knownPublicationTitle)) {
  report(`publications/index.html: known title is missing: ${knownPublicationTitle}`);
}
if (
  countMatches(
    publicationsHtml,
    /\bdata-copy-citation=(?:"[^"]+"|'[^']+')/gi,
  ) !== sourcePublications.length
) {
  report(
    `publications/index.html: expected ${sourcePublications.length} progressive-enhancement copy-citation controls`,
  );
}
if (!decodeHtml(publicationsHtml).includes("Download BibTeX")) {
  report("publications/index.html: BibTeX download action is missing");
}
for (const publication of sourcePublications) {
  if (typeof publication.id !== "string" || !publication.id) {
    continue;
  }
  const escapedId = publication.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const record = publicationsHtml.match(
    new RegExp(
      `<article\\b[^>]*\\bdata-publication-id=(?:"${escapedId}"|'${escapedId}')[^>]*>[\\s\\S]*?<\\/article>`,
      "i",
    ),
  )?.[0];
  if (!record) {
    report(`publications/index.html: rendered record is missing for ${publication.id}`);
    continue;
  }
  if (!/<strong\b[^>]*>\s*Hao Liu\s*<\/strong>/i.test(record)) {
    report(`${publication.id}: rendered author list must structurally highlight Hao Liu`);
  }
  if (publication.recordStatus === "preprint-not-peer-reviewed") {
    if (!/\bPreprint\b/i.test(record) || !/\bNot peer reviewed\b/i.test(record)) {
      report(`${publication.id}: rendered preprint status is incomplete`);
    }
  } else if (publication.recordStatus === "editorial") {
    if (!/\b(?:Commentary|News &amp; Views|News & Views)\b/i.test(record)) {
      report(`${publication.id}: rendered editorial/commentary status is missing`);
    }
  } else if (!/\bResearch article\b/i.test(record)) {
    report(`${publication.id}: rendered research-article status is missing`);
  }
  if (
    publication.manuscriptStatus &&
    !decodeHtml(record).includes(publication.manuscriptStatus)
  ) {
    report(`${publication.id}: approved manuscript workflow status did not render`);
  }

  const contributingAuthors = publication.authors.filter(
    (author) => (author.contributions ?? []).length > 0,
  );
  const legendCount = countMatches(
    record,
    /\bdata-authorship-legend(?:=|\s|>)/gi,
  );
  if (contributingAuthors.length > 0) {
    if (legendCount !== 1) {
      report(`${publication.id}: expected one accessible authorship legend`);
    }
    const decodedRecord = decodeHtml(record);
    const roles = new Set(
      contributingAuthors.flatMap((author) =>
        author.contributions.map((contribution) => contribution.role),
      ),
    );
    if (roles.has("equal-contribution") && !decodedRecord.includes("† Equal contribution")) {
      report(`${publication.id}: equal-contribution legend is missing`);
    }
    if (roles.has("corresponding-author") && !decodedRecord.includes("* Corresponding author")) {
      report(`${publication.id}: corresponding-author legend is missing`);
    }
    for (const author of contributingAuthors) {
      const escapedName = author.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expectedRoles = author.contributions.map((item) => item.role).join(" ");
      const markedAuthor = record.match(
        new RegExp(
          `<span\\b[^>]*data-contribution-author=(?:"${escapedName}"|'${escapedName}')[^>]*>[\\s\\S]*?<\\/span>`,
          "i",
        ),
      )?.[0];
      if (
        !markedAuthor ||
        !markedAuthor.includes(`data-contribution-roles="${expectedRoles}"`)
      ) {
        report(`${publication.id}: authorship marks are incomplete for ${author.name}`);
      }
      for (const contribution of author.contributions) {
        if (!decodedRecord.includes(contribution.sourceUrl)) {
          report(`${publication.id}: authorship evidence link is missing for ${author.name}`);
        }
      }
    }
  } else if (legendCount !== 0) {
    report(`${publication.id}: unsupported authorship legend rendered`);
  }
}

for (const advisor of [
  {
    name: "Prof. Petr Šulc",
    url: "https://search.asu.edu/profile/3160408",
  },
  {
    name: "Prof. Hao Yan",
    url: "https://search.asu.edu/profile/734863",
  },
]) {
  const advisorAnchor = decodeHtml(experienceHtml).match(
    new RegExp(
      `<a\\b[^>]*href="${advisor.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>[\\s\\S]*?${advisor.name}[\\s\\S]*?<\\/a>`,
      "i",
    ),
  )?.[0];
  if (!advisorAnchor) {
    report(`experience/index.html: linked current advisor is missing: ${advisor.name}`);
  }
}

const metaDnaRecord = publicationsHtml.match(
  /<article\b[^>]*\bdata-publication-id=(?:"meta-dna-2020"|'meta-dna-2020')[^>]*>[\s\S]*?<\/article>/i,
)?.[0];
if (!metaDnaRecord) {
  report("publications/index.html: Meta-DNA publication record is missing");
} else {
  if (!/\bdata-related-correction(?:=|\s|>)/i.test(metaDnaRecord)) {
    report("publications/index.html: Meta-DNA correction must be visibly nested in its record");
  }
  if (!metaDnaRecord.toLowerCase().includes(correctionDoi)) {
    report("publications/index.html: Meta-DNA correction DOI is missing");
  }
  if (!/\bAuthor Correction\b/i.test(metaDnaRecord)) {
    report("publications/index.html: Meta-DNA relationship must be labeled Author Correction");
  }
}
if (countMatches(publicationsHtml, /\bdata-related-correction(?:=|\s|>)/gi) !== 1) {
  report("publications/index.html: expected exactly one related correction");
}

if (!(await exists(publicationBibFile))) {
  report("publications/hao-liu-publications.bib: static bibliography is missing");
} else {
  const bibliography = await readFile(publicationBibFile, "utf8");
  const entryCount = countMatches(bibliography, /^@\w+\{/gim);
  if (entryCount !== sourcePublications.length) {
    report(
      `publications/hao-liu-publications.bib: expected ${sourcePublications.length} entries, found ${entryCount}`,
    );
  }
  if (bibliography.toLowerCase().includes(correctionDoi)) {
    report(
      "publications/hao-liu-publications.bib: non-counted Author Correction must remain nested under its parent record",
    );
  }
}

const publicationJsonLd = jsonLdObjects(
  publicationsHtml,
  "publications/index.html",
);
const itemLists = publicationJsonLd.flatMap((object) =>
  findTypedObjects(object, "ItemList"),
);
if (itemLists.length !== 1) {
  report(`publications/index.html: expected exactly one JSON-LD ItemList, found ${itemLists.length}`);
} else {
  const itemList = itemLists[0];
  if (itemList.numberOfItems !== sourcePublications.length) {
    report(
      `publications/index.html: JSON-LD numberOfItems must be ${sourcePublications.length}`,
    );
  }
  if (
    !Array.isArray(itemList.itemListElement) ||
    itemList.itemListElement.length !== sourcePublications.length
  ) {
    report(
      `publications/index.html: JSON-LD itemListElement must contain ${sourcePublications.length} entries`,
    );
  } else {
    const structuredTitles = itemList.itemListElement.map((item) => item.name);
    if (!structuredTitles.includes(knownPublicationTitle)) {
      report("publications/index.html: known title is missing from JSON-LD ItemList");
    }
    if (
      itemList.itemListElement.some((item) =>
        JSON.stringify(item).toLowerCase().includes(correctionDoi),
      )
    ) {
      report("publications/index.html: Author Correction must not be an ItemList entry");
    }
  }
}

const allHtml = [...htmlByRoute.values()].join("\n");
const decodedAllHtml = decodeHtml(allHtml);

// The contact address is deliberately not emitted in plain text, so scrapers
// cannot harvest it. Assert the opposite of the old rule: the address must be
// absent from the markup, and the encoded payload that rebuilds it must be
// present and must decode back to the real address.
const [emailUser, emailDomain] = publicEmail.split("@");
const encodedUser = Buffer.from(emailUser, "utf8").toString("base64");
const encodedDomain = Buffer.from(emailDomain, "utf8").toString("base64");

if (decodedAllHtml.includes(publicEmail)) {
  report(`public contact email is exposed in plain text: ${publicEmail}`);
}
for (const route of ["/", "/contact/"]) {
  const html = htmlByRoute.get(route);
  if (!html) continue;
  if (!html.includes(`data-email-user="${encodedUser}"`) ||
      !html.includes(`data-email-domain="${encodedDomain}"`)) {
    report(`${route}: encoded contact address is missing or does not decode to the public email`);
  }
}
if (!decodedAllHtml.includes(scholarUrl)) {
  report("the exact researcher-supplied Google Scholar URL is missing");
}
const scholarAnchor = decodedAllHtml.match(
  /<a\b[^>]*href="https:\/\/scholar\.google\.com\/citations\?hl=en&user=Yo-IDJwAAAAJ&view_op=list_works&sortby=pubdate"[^>]*>[\s\S]*?<\/a>/i,
)?.[0];
if (!scholarAnchor || !/<svg\b/i.test(scholarAnchor)) {
  report("Google Scholar must be an icon-and-text link using the supplied URL");
}

const visibleAllHtml = visibleHtml(allHtml);
if (/(?:<h[1-6]\b[^>]*>\s*(?:Awards?|Recognition)\s*<\/h[1-6]>|\baward-list\b|\bdata-awards?\b)/i.test(visibleAllHtml)) {
  report("public build: awards/recognition section is still visible");
}
if (/\bfirst-listed author\b/i.test(visibleAllHtml)) {
  report(
    "public build: inferred first-listed authorship language is not approved",
  );
}

validateResearchFigures(researchHtml);
validateResearchPublicationReferences(researchHtml);

const notFoundHtml = htmlByRoute.get("404.html") ?? "";
const notFoundCanonicalTags = openingTags(notFoundHtml, "link").filter(
  (tag) => attribute(tag, "rel") === "canonical",
);
const expectedNotFoundCanonical = `${publicBase}404.html`;
if (
  notFoundCanonicalTags.length !== 1 ||
  decodeHtml(attribute(notFoundCanonicalTags[0], "href") ?? "") !==
    expectedNotFoundCanonical
) {
  report(`404.html: canonical must be exactly ${expectedNotFoundCanonical}`);
}

const sitemapFile = join(distDir, "sitemap-0.xml");
const sitemapIndexFile = join(distDir, "sitemap-index.xml");
const robotsFile = join(distDir, "robots.txt");
if (!(await exists(sitemapIndexFile)) || !(await exists(sitemapFile))) {
  report("sitemap-index.xml or sitemap-0.xml is missing");
} else {
  const sitemapIndex = await readFile(sitemapIndexFile, "utf8");
  const sitemap = await readFile(sitemapFile, "utf8");
  if (!sitemapIndex.includes(`${publicBase}sitemap-0.xml`)) {
    report("sitemap index does not use the public base URL");
  }
  if (!sitemap.includes(publicBase)) {
    report("sitemap does not contain the public base URL");
  }
}
if (!(await exists(robotsFile))) {
  report("robots.txt is missing");
} else {
  const robots = await readFile(robotsFile, "utf8");
  if (!robots.includes(`${publicBase}sitemap-index.xml`)) {
    report("robots.txt does not point to the deployed sitemap");
  }
}

if (warnings.length > 0) {
  console.warn(
    `Design audit advisory (${warnings.length} item${warnings.length === 1 ? "" : "s"}; non-blocking):`,
  );
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error(`Build validation failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Build validation passed: ${[
    `${htmlFiles.length} HTML pages`,
    `${sourcePublications.length} source/rendered/JSON-LD publications`,
    "nested non-counted correction",
    "route/base-path integrity",
    "semantic and focused research-figure hooks",
    "contact links",
    "privacy/legacy guards",
  ].join("; ")}.`,
);
