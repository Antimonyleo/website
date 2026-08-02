export const researchStoryLabels = {
  "rna-strand-displacement": "RNA strand-displacement research story",
  "programmable-assembly": "Programmable-assembly research story",
} as const;

export type ResearchStoryId = keyof typeof researchStoryLabels;

/** Anchor each story links to on /research/. Must match a real element id there. */
export const researchStoryAnchors = {
  "rna-strand-displacement": "molecular-programming-foundations",
  "programmable-assembly": "programmable-assembly",
} as const satisfies Record<ResearchStoryId, string>;

interface PublicationAuthor {
  name: string;
}

interface PublicationCitationData {
  authors: PublicationAuthor[];
  year: number;
  title: string;
  venue: string;
  volumePages?: string;
  doi: string;
}

interface BibtexPublication extends PublicationCitationData {
  id: string;
  kind: "article" | "commentary" | "preprint";
  recordStatus: "peer-reviewed" | "editorial" | "preprint-not-peer-reviewed";
  url: string;
}

export function formatCitation(publication: PublicationCitationData) {
  const authors = publication.authors.map((author) => author.name).join(", ");
  const venue = publication.volumePages
    ? `${publication.venue}, ${publication.volumePages}`
    : publication.venue;

  return `${authors} (${publication.year}). ${publication.title}. ${venue}. https://doi.org/${publication.doi}`;
}

function escapeBibtex(value: string) {
  return value
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_");
}

function bibtexField(name: string, value: string) {
  return `  ${name} = {${escapeBibtex(value)}}`;
}

function bibtexTitle(value: string) {
  return `  title = {{${escapeBibtex(value)}}}`;
}

export function formatBibtex(publication: BibtexPublication) {
  const entryType = publication.kind === "preprint" ? "misc" : "article";
  const fields = [
    bibtexField(
      "author",
      publication.authors.map((author) => author.name).join(" and "),
    ),
    bibtexTitle(publication.title),
    bibtexField("year", String(publication.year)),
  ];

  if (entryType === "article") {
    fields.push(bibtexField("journal", publication.venue));
  } else {
    fields.push(bibtexField("publisher", publication.venue));
  }

  if (publication.volumePages) {
    const [volume, ...pageParts] = publication.volumePages.split(",");
    const pages = pageParts.join(",").trim();

    if (volume?.trim()) {
      fields.push(bibtexField("volume", volume.trim()));
    }
    if (pages) {
      fields.push(bibtexField("pages", pages.replaceAll("–", "--")));
    }
  }

  fields.push(
    bibtexField("doi", publication.doi),
    bibtexField("url", publication.url),
  );

  if (publication.recordStatus === "preprint-not-peer-reviewed") {
    fields.push(bibtexField("note", "Preprint; not peer reviewed"));
  } else if (publication.recordStatus === "editorial") {
    fields.push(bibtexField("note", "Commentary"));
  }

  const key = publication.id.replaceAll("-", "_");
  return `@${entryType}{${key},\n${fields.join(",\n")}\n}`;
}
