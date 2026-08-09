import { defineCollection } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

const people = defineCollection({
  loader: glob({ base: "./src/content/people", pattern: "**/*.md" }),
  schema: z.object({
    name: z.string(),
    degree: z.string(),
    role: z.string(),
    organizations: z.array(z.string()),
    location: z.string(),
    email: z.email(),
    orcid: z.url(),
    scholar: z.url(),
    bio: z.array(z.string()).min(1).max(4),
  }),
});

const contribution = z.object({
  role: z.enum(["equal-contribution", "corresponding-author"]),
  basis: z.enum([
    "explicit-equal-contribution-note",
    "explicit-corresponding-author-note",
  ]),
  sourceUrl: z.url(),
});

const publicationAuthor = z.object({
  name: z.string(),
  memberId: z.string().optional(),
  contributions: z.array(contribution).max(2).optional(),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date in YYYY-MM-DD format")
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
    },
    "Expected a valid calendar date",
  );

const publicationBase = z.object({
  title: z.string(),
  authors: z.array(publicationAuthor).min(1),
  memberIds: z.array(z.string()),
  year: z.number().int(),
  venue: z.string(),
  doi: z.string(),
  url: z.url(),
  featured: z.boolean(),
  selectedOrder: z.number().int().optional(),
  researchStoryId: z
    .enum(["rna-strand-displacement", "programmable-assembly"])
    .optional(),
  summary: z.string(),
  significance: z.string().optional(),
  image: z
    .object({
      src: z.string(),
      alt: z.string().min(1),
    })
    .optional(),
  topics: z.array(z.string()),
  relatedItems: z
    .array(
      z.object({
        relation: z.literal("author-correction"),
        title: z.string(),
        year: z.number().int(),
        venue: z.string(),
        volumePages: z.string(),
        doi: z.string(),
        url: z.url(),
        counted: z.literal(false),
      }),
    )
    .optional(),
  provenance: z.object({
    canonicalSource: z.object({
      label: z.string(),
      url: z.url(),
    }),
    sourceCheckedAt: isoDate,
  }),
});

const publications = defineCollection({
  loader: file("./src/data/publications.json"),
  schema: z.discriminatedUnion("kind", [
    publicationBase.extend({
      kind: z.literal("article"),
      recordStatus: z.literal("peer-reviewed"),
      volumePages: z.string().min(1),
      manuscriptStatus: z.never().optional(),
    }),
    publicationBase.extend({
      kind: z.literal("commentary"),
      recordStatus: z.literal("editorial"),
      volumePages: z.string().min(1),
      manuscriptStatus: z.never().optional(),
    }),
    publicationBase.extend({
      kind: z.literal("preprint"),
      recordStatus: z.literal("preprint-not-peer-reviewed"),
      volumePages: z.never().optional(),
      manuscriptStatus: z.enum(["Submitted", "In revision"]).optional(),
    }),
  ]),
});

const news = defineCollection({
  loader: glob({ base: "./src/content/news", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    date: isoDate,
    summary: z.string(),
    publicationId: z.string().optional(),
  }),
});

const experience = defineCollection({
  loader: glob({ base: "./src/content/experience", pattern: "**/*.md" }),
  schema: z.object({
    summary: z.string(),
    appointments: z.array(
      z.object({
        period: z.string(),
        title: z.string(),
        institution: z.string(),
        detail: z.string(),
        advisors: z
          .array(
            z.object({
              name: z.string(),
              url: z.url(),
            }),
          )
          .optional(),
      }),
    ),
    education: z.array(
      z.object({
        period: z.string(),
        degree: z.string(),
        institution: z.string(),
        detail: z.string(),
      }),
    ),
    capabilities: z.array(
      z.object({
        title: z.string(),
        items: z.array(z.string()),
      }),
    ),
    presentations: z.array(
      z.object({
        year: z.number().int(),
        venue: z.string(),
        title: z.string(),
      }),
    ),
    provenance: z.object({
      source: z.literal("CV supplied privately by Hao Liu"),
      publicationPolicy: z.literal(
        "Extracted factual information only; do not publish or link the CV",
      ),
      sourceCheckedAt: isoDate,
    }),
  }),
});

export const collections = {
  experience,
  news,
  people,
  publications,
};
