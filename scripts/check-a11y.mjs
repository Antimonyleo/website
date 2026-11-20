#!/usr/bin/env node
// Automated accessibility scan of the production build, on top of (not
// instead of) the hand-written accessibility guards already in
// scripts/validate-build.mjs. Those guards check things specific to this
// site's markup (skip link, sticky-header offset, figure captions); axe-core
// catches the general classes of WCAG issue that hand-written rules don't
// anticipate.
//
//   npm run check:a11y
//
// "critical"/"serious" violations fail the command. "moderate"/"minor" are
// printed as advisories — axe's lower-severity rules include some that are
// naturally noisy on a content-heavy academic page (e.g. region/landmark
// heuristics on a long list), so treating every finding as blocking would
// train this check to be ignored.

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { createPreviewServer } from "./lib/preview-server.mjs";
import { researchScaleGroups } from "../src/data/research.ts";

const basePath = "/website/";
const port = 4380;
const routes = [
  "",
  "research/",
  ...researchScaleGroups.flatMap((group) => group.story ? [`research/${group.story.id}/`] : []),
  "news/",
  "publications/",
  "experience/",
  "contact/",
];
const blockingImpacts = new Set(["critical", "serious"]);

const server = createPreviewServer({ port, basePath });
let browser;
const blocking = [];
const advisories = [];

async function scanRoute(page, route, inspectFigure = false) {
  const url = `${server.origin}${basePath}${route}`;
  await page.goto(url, { waitUntil: "load" });
  if (inspectFigure) {
    const trigger = page.locator(".figure-viewer-trigger").first();
    if (!(await trigger.count())) return;
    await trigger.click();
    await page.locator(".figure-dialog[open]").waitFor({ state: "visible" });
  }
  const results = await new AxeBuilder({ page }).analyze();
  for (const violation of results.violations) {
    const entry = {
      route: `/${basePath}${route}`.replace(/\/+/g, "/") + (inspectFigure ? " [figure inspection]" : ""),
      id: violation.id,
      impact: violation.impact ?? "unknown",
      help: violation.help,
      nodes: violation.nodes.length,
      targets: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    };
    if (blockingImpacts.has(entry.impact)) {
      blocking.push(entry);
    } else {
      advisories.push(entry);
    }
  }
}

function formatEntry(entry) {
  const targets = entry.targets.length ? ` (${entry.targets.join(", ")})` : "";
  return `${entry.route} — ${entry.id} [${entry.impact}]: ${entry.help}, ${entry.nodes} node(s)${targets}`;
}

try {
  await server.start();
  browser = await chromium.launch();
  // Inspect settled colors instead of catching a frame during an entrance.
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const route of routes) {
    await scanRoute(page, route);
  }
  await scanRoute(page, "", true);

  console.log(`Accessibility scan: ${routes.length} route(s) and the available figure-inspection dialog checked with axe-core.`);
  if (advisories.length > 0) {
    console.log(`\nAdvisory (${advisories.length}, non-blocking):`);
    for (const entry of advisories) console.log(`- ${formatEntry(entry)}`);
  }
  if (blocking.length > 0) {
    console.error(`\nBlocking (${blocking.length}):`);
    for (const entry of blocking) console.error(`- ${formatEntry(entry)}`);
    process.exitCode = 1;
  } else {
    console.log("\nNo critical or serious violations.");
  }
} catch (error) {
  console.error(`Accessibility scan could not run: ${error.message}`);
  const output = server.getOutput().trim();
  if (output) console.error(`Preview output:\n${output}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.stop();
}
