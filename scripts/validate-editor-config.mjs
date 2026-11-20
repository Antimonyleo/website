import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { parse as parseYaml } from "yaml";

const pages = parseYaml(await readFile(".pages.yml", "utf8"));
const entries = new Map(pages.content.map((entry) => [entry.name, entry]));
const paths = {
  profile: "src/content/people/hao-liu.md",
  site: "src/data/site.json",
  experience: "src/content/experience/hao-liu.md",
  publications: "src/content/publications",
  research: "src/data/research.json",
  figures: "src/content/figures",
  news: "src/content/news",
};
assert.deepEqual([...entries.keys()].sort(), Object.keys(paths).sort());
assert.equal(pages.settings.hide, true);
assert.equal(pages.settings.content.merge, false, "Cleared optional objects must not be merged back from old content");
assert.equal(pages.media.length, 1);
assert.equal(pages.media[0].input, "public/images");
assert.equal(pages.media[0].output, "/images");
assert.equal(pages.media[0].rename, "random", "Uploads must not overwrite an existing image by filename");
for (const format of ["jpg", "jpeg", "png", "webp"]) assert(pages.media[0].extensions.includes(format));

// With replacement saves, every stored field must be represented in the form.
function coverage(value, fields, path) {
  const map = new Map(fields.map((field) => [field.name, field]));
  for (const [key, child] of Object.entries(value)) {
    if (key === "body" && !child) continue;
    const field = map.get(key);
    assert(field, `CMS would drop ${path}.${key}`);
    if (Array.isArray(child)) {
      assert(field.list || field.options?.multiple, `Missing repeated field: ${path}.${key}`);
      for (const item of child) if (item && typeof item === "object") coverage(item, field.fields, `${path}.${key}[]`);
    } else if (child && typeof child === "object") coverage(child, field.fields, `${path}.${key}`);
  }
}
function checkFields(fields) {
  for (const field of fields) {
    if (field.name === "id") assert.equal(field.type, "string", "Legacy IDs must remain valid");
    if (field.type === "reference") {
      assert.equal(entries.get(field.options.collection)?.type, "collection");
      assert.equal(field.options.value, "{name}");
      assert(field.options.label.startsWith("{fields."));
    }
    if (field.name === "src") assert.equal(field.type, "image", "Image paths belong to the picker");
    if (["width", "height", "id", "fileId", "anchor"].includes(field.name)) assert.equal(field.hidden, true);
    if (field.type === "rich-text") assert.equal(field.options.switcher, false);
    if (field.fields) checkFields(field.fields);
  }
}
for (const [name, path] of Object.entries(paths)) {
  const entry = entries.get(name);
  assert.equal(entry.path, path);
  const collection = ["publications", "figures", "news"].includes(name);
  assert.equal(entry.operations.create, collection);
  assert.equal(entry.operations.delete, collection);
  assert.equal(entry.operations.rename, false);
  if (collection) assert.equal(entry.filename.field, false);
  checkFields(entry.fields);
  const files = collection ? (await readdir(path).catch((error) => { if (error.code === "ENOENT") return []; throw error; })).filter((file) => /[.](md|json)$/.test(file)).map((file) => path + "/" + file) : [path];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const value = file.endsWith(".json") ? JSON.parse(text) : parseYaml(text.split("---")[1]);
    coverage(value, entry.fields, file);
  }
}
const news = new Map(entries.get("news").fields.map((field) => [field.name, field]));
assert.equal(news.get("draft").default, true);
assert.equal(news.get("figures").readonly, undefined);
for (const name of ["publications", "figures"]) {
  assert.equal(entries.get(name).fields.find((field) => field.name === "fileId").type, "uuid");
}
const local = JSON.parse(await readFile("frontmatter.json", "utf8"));
assert.equal(local["frontMatter.git.enabled"], false);
assert(!JSON.stringify(local).includes("src/data/publications.json"), "No editor may write the retired aggregate");

// Saving and merging validate only. Publication remains a deliberate main dispatch.
const workflow = parseYaml(await readFile(".github/workflows/deploy.yml", "utf8"));
const condition = "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'";
assert(Object.hasOwn(workflow.on, "workflow_dispatch"));
assert.deepEqual(workflow.on.push.branches, ["main", "content/**"]);
assert.equal(workflow.permissions.contents, "read");
assert.equal(workflow.permissions.pages, undefined);
assert.equal(workflow.permissions["id-token"], undefined);
assert.equal(workflow.jobs.deploy.if, condition);
assert.equal(workflow.jobs.build.steps.find((step) => step.uses?.startsWith("actions/upload-pages-artifact@"))?.if, condition);
console.log("Editor validation passed: seven content areas, complete stored-field coverage, create/delete collections, image pickers, automatic filenames, live references, and manual-only publishing.");
