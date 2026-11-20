import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getNewsItems } from "../../lib/news";
import { getPublicPerson } from "../../lib/person";
import { withBase } from "../../lib/urls";

export async function GET(context: APIContext) {
  const person = await getPublicPerson();
  const newsItems = await getNewsItems();
  const origin = context.site ?? new URL(context.url.origin);
  // context.site is the bare origin (astro.config.mjs's `site`); the public
  // base path (`/website`) is separate, so the feed's own <link> needs both,
  // same as every item link below already gets via withBase().
  const site = new URL(withBase(""), origin);

  return rss({
    title: `${person.name} — News`,
    description: `Research updates and short notes from ${person.name}.`,
    site,
    items: newsItems.map(({ post }) => ({
      title: post.data.title,
      pubDate: new Date(`${post.data.date}T00:00:00Z`),
      description: post.data.summary,
      link: new URL(withBase(`news/${post.id}/`), site).href,
    })),
    customData: `<language>en-us</language>`,
  });
}
