import { access, readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";
import { loadResearchSource } from "./lib/research-source.mjs";
import { readPublications, referenceId } from "../src/lib/content-source.ts";
import { parse as parseYaml } from "yaml";

const rootDir = resolve(".");
const distDir = resolve("dist");
const sourceDirs = [resolve("src"), resolve("public")];
const basePath = "/website/";
const publicOrigin = "https://antimonyleo.github.io";
const publicBase = `${publicOrigin}${basePath}`;
const doiPattern = /^10\.\d{4,9}\/[-._;()/:A-Z0-9]+$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const publicationBibFile = resolve("dist/publications/hao-liu-publications.bib");
const identitySource = await readFile(resolve("src/content/people/hao-liu.md"), "utf8");
const publicIdentity = parseYaml(identitySource.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "");
const scholarUrl = publicIdentity.scholar;
const publicEmail = publicIdentity.email;
const errors = [];
const warnings = [];
let sourcePublications = [];
let sourceResearchGroups = [];
let sourceOverviewFigureId;
const defaultPrivateGuardFile = resolve("files/site-private-guard-terms.txt");

const expectedRoutes = new Map([
  ["Home", "index.html"],
  ["Research", join("research", "index.html")],
  ["News", join("news", "index.html")],
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

function validateResearchFigureSelection(html, expected, label) {
  const rendered = researchFigures(html);
  const ids = rendered.map((figure) => attribute(figure.match(/<figure\b[^>]*>/i)?.[0] ?? "", "data-research-figure"));
  if (JSON.stringify([...ids].sort()) !== JSON.stringify([...expected].sort())) {
    report(`${label}: figures must match the selections in the editor`);
  }
  for (const figure of rendered) {
    if (!/<figcaption\b/i.test(figure) || !/<img\b[^>]*\balt=(?:"[^"]+"|'[^']+')/i.test(figure)) {
      report(`${label}: every figure needs a caption and image description`);
    }
  }
}

function validateResearchFigures(researchHtml) {
  validateResearchFigureSelection(researchHtml, [...(sourceOverviewFigureId ? [sourceOverviewFigureId] : []), ...sourceResearchGroups.flatMap((group) => group.figureIds ?? [])], "research page");
  for (const group of sourceResearchGroups) {
    for (const reference of group.publications ?? []) {
      const record = sourcePublications.find((paper) => paper.id === reference.publicationId);
      const work = researchHtml.match(new RegExp('<article\\b[^>]*data-assembly-work="' + escapeRegExp(reference.publicationId) + '"[^>]*>[\\s\\S]*?<\\/article>'))?.[0] ?? "";
      if (!record || !decodeHtml(work).includes(record.title)) {
        report("research page: missing configured paper for " + reference.publicationId);
      }
      if (record?.kind === "preprint" && !/preprint/i.test(work)) report(reference.publicationId + ": missing preprint label");
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
  const publicationIds = new Set(
    sourcePublications.map((publication) => publication.id),
  );
  const { groups, overviewFigureId } = await loadResearchSource({
    report,
    publicationIds,
  });
  sourceResearchGroups = groups;
  sourceOverviewFigureId = overviewFigureId;
}

async function validatePublicationSource() {
  let publications;
  try {
    publications = readPublications();
  } catch (error) {
    report(`publication source is not valid JSON (${error.message})`);
    return;
  }

  if (!Array.isArray(publications)) {
    report("publication source must be a top-level array");
    return;
  }
  sourcePublications = publications;
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

  const correctionDois = new Set(publications.flatMap((paper) => (paper.relatedItems ?? []).map((item) => item.doi.toLowerCase())));
  if (publications.some((paper) => correctionDois.has(paper.doi.toLowerCase()))) {
    report("publication source: corrections belong inside their parent, not in the main publication list");
  }
  for (const publication of publications) {
    for (const image of [publication.image, ...(publication.figures ?? [])].filter(Boolean)) {
      const path = resolve("public", image.src.replace(/^[/]+/, ""));
      if (!path.startsWith(resolve("public/images") + sep) || !(await exists(path))) {
        report(`${publication.id}: choose an existing public image for this publication`);
      }
    }
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
        publication.acceptedIn === undefined &&
        publication.volumePages === undefined &&
        (publication.manuscriptStatus === undefined ||
          ["Submitted", "In revision"].includes(publication.manuscriptStatus))) ||
      (publication.kind === "preprint" &&
        publication.recordStatus === "accepted" &&
        typeof publication.acceptedIn === "string" &&
        publication.acceptedIn.trim() &&
        publication.volumePages === undefined &&
        publication.manuscriptStatus === undefined);
    if (!validRecordShape) {
      report(
        `${publication.id}: kind, recordStatus, volumePages, manuscriptStatus, and acceptedIn form an inconsistent publication state`,
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
    for (const author of publication.authors) {
      const contributions = author?.contributions ?? [];
      const actualRoles = contributions.map((item) => item.role).sort();
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
          !/^https:\/\//.test(contribution.sourceUrl)
        ) {
          report(
            `${publication.id}: ${author.name} contribution metadata needs a supported role, matching evidence basis, and public HTTPS source`,
          );
        }
      }
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
  // Webfonts are now part of the design, but they must stay self-hosted: the
  // site promises no third-party requests, and a font CDN would break that.
  if (/fonts\.(?:googleapis|gstatic)\.com|use\.typekit|fonts\.bunny\.net/i.test(css)) {
    report("CSS privacy guard: fonts must be self-hosted, not loaded from a third party");
  }
  /*
    One self-hosted face, since the 2026-09 compact visual system retired the
    serif/sans pairing. What this guard protects is unchanged in substance —
    the type system is deliberate and ships with the site — so it still
    requires the face to be declared locally and the tokens to exist; it no
    longer requires a second family the design does not use.
  */
  if (!/@font-face[^}]*font-family:\s*"Archivo"/is.test(css)) {
    report("CSS typography guard: the self-hosted Archivo @font-face rule is missing");
  }
  if (!/--serif\s*:/.test(css) || !/--sans\s*:/.test(css)) {
    report("CSS typography guard: the type-voice tokens are missing");
  }
  if (/\bInter\b|font-weight\s*:\s*720\b/i.test(css)) {
    advise("Design audit: Inter or a 720 weight appears in the current type system");
  }
  /*
    Magnitude, not presence. A 2-4px nudge on a figure plate reads as picking
    up a specimen card; a large lift reads as a web-app tile and is what this
    guard is actually for. Flagging any translation at all meant an approved
    motion decision produced a permanent advisory on every build.
  */
  const hoverTranslations = [
    ...css.matchAll(
      /:(?:hover|focus-visible|focus-within)[^{]*\{[^}]*?transform\s*:\s*translate(?:3d|Y)?\s*\(([^)]*)\)/gims,
    ),
  ].map((match) => match[1]);
  const oversizedLifts = hoverTranslations.filter((value) =>
    [...value.matchAll(/(-?\d+(?:\.\d+)?)px/g)].some(
      (match) => Math.abs(Number(match[1])) > 4,
    ),
  );
  if (oversizedLifts.length > 0) {
    advise(
      `Design audit: hover/focus lift exceeds 4px in ${oversizedLifts.length} rule(s) — reads as a web-app tile`,
    );
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
/*
  Every paper the Research page claims should show its own evidence. A group
  that lists publications but renders no figure is the failure mode worth
  catching — a first-author result presented as text alone.

  This replaces a fixed figure count, which asserted a composition rather than
  an intent and so fired on any honest change to the evidence set. The rendered
  ids are already matched against src/data/research.ts and the approved source
  list above; a count adds nothing but a false alarm.
*/
for (const group of sourceResearchGroups) {
  const figureCount = group?.figureIds?.length ?? 0;
  if ((group?.publications?.length ?? 0) > 0 && figureCount === 0) {
    advise(
      `Design audit: research group “${group?.id ?? "unknown"}” cites ${group.publications.length} paper(s) but shows no figure`,
    );
  }
}

const renderedStoryPreviews = [
  ...homeHtml.matchAll(
    /\bdata-research-story-preview=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
const expectedHomePrimaryPublicationIds = sourcePublications
  .filter((record) => record.featured)
  .sort((a, b) => (a.selectedOrder ?? 9999) - (b.selectedOrder ?? 9999) || b.year - a.year || (a.order ?? 9999) - (b.order ?? 9999) || a.id.localeCompare(b.id))
  .map((record) => record.id);
if (renderedStoryPreviews.length !== 0) {
  report(
    `index.html: detailed research-story previews must remain off the concise homepage; found ${renderedStoryPreviews.join(", ")}`,
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
const renderedHomeSelectedPublicationIds = [
  ...homeHtml.matchAll(
    /\bdata-home-selected-publication=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
if (renderedHomeSelectedPublicationIds.length !== 0) {
  report(
    `index.html: publications belong on their dedicated page; found ${renderedHomeSelectedPublicationIds.join(", ")}`,
  );
}
const renderedHomePrimaryPublicationIds = [
  ...homeHtml.matchAll(
    /\bdata-home-primary-publication=(?:"([^"]+)"|'([^']+)')/gi,
  ),
].map((match) => match[1] ?? match[2]);
if (
  renderedHomePrimaryPublicationIds.length !==
    expectedHomePrimaryPublicationIds.length ||
  expectedHomePrimaryPublicationIds.some(
    (id, index) => renderedHomePrimaryPublicationIds[index] !== id,
  )
) {
  report(
    `index.html: homepage papers must match featured/selectedOrder in src/content/publications/ (${expectedHomePrimaryPublicationIds.join(", ")}); found ${renderedHomePrimaryPublicationIds.join(", ") || "none"}`,
  );
}
if (countMatches(homeHtml, /\bdata-home-proposition(?:=|\s|>)/gi) !== 1) {
  report("index.html: the homepage research proposition is missing");
}
/*
  A homepage research figure is optional in the minimal layout. When present,
  its source must still be one of the selected public papers.
*/
const heroPaperId = [
  ...homeHtml.matchAll(/\bdata-home-hero-paper=(?:"([^"]+)"|'([^']+)')/gi),
].map((match) => match[1] ?? match[2]);
if (heroPaperId.length > 1) {
  report("index.html: the hero figure must name at most one source paper");
} else if (heroPaperId.length === 1 && !expectedHomePrimaryPublicationIds.includes(heroPaperId[0])) {
  report(
    `index.html: hero paper ${heroPaperId[0]} is not a featured publication`,
  );
}
for (const [className, label] of [
  ["home-hero-portrait", "identity portrait"],
]) {
  const block = homeHtml.match(
    new RegExp(
      `<(?:figure|div)\\b[^>]*\\bclass=(?:"[^"]*\\b${className}\\b[^"]*"|'[^']*\\b${className}\\b[^']*')[^>]*>[\\s\\S]*?</(?:figure|div)>`,
      "i",
    ),
  )?.[0];
  if (!block || !/<img\b[^>]*\balt=(?:"[^"]{20,}"|'[^']{20,}')/i.test(block)) {
    report(`index.html: the ${label} or its descriptive alt text is missing`);
  }
}
const renderedPublicationCount = countMatches(
  publicationsHtml,
  /\bdata-publication-record(?:=|\s|>)/gi,
);
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
if (sourcePublications.length > 0 && !decodeHtml(publicationsHtml).includes("Download BibTeX")) {
  report("publications/index.html: BibTeX download action is missing");
}
// Authorship roles stay in the content files but are not shown on the site.
if (/\bdata-authorship-legend\b|\bdata-contribution-author\b|<sup\b/i.test(publicationsHtml)) {
  report("publications/index.html: authorship marks and their legend are not shown");
}
const renderedYears = [...publicationsHtml.matchAll(/data-publication-year="(\d+)"/g)]
  .map((match) => Number(match[1]));
const expectedYears = [...new Set(sourcePublications.map((publication) => publication.year))]
  .sort((a, b) => b - a);
if (JSON.stringify(renderedYears) !== JSON.stringify(expectedYears)) {
  report("publications/index.html: visible year groups must follow newest-to-oldest order");
}
for (const group of sourceResearchGroups.filter((group) => group.publications.some((reference) =>
  sourcePublications.some((publication) => publication.featured && publication.id === reference.publicationId),
))) {
  if (!homeHtml.includes(`href="${basePath}research/#${group.id}"`)) {
    report(`index.html: selected work needs its research link for ${group.id}`);
  }
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
  const summary = record.match(/<\/h3>\s*<p class="publication-summary">([\s\S]*?)<\/p>/i)?.[1];
  if (decodeHtml(summary ?? "") !== publication.summary) {
    report(`${publication.id}: the complete summary must appear immediately below the title`);
  }
  if (!/<strong\b[^>]*>\s*Hao Liu\s*<\/strong>/i.test(record)) {
    report(`${publication.id}: rendered author list must structurally highlight Hao Liu`);
  }
  if (publication.acceptedIn) {
    if (!decodeHtml(record).includes(`Accepted in ${publication.acceptedIn}`) || !/Preprint DOI/.test(record)) {
      report(`${publication.id}: show confirmed journal acceptance and identify the linked preprint`);
    }
  } else if (publication.recordStatus === "preprint-not-peer-reviewed") {
    if (!/\bPreprint\b/i.test(record)) {
      report(`${publication.id}: rendered preprint status is missing`);
    }
  } else if (publication.recordStatus === "editorial") {
    if (!/\b(?:Commentary|News &amp; Views|News & Views)\b/i.test(record)) {
      report(`${publication.id}: rendered editorial/commentary status is missing`);
    }
  } else if (/\bResearch article\b/i.test(record) || !decodeHtml(record).includes(publication.venue)) {
    report(`${publication.id}: a research article shows its journal, without a redundant "Research article" label`);
  }
  if (
    publication.manuscriptStatus &&
    !decodeHtml(record).includes(publication.manuscriptStatus)
  ) {
    report(`${publication.id}: approved manuscript workflow status did not render`);
  }

}

const experienceSource = parseYaml((await readFile(resolve("src/content/experience/hao-liu.md"), "utf8")).split("---")[1]);
for (const advisor of (experienceSource.appointments ?? []).flatMap((item) => item.advisors ?? [])) {
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

const correctionDois = sourcePublications.flatMap((paper) => (paper.relatedItems ?? []).map((item) => item.doi.toLowerCase()));
if (countMatches(publicationsHtml, /\bdata-related-correction(?:=|\s|>)/gi) !== correctionDois.length) {
  report("publications/index.html: corrections must be nested in their parent records");
}
for (const doi of correctionDois) if (!publicationsHtml.toLowerCase().includes(doi)) {
  report("publications/index.html: missing correction DOI: " + doi);
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
  if (correctionDois.some((doi) => bibliography.toLowerCase().includes(doi))) {
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
if (itemLists.length !== Number(sourcePublications.length > 0)) {
  report("publications/index.html: JSON-LD ItemList must follow the presence of publication entries");
} else if (itemLists.length) {
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
    if (JSON.stringify(structuredTitles) !== JSON.stringify(expectedPublicationOrder.map((id) => sourcePublications.find((paper) => paper.id === id).title))) {
      report("publications/index.html: JSON-LD titles must match the ordered publication records");
    }
    if (
      itemList.itemListElement.some((item) =>
        correctionDois.some((doi) => JSON.stringify(item).toLowerCase().includes(doi)),
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
for (const route of ["index.html", join("contact", "index.html")]) {
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
const scholarAnchors = [...decodedAllHtml.matchAll(
  /<a\b[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi,
)].filter((match) => match[1] === scholarUrl);
if (!scholarAnchors.some((match) => /<svg\b/i.test(match[0]))) {
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

for (const group of sourceResearchGroups.filter((group) => group.story)) {
  const { story } = group;
  const route = join("research", story.id, "index.html");
  const storyHtml = htmlByRoute.get(route);
  if (!storyHtml) {
    report(`Research note is missing: ${route}`);
    continue;
  }
  validateResearchFigureSelection(storyHtml, [...(story.photoFigureIds ?? []), story.paperFigureId].filter(Boolean), route);
  if (!researchHtml.includes(`href="${basePath}research/${story.id}/"`) ||
      !storyHtml.includes(`href="${basePath}research/#${group.id}"`)) {
    report(`${route}: the research note and its parent studies need links in both directions`);
  }
  if (![story.title, ...story.paragraphs].every((text) => decodeHtml(storyHtml).includes(text))) {
    report(`${route}: the research note must retain its configured title and full text`);
  }
}

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

const newsRssFile = join(distDir, "news", "rss.xml");
if (!(await exists(newsRssFile))) {
  report("news/rss.xml is missing");
} else {
  const rss = await readFile(newsRssFile, "utf8");
  const newsSourceDir = resolve("src/content/news");
  const newsSources = await Promise.all(
    (await readdir(newsSourceDir).catch((error) => { if (error.code === "ENOENT") return []; throw error; })).filter((name) => name.endsWith(".md"))
      .map(async (name) => {
        const source = await readFile(join(newsSourceDir, name), "utf8");
        const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
        return { id: name.slice(0, -3), data: parseYaml(frontmatter ?? "") };
      }),
  );
  const publishedNews = newsSources.filter(({ data }) => !data.draft);
  const newsSourceCount = publishedNews.length;
  const itemLinks = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map(
    (match) => match[1],
  );
  // The channel's own <link> is the first match; the rest are per-item.
  const [channelLink, ...articleLinks] = itemLinks;
  if (!channelLink?.startsWith(publicBase)) {
    report(`news/rss.xml channel link must start with ${publicBase}`);
  }
  if (articleLinks.length !== newsSourceCount) {
    report(
      `news/rss.xml has ${articleLinks.length} item(s) but src/content/news has ${newsSourceCount}`,
    );
  }
  if (articleLinks.some((link) => !link.startsWith(`${publicBase}news/`))) {
    report("news/rss.xml has an item link missing the public base path");
  }
  for (const { id, data } of newsSources) {
    if (data.publicationId && !sourcePublications.some((paper) => paper.id === referenceId(data.publicationId))) {
      report(`News ${id}: remove its link to the deleted publication (including drafts)`);
    }
    for (const image of data.figures ?? []) {
      const path = resolve("public", image.src.replace(/^[/]+/, ""));
      if (!path.startsWith(resolve("public/images") + sep) || !(await exists(path))) report(`News ${id}: choose an existing public image`);
    }
    const route = join(distDir, "news", id, "index.html");
    const inFeed = articleLinks.includes(`${publicBase}news/${id}/`);
    if (data.draft && ((await exists(route)) || inFeed)) {
      report(`news/${id}: a draft must not generate a public page or RSS entry`);
    } else if (!data.draft && (!(await exists(route)) || !inFeed)) {
      report(`news/${id}: a published update must have a page and RSS entry`);
    }
  }
  const itemTitles = [
    ...rss.matchAll(/<item>[\s\S]*?<title>([^<]*)<\/title>/g),
  ].map((match) => match[1].trim());
  if (itemTitles.length !== articleLinks.length || itemTitles.some((title) => !title)) {
    report("news/rss.xml has an item with a missing or empty title");
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
  process.exitCode = 1;
}

if (errors.length === 0) console.log(
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
