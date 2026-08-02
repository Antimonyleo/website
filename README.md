# Hao Liu — personal research website

The source for my personal academic website: research, publications, background,
and contact details.

**Live site:** https://antimonyleo.github.io/website/

It is a small static site — no database, no CMS, no tracking. The content lives
in a few data files and the pages are generated from them by
[Astro](https://astro.build). Pushing to `main` rebuilds and republishes it.

How I update it day to day is in [CONTENT.md](CONTENT.md). The choices behind how
it is put together are recorded in [DECISIONS.md](DECISIONS.md).

---

## Using this as a template for your own site

You are welcome to fork this and make it yours. The design is deliberately plain
— one column of content, one accent colour, no animation — so it should suit
most researchers without much fiddling.

### 1. Get it running

You need [Node.js](https://nodejs.org) 20 or newer.

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

Almost everything you need to change is in five places.

| What | File |
| --- | --- |
| Site name, page title, description | `src/config.ts` |
| Your name, role, affiliation, bio, links | `src/content/people/hao-liu.md` |
| Appointments, education, talks | `src/content/experience/hao-liu.md` |
| Publications | `src/data/publications.json` |
| Research sections and figures | `src/data/research.ts` |

Rename both files in `src/content/` to your own slug (for example
`jane-doe.md`), then update the two places that look them up by name:
`src/lib/person.ts` and `src/pages/experience/index.astro`.

Put your photo and figures in `public/images/`.

### 4. Adding a publication

There is a helper that fetches the details from a DOI so you do not have to type
them out:

```bash
npm run add-pub -- 10.1126/science.adl5549
```

It fills in the title, journal, year, page numbers, and the full author list,
and files the entry in the right place. You then write the one-sentence summary
yourself, and run `npm run build` to check it.

### 5. Publish it

Push to `main`, then in your repository go to **Settings → Pages** and set
**Source** to **GitHub Actions**. The included workflow builds and publishes on
every push. This only has to be done once — until it is, the deploy step fails
with a 404.

### A note on the checks

`npm test` runs a validation script that is specific to *my* site. It asserts
things like my email address, my publication IDs, and particular wording, so it
will fail on your content. That is expected.

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
