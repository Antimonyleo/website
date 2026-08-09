import { getCollection, type CollectionEntry } from "astro:content";

export interface NewsItem {
  post: CollectionEntry<"news">;
  publication?: CollectionEntry<"publications">;
}

export async function getNewsItems(): Promise<NewsItem[]> {
  const [posts, publications] = await Promise.all([
    getCollection("news"),
    getCollection("publications"),
  ]);
  const publicationsById = new Map(
    publications.map((publication) => [publication.id, publication]),
  );

  return posts
    .map((post) => {
      const publication = post.data.publicationId
        ? publicationsById.get(post.data.publicationId)
        : undefined;

      if (post.data.publicationId && !publication) {
        throw new Error(
          `News post ${post.id} references missing publication ${post.data.publicationId}`,
        );
      }

      return { post, publication };
    })
    .sort(
      (a, b) =>
        b.post.data.date.localeCompare(a.post.data.date) ||
        a.post.id.localeCompare(b.post.id),
    );
}

export function formatNewsDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
