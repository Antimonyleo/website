#!/usr/bin/env node
// A lightweight, dependency-minimal performance budget check — the numbers
// WEBSITE_STRATEGY.md already commits to ("small CSS bundle... ≤ 75 KB
// compressed first-party CSS") were previously just a stated intent, not an
// enforced one. This makes them real, without pulling in the full Lighthouse
// CLI and its own large dependency tree on top of Playwright.
//
//   npm run check:performance
//
// Checks:
//   1. Compressed first-party CSS stays under the documented 75 KB budget.
//   2. Each page's total transferred weight stays under a per-page budget
//      (set with real headroom above current measured usage, not a guess —
//      see PAGE_WEIGHT_BUDGET_BYTES below).

import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createPreviewServer } from "./lib/preview-server.mjs";
import { researchScaleGroups } from "../src/data/research.ts";

const basePath = "/website/";
const port = 4381;
const routes = ["", "research/", "news/", "publications/", "experience/", "contact/"];
routes.push(...researchScaleGroups.flatMap((group) => group.story ? [`research/${group.story.id}/`] : []));
const CSS_BUDGET_BYTES = 75 * 1024;
// Research and Publications carry several WebP figures; everything else is
// mostly type. Set well above current usage (~450-750 KB observed) so this
// catches a real regression (an unoptimized image slipping past
// scripts/build-image-variants.mjs, a heavy new dependency) without being
// brittle to normal content growth.
const PAGE_WEIGHT_BUDGET_BYTES = 1.5 * 1024 * 1024;

const failures = [];

async function checkCssBudget() {
  const astroDir = resolve("dist/_astro");
  const files = (await readdir(astroDir)).filter((name) => name.endsWith(".css"));
  let totalGzipBytes = 0;
  for (const file of files) {
    const content = await readFile(resolve(astroDir, file));
    totalGzipBytes += gzipSync(content).length;
  }
  console.log(
    `CSS: ${files.length} file(s), ${(totalGzipBytes / 1024).toFixed(1)} KB gzipped (budget ${(CSS_BUDGET_BYTES / 1024).toFixed(0)} KB).`,
  );
  if (totalGzipBytes > CSS_BUDGET_BYTES) {
    failures.push(
      `CSS budget exceeded: ${(totalGzipBytes / 1024).toFixed(1)} KB gzipped > ${(CSS_BUDGET_BYTES / 1024).toFixed(0)} KB budget.`,
    );
  }
}

async function checkPageWeight(browser, origin, route) {
  // A fresh context per route, not a shared one: Playwright only buffers a
  // response body until the next navigation starts, so reading
  // response.body() across sequential same-page navigations races and
  // throws. A shared context also caches shared assets (fonts, CSS) from the
  // first route onward, which under-counts every route after the first — a
  // budget should reflect a first-time visitor's cold load, not a warm
  // cache. (content-length headers were tried as a simpler alternative, but
  // this server sends chunked responses with no content-length for the HTML
  // document and CSS — its two largest responses — which undercounted every
  // page by nearly the same fixed amount; body() reads the real bytes.)
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const bodySizes = [];
  page.on("response", (response) => {
    bodySizes.push(
      response
        .body()
        .then((body) => body.length)
        .catch(() => 0),
    );
  });
  await page.goto(`${origin}${basePath}${route}`, { waitUntil: "load" });
  // A brief grace period for any very-late-arriving response to register
  // before body reads are collected and the context is torn down.
  await page.waitForTimeout(200);
  const totalBytes = (await Promise.all(bodySizes)).reduce((sum, n) => sum + n, 0);
  await context.close();

  const path = `/${basePath}${route}`.replace(/\/+/g, "/");
  console.log(
    `${path}: ${(totalBytes / 1024).toFixed(0)} KB transferred (budget ${(PAGE_WEIGHT_BUDGET_BYTES / 1024).toFixed(0)} KB).`,
  );
  if (totalBytes > PAGE_WEIGHT_BUDGET_BYTES) {
    failures.push(
      `${path}: ${(totalBytes / 1024).toFixed(0)} KB > ${(PAGE_WEIGHT_BUDGET_BYTES / 1024).toFixed(0)} KB page-weight budget.`,
    );
  }
}

const server = createPreviewServer({ port, basePath });
let browser;

try {
  await checkCssBudget();

  await server.start();
  browser = await chromium.launch();
  for (const route of routes) {
    await checkPageWeight(browser, server.origin, route);
  }

  if (failures.length > 0) {
    console.error(`\nBudget failures (${failures.length}):`);
    for (const message of failures) console.error(`- ${message}`);
    process.exitCode = 1;
  } else {
    console.log("\nAll performance budgets met.");
  }
} catch (error) {
  console.error(`Performance check could not run: ${error.message}`);
  const output = server.getOutput().trim();
  if (output) console.error(`Preview output:\n${output}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.stop();
}
