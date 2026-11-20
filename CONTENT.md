# Managing the website

Use [Pages CMS](https://app.pagescms.org) for browser editing. It saves files to
GitHub; there is no separate content database or public `/admin` route.
The configuration is prepared locally. Hosted authorization and a signed-in
save still need the owner before routine use.

## What the editor covers

| Area | What you can manage |
| --- | --- |
| Profile and portrait | Name, role, affiliations, biography, contact links; replace or remove the portrait |
| Website and contact page | Site/search title and description, homepage heading, News/Contact search descriptions |
| Experience | Add, remove, and reorder appointments, education, presentations, advisors and capabilities; attach figures to timeline entries or presentations |
| Publications | Add, edit, or delete whole papers, including title, author order, contribution marks, venue, year, type, DOI, summary, homepage selection, figures and corrections |
| Research page | Introduction, add/remove/reorder themes, supporting papers, figure selections, expandable notes, earlier work and directions |
| Research figure library | Add, replace or delete figure records with an uploaded image, caption, description, credit and source paper |
| News | Add, edit or delete updates; date, summary, formatted body, related paper, figures and Draft switch |

Profile, site settings and Experience are fixed-page forms. The entries *inside*
their lists can be added or removed; deleting the essential page files themselves
is disabled. This is content editing, not a page-layout/code editor. The site
remains personal; no fictional group members or recruiting sections were added.

## One-time activation (owner)

1. Review and push the entire migration together: content records, forms,
   templates, image handling, validation and deployment workflow. Push only
   with approval. The remote retains its old behavior until these changes land.
2. Follow the [official setup guide](https://pagescms.org/docs/quick-start/).
   Sign in with GitHub and install the app for **Antimonyleo/website only**.
   Do not put credentials in `.pages.yml`.
3. Create/select a review branch such as `content/trial` from that revision,
   then open it in Pages CMS. Verify the repository and branch before saving.
4. Test a no-op save, a new temporary publication with a figure, a linked News
   update, and removal/undo on that branch. Review the diff and passing checks
   before adopting the hosted editor. Automatic filename fields may be added
   to older entries; their existing filenames and public IDs must not change.

Local checks exercise schema compatibility and Astro builds, not a real
authenticated hosted save. There is no hosted branch-preview URL configured.
A maintainer currently checks the rendered branch with `npm run dev` at
`/website/`. Restart the local server after changing figure-library files.

## Everyday editing

1. Choose the area and open an entry, or choose **Add** for a publication,
   figure or News update. Repeated fields have their own add/remove controls.
2. Type into the labeled fields. Use the formatting toolbar for News text,
   the date picker for dates and the image picker for uploads.
3. Select related papers by title and figures by caption. You never need to
   maintain a separate list of IDs or edit configuration when adding a paper.
4. Save on the review branch. **Save commits to GitHub; it does not publish.**
5. Review checks and the rendered pages; merge approved changes.
6. With publication approval, open GitHub **Actions → Validate and publish
   website → Run workflow → main**. The checks run again before deployment.

The new workflow validates pushes and merges without deploying. Publication is
a separate manual action. GitHub repository access—not hidden fields in the
editor—is the security boundary.

To undo an edit or deletion, revert its content commit on the review branch
and run checks again. Do not reset unrelated work.

## Publications

Enter the title, authors in the public byline order, year, venue, publication
type, DOI and one accurate summary sentence. Confirm the source-check date.
Paste either a bare DOI or its full DOI link; the site builds citation links
and review-status metadata automatically. Years are sorted automatically.

For confirmed journal acceptance before publication, enter the journal in
**Accepted in**. Keep the public preprint's venue, year, DOI and type until the
final journal citation exists. The site shows the acceptance and labels the
link as a preprint; copied citations and BibTeX retain the preprint record with
an acceptance note. Changing the type to a published article clears this
interim state automatically.

Use **Show on homepage** to select a paper. **Homepage position** is optional:
smaller numbers appear first, with year/order/ID used for ties. Turning the
checkbox off is enough; no hidden field needs clearing. **Order within a year**
is also optional.

The first homepage paper uses its first matching public paper figure from the
figure library when available. Its title links to Research; **Inspect image**
opens the complete caption, source citation and full-resolution image link.
Without JavaScript it opens the original image directly. The remaining selected
papers stay compact. Changing the first paper or its figure record updates Home
automatically.

The summary is visible immediately below the title. Optional **Figures** appear
behind a compact “View figures” disclosure. **Related-news image** is a separate
optional thumbnail used by announcements; existing thumbnails were preserved.

Only select equal-contribution/corresponding-author marks when the public
paper explicitly supports them. Include every coauthor sharing those marks.
An evidence link can point to a public source; leaving it blank uses the paper
DOI. Validation cannot decide whether a scientific claim is true: a person
must check the public source before approving publication.

Keep corrections inside the parent paper using **Corrections**, not as separate
publication entries. When a preprint becomes a journal article, edit the same
entry: update its type, DOI, venue, year, pages and public authorship evidence.
The website derives the matching status and omits obsolete submission labels;
no filename or ID change is needed.

## Figures and uploads

Use **Upload or choose image**. PNG, JPEG, WebP, AVIF and TIFF are accepted.
New uploads get generated names to avoid replacing an unrelated file.
Existing originals remain intact. The build detects dimensions, honors photo
orientation, and creates responsive WebP copies automatically; you do not have
to convert images, enter paths, enter dimensions, or run an image command.

Supply an image description for screen readers, a caption explaining the
evidence, and credit/source information. Figure-library records can point to a
paper selected by title. For original photographs, identify the photographer.

Research uses the shared figure library. News, publication and Experience
entries can carry their own figure lists. Remove a figure from its entry to
stop displaying it. Removing an attachment or figure record does not delete
its original file, which may still be used elsewhere. Delete an unused original
separately in Media only after checking its uses.

On Research, each selected figure sits beside the paper chosen in its source
field. Figures without a matching paper stay with their research theme. Full
captions and credits are available under **Figure notes**, and clicking the
image opens the original at full size. Field-note photographs appear on the
note's own page, reached through a one-line link beneath its parent studies.

If an entry or image is still referenced elsewhere, remove those references
first. The checks reject dangling links; they do not silently delete citations
or change scientific content to make a deletion succeed.

The initial implementation supports raster image uploads, not arbitrary
document/vector uploads. Use only public images with clear reuse permission.
Do not upload private slides, research material or application documents.

## News drafts and privacy

New News entries start with **Draft** enabled. Drafts are excluded from the
website, RSS and sitemap. Turn Draft off on the review branch when it is ready
for rendered-page review; this still does not publish it.

**Draft does not mean private.** GitHub files and uploaded media can be public
before website publication. Never put confidential material in the repository.

## Maintainer reference

| Source of truth | Location |
| --- | --- |
| Profile | `src/content/people/hao-liu.md` |
| Experience | `src/content/experience/hao-liu.md` |
| Publications | `src/content/publications/*.json` |
| Research figure library | `src/content/figures/*.json` |
| Research page | `src/data/research.json` |
| News | `src/content/news/*.md` |
| Site/contact copy | `src/data/site.json` |
| Browser forms | `.pages.yml` |

The former publication array was migrated without changing scientific
metadata. Each paper's filename now supplies its stable ID. New CMS entries
use automatic filenames; legacy filenames are retained. Reference fields store
filenames; the site accepts legacy IDs too. `src/lib/content-source.ts`
normalizes derived publication fields. `src/config.ts` retains navigation and
exports the editable site settings. `research.ts` is a typed rendering adapter.

Replacement saves (`merge: false`) are intentional: clearing an optional image,
note or list must not merge the old value back in. Every stored field is
represented in the form; `validate-editor-config.mjs` checks coverage.
When adding a stored field, add its form definition in the same change.

Front Matter remains an optional *local* editor for Markdown content. Its
obsolete publication/research data forms were retired to avoid two incompatible
editing interfaces. Pages CMS is the complete non-coding workflow. The local
DOI helper still works: `npm run add-pub -- <doi>` creates an individual record
from Crossref; check the byline and write its summary before publication.

`npm run build` and `npm run dev` prepare images automatically. Generated CMS
copies live in ignored `public/images/processed/`; the image manifest is rebuilt.
The older committed WebP variants remain supported.
Builds force a fresh content sync so deleting the last entry also clears
Astro's cached collection; empty collections are supported.

Run `npm test` before release. It covers build/data/privacy integrity, isolated
content add/edit/delete and rollback exercises, image conversion, draft/reference
safety, accessibility, performance and 390/834/1440px layouts. Use
`npm run maintenance` for advisory source-age, preprint-status and DOI reminders;
`-- --offline` skips network DOI checks.

Works can have an optional **Short display title** for Research.
Keep the exact paper title in **Title** for Home, Publications and accessible citation
links. Research uses **Significance** as the short explanation beside each
study, falling back to its summary when empty. Research entries supply the
verified authorship role. Group order and paper order control the study rows;
group IDs stay available as link destinations. Earlier work and directions
appear in expandable rows below the studies. An **Optional linked note** adds
a one-line hook below its group's studies; **One-line link text** controls the
hook, and its title, paragraphs, photographs and sources fill a separate page.
Experience supports appointment highlights, education advisors, and a visible
methods-and-tools list. Keep highlights factual and supported by the public
record or the owner's approved CV information.

## Privacy boundary

- Treat `files/` as private; never publish/link the current CV, research
  statements, private figures, unpublished details, local paths or unconfirmed target journals.
- Keep future research broad and scoop-safe.
- Use approved public sources for publication status, authorship and scientific claims.
  The owner may explicitly confirm and authorize an acceptance announcement.
- Add awards, group/PI claims or recruiting content only with explicit approval.
