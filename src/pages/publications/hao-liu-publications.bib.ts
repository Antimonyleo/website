import { getCollection } from "astro:content";
import { formatBibtex } from "../../lib/publications";

export const prerender = true;

export async function GET() {
  const publications = (await getCollection("publications")).sort(
    (a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title),
  );
  const bibliography = publications
    .map((publication) =>
      formatBibtex({
        id: publication.id,
        authors: publication.data.authors,
        year: publication.data.year,
        title: publication.data.title,
        venue: publication.data.venue,
        volumePages: publication.data.volumePages,
        doi: publication.data.doi,
        kind: publication.data.kind,
        recordStatus: publication.data.recordStatus,
        url: publication.data.url,
      }),
    )
    .join("\n\n");

  return new Response(`${bibliography}\n`, {
    headers: {
      "Content-Disposition":
        'attachment; filename="hao-liu-publications.bib"',
      "Content-Type": "application/x-bibtex; charset=utf-8",
    },
  });
}
