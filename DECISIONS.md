# Website decisions

Durable choices for the public site. Update this file only when a decision
changes; implementation history belongs in Git.

- **2026-10 — Homepage composition:** Use a wider 1040px editorial grid on
  Home, with the name as the primary display text, a subordinate degree suffix,
  and the authentic portrait opposite the introduction. The first selected
  paper carries a complete public scientific image, including its scale bar;
  its title links to Research. Keep the remaining papers compact. The career
  overview is three columns on desktop and dated rows on phones. The white
  ground, Archivo typeface and green accent remain; darker secondary text
  improves reading contrast.
- **2026-10 — Scientific image inspection:** The homepage image opens a native
  dialog with the complete caption, source citation and original-image link.
  Keyboard focus cycles within it; Close, Escape and backdrop dismissal return
  focus to the trigger. Without JavaScript the trigger opens the original image.
  Keep this interaction grounded in actual scientific evidence, with no image
  cropping, invented structures or decorative overlays.
- **2026-10 — Restrained motion:** The award-reference refinement adds a brief,
  already-visible homepage entrance and transitions for navigation, menu state,
  image inspection and link feedback. Respect reduced motion. No ambient loops,
  scroll-dependent visibility or automatic movement of scientific figures.
  This updates the earlier blanket removal of entrance motion.

- **2026-10 — Navigation and contact:** Use “Home” for the top-left return
  link. Research and Publications precede Experience so the work leads the
  site. Email and profile links stay on Home; the footer contains only the
  copyright and affiliation.
  Contact leaves the primary navigation. Its existing route remains available
  for old links and the email link's no-JavaScript fallback.

- **2026-10 — Research layout:** Lead with individual studies in a consistent
  image-and-text row. Short titles, one result paragraph, venue/status and
  verified authorship replace the repeated theme heading and paper-title layers.
  Theme IDs remain stable destinations for existing links. Complete figure
  captions remain in native disclosures; uncropped figures link to full-size
  originals. Earlier work and future directions are expandable at the end.
  No secondary sticky navigation or decorative image overlays.

- **2026-10 — Professional profile:** Balance academic and industry readers.
  Home remains a brief introduction with selected work and a small career
  overview; Experience carries appointments, methods, education, and talks.
  Selected work uses actual article titles and links to the research context.
  The career overview includes the current appointment, Ph.D. and B.S.; full
  details remain on Experience. Verified authorship roles now accompany the
  homepage work. This supersedes the earlier homepage role omission and
  theme-link strip. News is omitted from navigation and the footer while
  updates are infrequent; existing posts and routes are preserved.
- **2026-10 — Accepted polycube paper:** Hao confirmed acceptance in Science
  Robotics and requested that it be shown publicly. Display that acceptance
  beside an explicitly labeled preprint link. Keep the ChemRxiv DOI and 2025
  preprint citation until the final journal record is available; do not invent
  a publication year, journal DOI, volume or pages. This supersedes the earlier
  restriction on showing review status for this confirmed acceptance.
- **2026-10 — Content hierarchy:** Use headings, aligned dates, and spacing
  without redundant introductory labels or decorative timeline markers.
  Contact shows an “Email” link without revealing the address as visible text.
  Its destination is decoded in the browser; the raw HTML does not contain the
  plain address. The map and repeated research interests are removed. A future
  CV download would require a separately chosen public version; the private
  source document stays private.

- **2026-07 — Researcher profile:** The site represents Hao as an individual
  researcher, not a PI, group leader, recruiter, or product.
- **2026-07 — Public CV:** The current CV remains a private source record. The
  site lists approved facts but does not publish or link the CV.
- **2026-07 — Research scope:** Future directions stay broad and scoop-safe;
  enabling unpublished strategy is not public content.
- **2026-07 — Public record:** Publications are listed newest to oldest from
  structured data. Google Scholar provides the external complete record.
- **2026-07 — Publication selection:** Homepage emphasis is limited to a small
  set of works Hao led, with review status stated plainly; the Publications
  page remains the complete chronological record.
- **2026-07 — Authorship:** Contribution marks are shown on publications where
  Hao has a verified equal-contribution or corresponding-author role. When
  shown, every author sharing those marked roles on that paper is identified.
- **2026-08 — Research organization:** The Homepage and Research page foreground
  papers Hao led: finite three-dimensional assemblies, pyrochlore, and
  tetrahedral crystal lattices. Secondary-author work remains in the complete
  Publications record; supporting collaborations stay subordinate.
- **2026-08 — Field story:** The hexagonal-diamond field note belongs with the
  three-dimensional lattice work because the connection is topology, not
  composition. A one-line hook beneath the open-crystal-lattice studies links
  to the full story on its own Research subpage. The old anchor remains on the
  hook, and the story links back to its parent studies. This replaces the
  expandable note at the bottom of Research.
- **2026-08 — Scientific visuals:** Use approved public paper figures without
  decorative cropping. A dark stage or a black scale-bar label is normal in
  electron microscopy and is not grounds for dropping a figure; each paper the
  Research page claims should show its own evidence. Avoid generic AI
  scientific artwork and do not publish private slide or research assets.
- **2026-07 — Portrait:** Prefer an authentic photograph over an AI-modified
  portrait. A stronger real portrait may replace the current image later.
- **2026-09 — Minimal reading layout:** Hao selected a single-column minimal
  design with one visible summary sentence beneath every publication. Keep a
  small portrait and text-first publication lists; optional publication figures
  use a collapsed disclosure. Homepage summaries use the publication records directly.
  Page introductions and the footer stay compact at every viewport.
- **2026-09 — Research discovery and bibliography:** Home and Research reuse
  stable research anchors. The later study-row layout supersedes the visible
  theme labels. Publications use visible year groups,
  put each summary immediately below its title, and define contribution
  symbols once while retaining accessible author-specific role labels.
- **2026-09 — Motion:** Remove the ambient canvas, scroll reveals, and
  decorative figure movement. Content is visible immediately; keyboard focus,
  navigation state, and functional interactions remain. The later restrained-
  motion decision permits one brief homepage entrance and interaction feedback.
- **2026-09 — Page rhythm:** A hairline and the space around it separate
  sections. This supersedes the 2026-08 alternating sand band: a tint that
  spans the viewport was the single loudest device on a page that is otherwise
  type, and the compact system no longer needs a second ground to say where
  one argument ends.
- **2026-08 — Publication status:** The interface names the venue kind
  ("Preprint", "Commentary"). The later professional-profile and accepted-paper
  decisions add verified homepage authorship and confirmed journal acceptance.
- **2026-09 — Visual system (compact):** One white ground, near-black text,
  and a single deep green for what a reader can act on. One self-hosted
  typeface (Archivo) carries hierarchy through weight and size; the
  serif/sans pairing, the warm paper palette, the oxide second accent, and
  the dark footer were all retired as decoration once the type did that work.
  One reading column (820px) rather than a wide figure track beside a narrow
  one. This supersedes the 2026-08 editorial visual system and the 2026-09
  restrained pass, and it is a current choice, not a permanent build
  invariant.
- **2026-09 — Colour carries information or it goes:** Labels, indices,
  dates and venues are `--muted`; `--accent` marks only links, focus and the
  current item. The `--oxide` second accent was retired with the compact
  system — its "design vs. experiment" coding was real, but it was carried by
  small metadata a reader does not decode, and one hue doing less is quieter
  than two doing a little.
- **2026-07 — Content architecture:** Routine facts live in data or Markdown.
  If a routine update requires editing Astro markup, first check whether the
  data model is missing a field.
- **2026-07 — Maintenance:** Release checks block factual, privacy, structural,
  and accessibility defects. Temporary design preferences are advisory so the
  visual system can evolve deliberately.
- **2026-08 — News:** Short public updates live as individual Markdown files.
  Paper announcements reference stable publication IDs so formal metadata and
  review status continue to come from the publication source of truth.
- **2026-09 — Automated quality floor:** The release gate includes an
  automated axe-core accessibility scan and a performance budget check
  (compressed CSS, per-page transfer weight), both added as a Playwright
  devDependency. These are a general-purpose complement to this repo's
  hand-written accessibility/structural guards, not a replacement for them —
  the hand-written guards catch this site's specific claims, axe-core catches
  the WCAG issue classes nobody wrote a bespoke rule for.
- **2026-09 — Full browser editing:** Pages CMS covers profile/contact,
  Experience, whole publications, Research, figures and News. Individual
  publication and figure files support creation/deletion and live selectors.
  Legacy filenames/IDs are preserved; new filenames are automatic. Front Matter
  remains a local Markdown option, not a competing data editor.
- **2026-07 — Deployment:** GitHub Pages deployment follows a passing release
  gate and explicit approval; a successful build alone does not authorize it.
- **2026-09 — Hosted activation:** GitHub authorization and a signed-in
  save/round-trip exercise require the owner before adoption. News starts as
  a draft and generates no page, RSS item or sitemap entry. Drafts and uploaded
  images in a public repository are not private.
- **2026-09 — Format handling:** Forms and image pickers replace raw-file edits.
  The build derives citation links/status, image dimensions and responsive web
  copies. Original images remain intact. Replacement saves let editors clear
  optional content; complete form-field coverage is tested.
- **2026-09 — Deletion safety:** Remove references before deleting an in-use
  paper or figure. Checks reject dangling references without silently deleting
  scientific citations. Validation follows the edited content, not a fixed
  inventory or narrative; scientific correctness still needs human review.
- **2026-09 — Save is not publish:** Automatic workflow runs validate content
  only. Publication requires a manual workflow dispatch from `main` after
  approval and a passing gate. This supersedes the old push-to-main automatic
  deployment trigger; it takes effect remotely only when the workflow change
  is committed and pushed with approval. Hosted preview infrastructure is
  not yet configured; a maintainer reviews the local branch preview.
