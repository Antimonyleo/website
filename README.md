# Hao Liu — personal research website

The source for my personal academic website: research, publications, background,
and contact details.

**Live site:** https://antimonyleo.github.io/website/

It is a small static site with no runtime database or tracking. The content
lives in data files and Markdown, rendered by [Astro](https://astro.build).
The GitHub-backed browser editor and activation steps are described in
[CONTENT.md](CONTENT.md). Pushes validate changes; publishing is a separate,
manually triggered workflow after approval.

How I update it day to day is in [CONTENT.md](CONTENT.md). The choices behind how
it is put together are recorded in [DECISIONS.md](DECISIONS.md).

---

## Using this as a template for your own site

You are welcome to fork this and make it yours. The design is deliberately quiet
— one accent colour, one typeface, no animation — so it should suit most
researchers without much fiddling.

The active typeface, [Archivo](https://github.com/Omnibus-Type/Archivo), is
self-hosted in `src/assets/fonts/` under the SIL Open Font License; its licence
sits beside it. Update the font and its `@font-face` block in
`src/styles/global.css` together.

### 1. Get it running

Use [Node.js](https://nodejs.org) 24, matching the CI configuration.

```bash
git clone https://github.com/Antimonyleo/website.git my-website
cd my-website
npm install
npm run dev
```

Open the address it prints. The site reloads as you edit.

### 2. Point it at your own address

In `astro.config.mjs`:

```js
site: "https://YOUR-USERNAME.github.io",
base: "/YOUR-REPO-NAME",
```

If you publish at `https://YOUR-USERNAME.github.io` itself, set `base: "/"`.

### 3. Replace the content

Routine content has seven sources of truth; Pages CMS supplies forms for all of them.

| What | File |
| --- | --- |
| Site/search/contact copy | `src/data/site.json` |
| Your name, role, affiliation, bio, links | `src/content/people/hao-liu.md` |
| Appointments, education, talks | `src/content/experience/hao-liu.md` |
| News posts | `src/content/news/*.md` |
| Publications | `src/content/publications/*.json` |
| Research page | `src/data/research.json` |
| Research figure library | `src/content/figures/*.json` |

Rename both files in `src/content/` to your own slug (for example
`jane-doe.md`), then update the two places that look them up by name:
`src/lib/person.ts` and `src/pages/experience/index.astro`.

Use the image picker to upload a photo or figure. The build detects dimensions and generates responsive web copies automatically.

### 4. Adding a publication

There is a helper that fetches the details from a DOI so you do not have to type
them out:

```bash
npm run add-pub -- 10.1126/science.adl5549
```

It fills in the title, journal, year, page numbers, and the full author list,
and files the entry in the right place. You then write the one-sentence summary
yourself, and run `npm test` to check it.

### 5. Publish it

In **Settings → Pages**, set **Source** to **GitHub Actions** once. Review the
changes and passing checks, then, with approval, use **Actions → Validate and
publish website → Run workflow** on **main**. Pushes to `main` and `content/**`,
and pull requests to `main`, run checks without deployment. CMS setup and a
review-branch editing exercise are in [CONTENT.md](CONTENT.md#one-time-activation-owner).

### A note on the checks

`npm test` runs a validation script that is specific to *my* site. It asserts
the public base URL, personal-site/privacy rules and metadata consistency. Adapt those policies for your fork; publication counts and research text are data-driven.

For your own fork use:

```bash
npm run test:template   # type check and build only
```

and either delete `scripts/validate-build.mjs` and `scripts/verify-preview.mjs`
or rewrite them around your own content. They are useful, but they are not
general-purpose.

### Quarterly reminder

`.github/workflows/maintenance.yml` opens an issue four times a year listing any
preprints whose status may have changed, so the publication list does not
quietly go stale. Delete it if you do not want it.

---

## Reuse

The code is free to reuse. The written content, photographs, and figures are
mine — please replace them with your own.
