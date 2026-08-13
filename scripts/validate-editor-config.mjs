import { readFile } from "node:fs/promises";

const [editorSource, publicationSource] = await Promise.all([
  readFile(new URL("../frontmatter.json", import.meta.url), "utf8"),
  readFile(new URL("../src/data/publications.json", import.meta.url), "utf8"),
]);

const editor = JSON.parse(editorSource);
const publications = JSON.parse(publicationSource);
const folders = editor["frontMatter.content.pageFolders"];
const contentTypes = editor["frontMatter.taxonomy.contentTypes"];
const fieldGroups = editor["frontMatter.taxonomy.fieldGroups"];

if (
  folders?.length !== 1 ||
  folders[0].path !== "[[workspace]]/src/content/news" ||
  contentTypes?.length !== 1
) {
  throw new Error("Front Matter CMS must expose only the News collection.");
}

const fields = new Map(contentTypes[0].fields.map((field) => [field.name, field]));
for (const name of ["title", "date", "summary"]) {
  if (!fields.get(name)?.required) {
    throw new Error(`Front Matter CMS field must be required: ${name}`);
  }
}

const figures = fields.get("figures");
const newsFigure = fieldGroups?.find((group) => group.id === "newsFigure");
if (
  figures?.type !== "block" ||
  JSON.stringify(figures.fieldGroup) !== JSON.stringify(["newsFigure"]) ||
  !newsFigure
) {
  throw new Error("Front Matter CMS must expose figures through the newsFigure block.");
}

const figureFields = new Map(
  newsFigure.fields.map((field) => [field.name, field]),
);
for (const name of ["src", "alt", "caption", "credit"]) {
  if (!figureFields.get(name)?.required) {
    throw new Error(`Front Matter CMS figure field must be required: ${name}`);
  }
}

if (
  editor["frontMatter.content.publicFolder"] !== "public" ||
  JSON.stringify(editor["frontMatter.media.supportedMimeTypes"]) !==
    JSON.stringify(["image/webp"])
) {
  throw new Error("Front Matter CMS media must use public/ and accept WebP only.");
}

const editorIds = fields
  .get("publicationId")
  .choices.map((choice) => choice.id)
  .filter(Boolean);
const publicationIds = publications.map((publication) => publication.id);

if (JSON.stringify(editorIds) !== JSON.stringify(publicationIds)) {
  throw new Error(
    "Front Matter CMS publication choices must match publications.json in order.",
  );
}

if (editor["frontMatter.git.enabled"] !== false) {
  throw new Error("Front Matter CMS Git actions must remain disabled.");
}

console.log(
  `Editor validation passed: News only; required figure metadata; WebP media; ${editorIds.length} publication choices; Git actions disabled.`,
);
