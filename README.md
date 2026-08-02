# Hao Liu — research website

A static personal research website for Hao Liu, designed so its content model
can later grow into a research-group website without presenting Hao as a PI or
recruiter today.

Routine updates are documented in [CONTENT.md](CONTENT.md). Durable product and
content choices are recorded in [DECISIONS.md](DECISIONS.md). The earlier
[AUDIT_AND_REDESIGN_PLAN.md](AUDIT_AND_REDESIGN_PLAN.md) and
[WEBSITE_STRATEGY.md](WEBSITE_STRATEGY.md) are historical design records, not
the current maintenance contract.

## Requirements

- Node.js 24, matching the GitHub Pages workflow
- npm

Install the locked dependency set:

```bash
npm ci
```

## Local development

```bash
npm run dev
```

Open <http://localhost:4321/website/>. The `/website/` prefix is intentional:
the production site is a GitHub Pages project site, not a root-domain site.

To inspect the production build manually:

```bash
npm run build
npm run preview
```

Astro prints the preview URL. Keep the `/website/` suffix when opening it.

## Validation

Run the complete release gate:

```bash
npm test
```

This command:

1. runs Astro and TypeScript checks;
2. creates the static production build;
3. validates source and generated files; and
4. starts a dedicated production-preview server, waits for readiness, checks
   the public routes, and shuts the server down.

The static validator checks publication consistency across source data,
rendered HTML, and JSON-LD; nested, non-counted corrections; route and
`/website/` link integrity; semantic landmarks; research-figure references;
public contact links; and privacy guards.

Useful narrower commands:

```bash
# Validate an existing dist/ build.
npm run validate

# Build, validate, then exercise the dedicated production preview.
npm run test:preview

# Exercise an already-built dist/ using the dedicated preview lifecycle.
npm run verify:preview

# Print offline, non-blocking content-maintenance reminders.
npm run maintenance
```

`verify:preview` reserves `127.0.0.1:4379`, fails if that port is already in
use, and terminates the process it started even when a route assertion fails.

Automated checks cannot establish visual quality or complete accessibility.
Before sign-off, follow the manual protocol in
[AUDIT_AND_REDESIGN_PLAN.md](AUDIT_AND_REDESIGN_PLAN.md#manual-review-protocol):

- 390×844
- 768×1024
- 1440×900
- 200% browser zoom
- keyboard-only navigation
- reduced-motion mode

## Content map

- Public identity, contact details, affiliation, and biography:
  `src/content/people/hao-liu.md`
- Public experience facts: `src/content/experience/hao-liu.md`
- Publication metadata, authorship, and review status:
  `src/data/publications.json`
- Research groups, publication references, figures, and field-story content:
  `src/data/research.ts`
- Shared site title, description, repository link, and navigation:
  `src/config.ts`
- Public-content verification: `sources/public_content_verification_20260729.md`

Publication records are the owned source of truth. Authors are structured and
remain in public byline order. Contribution labels require an explicit public
source. Corrections remain nested under their related article with
`counted: false`; they do not become separate substantive publications.

There is intentionally no `src/content/research/` collection. Research-page
claims, publication links, and figure records come from `src/data/research.ts`,
so routine research updates do not require page-template edits. Converting this
personal site into a group site later requires deliberate people/project
content collections, corresponding page and component modules, navigation, and
validation. Do not add inert `showPeople`, `showRecruiting`, or similar feature
flags before those public modules exist.

## Privacy and scientific-content boundary

The private `files/` directory is intentionally excluded. Do not copy the
current CV, research statements, private figures, unpublished project details,
or local source paths into `src/` or `public/`. The public site lists approved
facts from the CV but does not publish the CV itself.

Research visuals are authentic, approved figures from public papers and
preprints, plus Hao's original field photographs. Every figure needs
descriptive alternative text, a concise caption, and either a public
publication source or an explicit photo credit. Do not extract a slide figure
for publication unless it has been matched to an approved public source and
its reuse is permitted. Private figures and unpublished data remain private.

Future-research copy stays broad enough to communicate direction without
disclosing enabling project strategy.

The validator supports optional local confidential-term checks without storing
those terms in the public repository. Use either:

- `files/site-private-guard-terms.txt`, with one literal term per line; blank
  lines and lines beginning with `#` are ignored; or
- `SITE_PRIVATE_GUARD_TERMS`, with newline-delimited literal terms.

`SITE_PRIVATE_GUARD_FILE` may point to a different untracked local file. The
default file is covered by `.gitignore`. Never put confidential terms in
tracked scripts, documentation, `.env.example`, encoded strings, or comments.
The optional input may be absent; generic filename, path, PDF, and
manuscript-status guards still run.

## GitHub Pages

The project is configured for:

<https://antimonyleo.github.io/website/>

The workflow in `.github/workflows/deploy.yml` runs the release gate and
deploys the generated artifact on pushes to `main`. In the repository's Pages
settings, select **GitHub Actions** as the publishing source.

Do not deploy merely because the build succeeds. Complete the scientific,
responsive, keyboard, zoom, and reduced-motion review first.
