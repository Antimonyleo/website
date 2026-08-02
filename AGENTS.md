# AGENTS.md

## Project

Static Astro research website for Hao Liu, deployed as a GitHub Pages project
site under `/website/`. It is a researcher profile, not a CV, product landing
page, PI/lab site, or recruiting site.

## Working principles

- Think before editing. State material assumptions and surface ambiguous choices.
- Prefer the smallest solution that fully addresses the request.
- Make surgical changes; preserve unrelated user work and existing conventions.
- Do not add speculative abstractions, features, pages, or configuration.
- Define success criteria first and verify the result, including rendered pages
  when layout or content changes.

## Content boundaries

- Treat `files/` as private. Never publish or link the current CV, research
  statements, unpublished work, private figures, local paths, or target journals.
- Keep future-research language broad and scoop-safe.
- Do not invent scientific claims, contributions, authorship, or publication
  status. Use `src/data/publications.json` and approved public sources.
- Do not add awards, recruiting language, or PI/group-site features unless the
  user explicitly requests them.
- Prefer authentic, reusable scientific figures. Avoid generic or scientifically
  imprecise AI artwork.

## Design and implementation

- Aim for a restrained editorial academic site: one coherent grid, type scale,
  palette, and spacing system.
- Avoid SaaS/portfolio chrome, decorative process diagrams, repeated slogans,
  excessive badges, and duplicated content across pages.
- Organize each page by one clear principle. Do not let validators preserve a
  superseded information architecture.
- Keep CSS in `src/styles/global.css`; keep JavaScript optional and minimal.
- Preserve the GitHub Pages base path through the helpers in `src/lib/urls.ts`.
- Check layout at 390px, 768–834px, and 1440px, including awkward line breaks,
  overflow, keyboard access, and reduced motion.

## Sources of truth

- Identity and public contact: `src/content/people/hao-liu.md`
- Experience: `src/content/experience/hao-liu.md`
- Publications and authorship metadata: `src/data/publications.json`
- Research narrative and figure metadata: `src/data/research.ts`
- Site-wide configuration: `src/config.ts`
- Public/privacy/build contract: `scripts/validate-build.mjs`

For routine changes, follow `CONTENT.md`; for the rationale behind durable
choices, consult `DECISIONS.md`. The strategy and audit plans are historical
records, not current implementation instructions.

## Verification

Run `npm test` for release-level changes. For visual changes, also inspect the
localhost site at the target viewport sizes. Do not deploy without explicit
user approval.

Working style adapted from the
[Karpathy coding guidelines](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md).
