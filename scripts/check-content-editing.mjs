// Build CMS-shaped edits in a disposable copy, never in the live content.
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, symlink, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse, stringify } from "yaml";
import sharp from "sharp";

const root = resolve(".");
const sandbox = await mkdtemp(join(tmpdir(), "website-content-editing-"));
const run = promisify(execFile);
const summary = "This isolated editor test verifies that a complete summary reaches both publication views.";
const publicationId = "1fbbec1c-72ab-4c61-9c78-c74dbadab5b6";
const figureId = "882de435-4472-40bc-a94c-d0e41c0f9587";
const groupId = "643b3cbb-9e06-44c6-8f0f-9e37cfd60948";
const originals = new Map();
const source = (path) => join(sandbox, path);
const output = (path) => readFile(source("dist/" + path), "utf8");
const saveJson = (path, value) => writeFile(source(path), JSON.stringify(value, null, 2));
const saveMarkdown = (path, data, body = "") => writeFile(source(path), "---\n" + stringify(data) + "---\n" + body);
async function command(script, args = []) {
  try {
    return await run(process.execPath, [script, ...args], {
      cwd: sandbox, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" }, timeout: 120_000, maxBuffer: 2_000_000,
    });
  } catch (error) {
    throw new Error(`${script} failed (${error.message}; signal=${error.signal}): ${error.stdout ?? ""}\n${error.stderr ?? ""}`);
  }
}
async function build() {
  await command("scripts/validate-research.mjs");
  await command("scripts/build-image-variants.mjs");
  await command(join(root, "node_modules/astro/bin/astro.mjs"), ["build", "--force"]);
  await command("scripts/validate-build.mjs");
}
async function editMarkdown(path, edit) {
  const raw = await readFile(source(path), "utf8");
  const data = parse(raw.split("---")[1]);
  edit(data);
  await saveMarkdown(path, data);
}
async function remember(directory) {
  for (const file of await readdir(join(root, directory), { withFileTypes: true })) {
    const path = directory + "/" + file.name;
    if (file.isDirectory()) await remember(path);
    else originals.set(path, await readFile(join(root, path)));
  }
}
try {
  await remember("src");
  for (const path of ["src", "public", "scripts", ".gitignore", ".pages.yml", "frontmatter.json", "astro.config.mjs", "tsconfig.json", "package.json"]) {
    await cp(join(root, path), source(path), { recursive: true });
  }
  await symlink(join(root, "node_modules"), source("node_modules"), "dir");
  await mkdir(source("public/images/uploads"), { recursive: true });
  for (const format of ["png", "jpeg", "tiff", "avif"]) {
    await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#176953" } })
      .toFormat(format).toFile(source("public/images/uploads/editor-fixture." + format));
  }
  const image = { src: "/images/uploads/editor-fixture.png", alt: "A solid green rectangle used only to test the image upload pipeline.", caption: "Editor test image, not a scientific figure.", credit: "Generated test fixture." };
  // A new record has no hand-authored ID, DOI URL, record status or member IDs.
  const paper = {
    fileId: publicationId, title: "Editor integration fixture (not a scientific publication)",
    shortTitle: "A shorter research title", summary,
    authors: [{ name: "Hao Liu" }], year: 2026, venue: "Editor fixture", kind: "preprint",
    acceptedIn: "Editor journal", manuscriptStatus: "In revision",
    doi: "https://doi.org/10.5555/editor-test", featured: true, figures: [image],
    provenance: { sourceCheckedAt: "2026-09-12" },
  };
  await saveJson("src/content/publications/" + publicationId + ".json", paper);
  await rm(source("src/content/publications/oxatub4arene-2017.json"));
  await saveJson("src/content/figures/" + figureId + ".json", {
    fileId: figureId, kind: "paper-figure", ...image, source: { publicationId: publicationId + ".json" },
  });
  const research = JSON.parse(await readFile(source("src/data/research.json"), "utf8"));
  research.groups.push({ anchor: groupId, label: "Editor theme", title: "A new research entry", description: summary,
    publications: [{ publicationId: publicationId + ".json", role: "Test fixture only" }], figureIds: [figureId + ".json"] });
  research.directions.paragraphs.push("Editor directions fixture.");
  await saveJson("src/data/research.json", research);
  await editMarkdown("src/content/people/hao-liu.md", (person) => {
    person.organizations = ["Editor test institution"];
    person.email = "editor-check@example.test";
    person.scholar = "https://scholar.google.com/citations?user=editor-check";
    person.portrait = { src: "/images/uploads/editor-fixture.jpeg", alt: image.alt };
  });
  await editMarkdown("src/content/experience/hao-liu.md", (experience) => {
    delete experience.appointments; // Clearing the entire list is a valid CMS save.
    experience.education.push({ period: "Fixture", degree: "Editor education entry", institution: "Test institution", detail: summary, figures: [image] });
    experience.presentations = [{ year: 2026, venue: "Editor presentation", title: "A repeatable entry with a figure", figures: [image] }];
    experience.showCapabilities = true;
  });
  const site = JSON.parse(await readFile(source("src/data/site.json"), "utf8"));
  site.contactDescription = "Editor contact introduction.";
  delete site.mapLocation;
  delete site.contactInterests;
  await saveJson("src/data/site.json", site);
  for (const [id, draft] of [["editor-draft", true], ["editor-ready", false]]) {
    await saveMarkdown("src/content/news/" + id + ".md", { title: id, date: "2026-09-12", draft, summary, publicationId: publicationId + ".json", figures: [image] }, "A **formatted** editor update.\n");
  }
  await build();
  const home = await output("index.html"), publications = await output("publications/index.html");
  assert(home.includes(summary) && publications.includes(summary));
  assert(home.includes(paper.title) && publications.includes(paper.title));
  assert(!home.includes(paper.shortTitle) && !publications.includes(paper.shortTitle));
  assert((await output("research/index.html")).includes(paper.shortTitle));
  assert(home.includes("Editor journal · Accepted") && publications.includes("Accepted in Editor journal"));
  const acceptedRecord = publications.match(new RegExp(`<article[^>]*data-publication-id="${publicationId}"[^>]*>[\\s\\S]*?</article>`))[0];
  assert(acceptedRecord.includes("Preprint DOI") && acceptedRecord.includes("10.5555/editor-test"));
  assert(!acceptedRecord.includes("In revision") && !acceptedRecord.includes("not peer reviewed"));
  const bibtex = await output("publications/hao-liu-publications.bib");
  assert(bibtex.includes("Preprint; accepted in Editor journal") && bibtex.includes("publisher = {Editor fixture}"));
  assert(home.includes("Editor test institution") && home.includes(groupId));
  assert(publications.includes(publicationId) && !publications.includes('data-publication-id="oxatub4arene-2017"'));
  assert(publications.includes("View figures (1)") && publications.includes(image.caption));
  assert((await output("research/index.html")).includes("Editor directions fixture."));
  assert((await output("experience/index.html")).includes("Editor education entry"));
  assert((await output("experience/index.html")).includes("Editor presentation"));
  assert(!(await output("contact/index.html")).includes("<iframe"));
  assert((await output("contact/index.html")).includes("Editor contact introduction."));
  assert((await output("news/editor-ready/index.html")).includes("<strong>formatted</strong>"));
  const manifest = JSON.parse(await readFile(source("src/data/image-variants.json"), "utf8"));
  for (const format of ["png", "jpeg", "tiff", "avif"]) {
    const variants = manifest["images/uploads/editor-fixture." + format];
    assert(variants.length > 0);
    for (const variant of variants) {
      const metadata = await sharp(source("public/" + variant.src)).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, variant.width);
    }
  }
  assert(publications.includes("/website/images/processed/"));
  assert(publications.includes('width="1000" height="500"'));
  await command("scripts/check-compact-layout.mjs");
  await cp(source(".lavish/compact-iteration"), join(root, ".lavish/content-editing"), { recursive: true });
  for (const path of ["news/index.html", "news/rss.xml", "sitemap-0.xml"]) {
    const html = await output(path);
    assert(!html.includes("editor-draft"));
    assert(html.includes("editor-ready"));
  }
  // Deleting a referenced record must fail safely, never publish a broken link.
  await rm(source("src/content/publications/" + publicationId + ".json"));
  await assert.rejects(command("scripts/validate-research.mjs"), /missing publication|deleted publication/);
  await saveJson("src/content/publications/" + publicationId + ".json", paper);
  await rm(source("src/content/figures/" + figureId + ".json"));
  await assert.rejects(command("scripts/validate-research.mjs"), /missing figure/);
  // Clearing the last item must also work: no fixed publication or news count.
  for (const directory of ["src/content/publications", "src/content/figures", "src/content/news"]) {
    await rm(source(directory), { recursive: true });
  }
  delete research.groups;
  delete research.directions.figureId;
  delete research.foundations.publicationIds;
  await saveJson("src/data/research.json", research);
  await build();
  assert((await output("publications/index.html")).includes("Publication records are temporarily unavailable"));
  assert(!(await output("index.html")).includes("data-home-primary-publication"));
  assert(!(await output("news/rss.xml")).includes("<item>"));
  // Remove all fixture sources, then rebuild: deletion and rollback must remove routes.
  await rm(source("src"), { recursive: true });
  await cp(join(root, "src"), source("src"), { recursive: true });
  await build();
  assert(!(await output("index.html")).includes("Editor test institution"));
  assert(!(await output("publications/index.html")).includes(publicationId));
  assert(!(await readdir(source("dist/news"))).includes("editor-ready"));
  for (const [path, bytes] of originals) assert.deepEqual(await readFile(join(root, path)), bytes, "Live source changed: " + path);
  console.log("Content editing passed: add/edit/remove publications, research, figures, experience and news; profile/contact; PNG/JPEG/TIFF/AVIF conversion; formatted text; draft exclusion; reference-deletion guards; rollback. Live content unchanged.");
} finally {
  console.log("Editor test workspace retained for manual cleanup: " + sandbox);
}
