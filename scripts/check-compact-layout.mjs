import { readPublications } from "../src/lib/content-source.ts";
import assert from "node:assert/strict";
import { mkdir, readdir } from "node:fs/promises";
import { researchScaleGroups as groups } from "../src/data/research.ts";
import { chromium } from "playwright";
import { createPreviewServer } from "./lib/preview-server.mjs";

const publications = readPublications();
const featuredIds = new Set(publications.filter((paper) => paper.featured).map((paper) => paper.id));
const storyGroups = groups.filter((group) => group.story);
const storyRoutes = storyGroups.map((group) => `research/${group.story.id}/`);
const newsArticle = (await readdir("dist/news", { withFileTypes: true })).find((entry) => entry.isDirectory());
const server = createPreviewServer({ port: 4382, basePath: "/website/" });
const captures = ".lavish/compact-iteration";
let browser;
try {
  await mkdir(captures, { recursive: true });
  await server.start();
  browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["", "publications/", "research/", ...storyRoutes, "experience/", "contact/", "news/", ...(newsArticle ? [`news/${newsArticle.name}/`] : [])]) {
      await page.goto(`${server.origin}/website/${route}`);
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.documentElement.scrollWidth) <= width,
        `${route || "Home"} overflows at ${width}px`);
      if (route === "publications/") {
        assert.equal(await page.locator("[data-publication-record]").count(), publications.length);
        assert.equal(await page.locator("[data-authorship-legend], [data-contribution-author]").count(), 0);
        for (const publication of publications) {
          const row = page.locator(`[data-publication-id="${publication.id}"]`);
          assert.equal(await row.locator("h3 + .publication-summary").textContent(), publication.summary);
          assert.equal(await row.evaluate((el) => Number(el.closest("[data-publication-year]").dataset.publicationYear)), publication.year);
        }
      }
      // Load the images a reader encounters before capturing the whole page.
      // A full-page screenshot alone does not trigger offscreen lazy images.
      for (const image of await page.locator("main img:visible").all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate((element) => element.decode());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `${captures}/${route.replaceAll("/", "-").replace(/-$/, "") || "home"}-${width}.png`, fullPage: true });
    }
    await page.goto(`${server.origin}/website/`);
    const inspect = page.locator(".figure-viewer-trigger").first();
    if (await inspect.count()) {
      await inspect.focus();
      await page.keyboard.press("Enter");
      const dialog = page.locator(".figure-dialog[open]");
      await dialog.waitFor({ state: "visible" });
      assert(await dialog.locator("button").evaluate((el) => el === document.activeElement));
      await page.keyboard.press("Shift+Tab");
      assert(await dialog.locator("a").last().evaluate((el) => el === document.activeElement), "Reverse tab must wrap inside figure inspection");
      await page.keyboard.press("Tab");
      assert(await dialog.locator("button").evaluate((el) => el === document.activeElement));
      assert(await page.evaluate(() => getComputedStyle(document.documentElement).overflow === "hidden"));
      await dialog.locator("img").evaluate((image) => image.decode());
      for (let tab = 0; tab < 4; tab++) {
        await page.keyboard.press("Tab");
        assert(await dialog.evaluate((el) => el.contains(document.activeElement)), "Figure inspection must contain keyboard focus");
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth) <= width);
      assert.equal(await dialog.evaluate((el) => getComputedStyle(el).animationName), "none", "Reduced motion must disable the viewer entrance");
      await page.screenshot({ path: `${captures}/home-inspection-${width}.png` });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert(await inspect.evaluate((el) => el === document.activeElement), "Closing inspection must restore the trigger's focus");
      assert.notEqual(await page.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
      await inspect.click();
      await dialog.locator("button").click();
      await dialog.waitFor({ state: "hidden" });
    }
    for (const group of groups.filter((group) => group.publications.some((paper) => featuredIds.has(paper.publicationId)))) {
      await page.goto(`${server.origin}/website/`);
      const link = page.locator(`.home-paper h3 a[href$="/research/#${group.id}"]`).first();
      await link.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`**/research/#${group.id}`);
      const top = await page.locator(`[id="${group.id}"]`).evaluate((el) => el.getBoundingClientRect().top);
      // A study near the end of a short page cannot reach the top; it only has to be scrolled as far as the page allows.
      const atPageEnd = await page.evaluate(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight);
      assert(top >= 100 && (top < 600 || atPageEnd), `${group.id} is hidden behind sticky navigation at ${width}px: ${top}`);
    }
    for (const group of storyGroups) {
      await page.goto(`${server.origin}/website/research/`);
      const hook = page.locator(`[id="${group.id}"] .research-story-hook a`);
      await hook.focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`**/research/${group.story.id}/`);
      assert.equal(await page.locator("h1").textContent(), group.story.title);
      await page.locator(".research-story-back").focus();
      await page.keyboard.press("Enter");
      await page.waitForURL(`**/research/#${group.id}`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${server.origin}/website/contact/`);
  const email = page.locator(".contact-content .email-link");
  assert.match(await email.getAttribute("href"), /^mailto:.+@.+$/);
  assert.equal((await email.textContent()).trim(), "Email");
  const emailAddress = (await email.getAttribute("href")).slice(7);
  assert(!(await page.locator("body").innerText()).includes(emailAddress), "Contact must not show the email address as visible text");
  await page.locator(".mobile-nav summary").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link").first().focus();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".mobile-nav").getAttribute("open"), null);
  assert(await page.locator(".mobile-nav summary").evaluate((el) => el === document.activeElement));
  const staticContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const staticPage = await staticContext.newPage();
  await staticPage.goto(`${server.origin}/website/`);
  const staticInspect = staticPage.locator(".figure-viewer-trigger").first();
  if (await staticInspect.count()) {
    const [imagePage] = await Promise.all([staticContext.waitForEvent("page"), staticInspect.click()]);
    await imagePage.waitForLoadState();
    assert.equal(new URL(imagePage.url()).pathname, await staticInspect.getAttribute("href"));
    assert(await imagePage.locator("img").evaluate((image) => image.complete && image.naturalWidth > 0));
    await imagePage.close();
  }
  await staticPage.goto(`${server.origin}/website/publications/`);
  assert.equal(await staticPage.locator(".publication-summary:visible").count(), publications.length);
  assert.equal(await staticPage.locator("[data-copy-citation]:visible").count(), 0);
  await staticPage.locator(".mobile-nav summary").focus();
  await staticPage.keyboard.press("Enter");
  assert(await staticPage.getByRole("navigation", { name: "Mobile navigation" }).isVisible());
  await staticPage.goto(`${server.origin}/website/contact/`);
  assert(await staticPage.locator(".email-fallback").isVisible());
  assert.match(await staticPage.locator(".email-fallback").textContent(), /Enable JavaScript/);
  const staticContactText = await staticPage.locator("body").innerText();
  assert(!staticContactText.includes(emailAddress) && !staticContactText.includes("[at]"));
  await staticPage.goto(`${server.origin}/website/research/`);
  // Study text explains each figure; captions stay for screen readers and print, with no toggle.
  assert.equal(await staticPage.locator("details.research-figure-notes").count(), 0);
  if (await staticPage.locator(".research-figure-frame").count()) {
    const fullSizeLink = staticPage.locator(".research-figure-frame").first();
    const [imagePage] = await Promise.all([staticContext.waitForEvent("page"), fullSizeLink.click()]);
    await imagePage.waitForLoadState();
    assert.equal(new URL(imagePage.url()).pathname, await fullSizeLink.getAttribute("href"));
    assert(await imagePage.locator("img").evaluate((image) => image.complete && image.naturalWidth > 0));
    await imagePage.close();
  }
  await staticPage.evaluate(() => {
    document.querySelectorAll("main details").forEach((details) => { details.open = false; });
  });
  await staticPage.emulateMedia({ media: "print" });
  for (const caption of await staticPage.locator(".research-figure-caption").all()) {
    assert(await caption.isVisible(), "Figure captions must print even when their disclosures are closed");
  }
  for (const background of await staticPage.locator(".research-note > :not(summary)").all()) {
    assert(await background.isVisible(), "Research background must remain available in print");
  }
  await staticPage.emulateMedia({ media: "screen" });
  for (const group of storyGroups) {
    await staticPage.goto(`${server.origin}/website/research/#${group.story.id}`);
    await staticPage.locator(`[id="${group.story.id}"] a`).focus();
    await staticPage.keyboard.press("Enter");
    await staticPage.waitForURL(`**/research/${group.story.id}/`);
    assert(await staticPage.locator(".research-story-layout").isVisible());
    assert.equal(await staticPage.locator(".research-story-photos img").count(), group.story.photoFigureIds.length);
  }
  assert.deepEqual(errors, []);
  console.log("Compact layout passed: 390/834/1440px, selected-work keyboard navigation, summary/year structure, and no-JavaScript reading. Screenshots: " + captures);
} finally {
  await browser?.close();
  await server.stop();
}
