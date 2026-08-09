# Content maintenance

A practical guide to routine public-site updates. Structural design decisions
and their rationale are recorded in [DECISIONS.md](DECISIONS.md).

## Sources of truth

| Content | Edit |
| ------- | ---- |
| Identity, affiliation, contact, and biography | `src/content/people/hao-liu.md` |
| News posts | `src/content/news/*.md` |
| Publications, authorship, and review status | `src/data/publications.json` |
| Research groups, publication references, and figures | `src/data/research.ts` |
| Appointments, methods, and presentations | `src/content/experience/hao-liu.md` |

Keep facts in these files and render them from components. Do not copy the same
claim into several pages.

## News

Each file in `src/content/news/` is one post. The filename becomes the public
URL, so use a short, lowercase, hyphenated name such as
`conference-update.md`. The front matter controls the listing; the Markdown
below it is the post itself:

```md
---
title: "A short, specific headline"
date: "2026-08-09"
summary: "One sentence shown on the Home and News pages."
publicationId: "tetrahedral-lattices-2026"
---

Write one or more short paragraphs here.
```

For a paper announcement, set `publicationId` to the stable ID already in
`src/data/publications.json`. The site then supplies the citation, DOI, image,
venue, and review status; do not copy those facts into the news front matter.
For a public update that is not tied to a paper, omit `publicationId`.

The lowest-friction browser workflow is to press `.` on the GitHub repository,
copy a recent file in `src/content/news/`, rename it, edit the four fields and
body, then commit the change. Keep `date` in `YYYY-MM-DD` format and use the date
of the public event or announcement. Run `npm test` before publishing when
working locally. Never use news posts for unpublished results or material from
`files/`.

## Publications

- Keep the top-level records newest to oldest and retain each stable `id`.
- Store the bare DOI in `doi`; set `url` to exactly `https://doi.org/{doi}`.
- State `recordStatus` explicitly. A preprint remains marked not peer reviewed
  even when `manuscriptStatus` is `Submitted` or `In revision`.
- Add contribution labels only when an approved public source supports them.
- Keep corrections inside the related article with `counted: false`; do not add
  them as separate publications.

### Editing with autocomplete

`src/data/publications.schema.json` describes every field, its allowed values,
and what it does. `.vscode/settings.json` maps it onto `publications.json`, so
in VS Code — or in the browser by pressing `.` on the GitHub repo, which opens
the same editor — you get field autocomplete, dropdowns for enums like
`recordStatus`, hover documentation, and red underlines on mistakes before you
ever run a build.

Keep the schema in step with `src/content.config.ts` when fields change. The Zod
schema is the authority; the JSON Schema exists to make editing comfortable.

### Add a publication

The fastest route is the generator, which pulls title, venue, year, pages, and
the full author list from Crossref and inserts the record in the right place:

```bash
npm run add-pub -- 10.1021/acsnano.4c10796
npm run add-pub -- 10.26434/chemrxiv-2025-abcde --status "In revision"
```

It leaves three things for you: the one-sentence `summary`, any `contributions`
marks, and `topics`. Then run `npm test`. If Crossref has no record for the DOI,
or the byline differs from the published version, fall back to the manual steps
below — the schema is the real gate either way.

1. Append one complete record to `src/data/publications.json` in newest-to-oldest
   order. Do not renumber or reuse an existing `id`.
2. Copy the public author order exactly. Add contribution metadata only from an
   approved public source.
3. Set the publication type, review status, DOI URL, provenance source, and
   `sourceCheckedAt` together.
4. Reference the stable publication ID from `src/data/research.ts` only when the
   work supports the public research narrative.
5. Run `npm test`, then inspect the Publications page at the target viewports.

### Promote a preprint to a journal article

Treat this as one atomic update. Do not leave a journal venue paired with a
preprint warning or an obsolete preprint DOI.

1. Confirm the final public record and byline from the publisher.
2. Keep the existing stable `id`; update `kind` and `recordStatus` to their
   published values.
3. Remove `manuscriptStatus`.
4. Update `venue`, `year`, and `volumePages` from the final citation.
5. Replace `doi` and `url` with the journal DOI and exact `https://doi.org/{doi}`
   URL.
6. Recheck author order and every contribution mark against the final article.
7. Update the canonical provenance label, URL, and `sourceCheckedAt` date.
8. Review `summary`, `significance`, homepage selection text, and research-page
   references for language that still describes the work as a preprint.
9. Run `npm test`; verify that no preprint or manuscript-status label remains
   beside the journal citation.

## Research and figures

Research groups in `src/data/research.ts` should reference publications by
their existing `publicationId` fields; they should not duplicate citation
metadata. Every referenced ID must exist in `src/data/publications.json`.

Give each figure a unique, local, kebab-case ID. Keep its image under
`public/images/` (`public/images/research/` for new research-specific assets)
and provide descriptive alt text, a concise caption, and a public source or an
explicit original-photo credit. Preserve the same figure ID in the rendered
`data-research-figure` attribute so validation can connect source data with the
built page.

Use authentic figures that are already public and approved for reuse. Material
found in `files/` or in a presentation is not public merely because it appears
in a slide deck. Match any proposed slide-derived asset to the public paper or
preprint before copying it into `public/`.

### Publication thumbnails

Thumbnails in `public/images/publications/` are all **900 × 600 WebP**, one
legible panel per paper on a white plate with a 26px margin. Crop to a single
panel — a whole multi-panel journal figure is unreadable at the size it is
displayed and turns the list into grey noise. If a paper has no usable panel,
leave `image` off the record entirely: the row renders a quiet venue tile so the
column edge still holds.

Never re-crop a figure that carries a burned-in scale bar unless you know the
calibration; rescale the existing crop instead, so the bar stays true.

### After adding or replacing any image

```bash
npm run images
```

This writes narrower copies (`name.w600.webp`, `name.w900.webp`) beside every
image wider than 800px and refreshes `src/data/image-variants.json`, which the
layouts read to build `srcset`. Commit the variants and the manifest together
with the image. `npm test` fails if they are missing or stale, because without
them a phone downloads the full-size file.

## Identity, position, and presentations

Update public identity, biography, affiliation, and contact details in
`src/content/people/hao-liu.md`. Update appointments, methods, and talks in
`src/content/experience/hao-liu.md`. A position change normally requires both
files so the short public identity and detailed experience remain consistent.

Maintain `presentations` in `src/content/experience/hao-liu.md`, newest first.
List only public events and finalized titles. The Experience page intentionally
shows a concise selection rather than reproducing a CV.

## Verification

Run the complete release gate after content changes:

```bash
npm test
```

For local review, run `npm run dev` and open `/website/`. Content validation is
offline and deterministic; it does not query DOI registries, publication
indexes, or other network services.

Run the advisory maintenance report periodically and before a larger content
update:

```bash
npm run maintenance
```

It reports old provenance dates, current public preprints that deserve a manual
status check, and missing local research images. Findings do not fail the
command; factual review still requires a person and a public source.

## Privacy boundary

- Treat `files/` as private source material.
- Do not publish or link the current CV, research statements, private figures,
  unpublished project details, local paths, or target journals.
- Do not add awards, PI language, group recruiting, or hiring claims without
  explicit approval.
- Keep future-research language broad and scoop-safe.
- Use publisher figures only when reuse rights are clear; otherwise use
  original or explicitly approved visuals.
