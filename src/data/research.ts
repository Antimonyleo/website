// Typed rendering adapter for the Research page and shared figure library.
// Editors manage these through Pages CMS; check:research validates references.
import researchData from "./research.json" with { type: "json" };
import { readRecords, referenceId } from "../lib/content-source.ts";

export const researchPage = { ...researchData, methods: { ...researchData.methods, paragraphs: researchData.methods.paragraphs ?? [] }, foundations: { ...researchData.foundations, paragraphs: researchData.foundations.paragraphs ?? [], publicationIds: (researchData.foundations.publicationIds ?? []).map(referenceId) }, directions: { ...researchData.directions, paragraphs: researchData.directions.paragraphs ?? [], figureId: researchData.directions.figureId ? referenceId(researchData.directions.figureId) : undefined } };

export type ResearchFigureKind = "photograph" | "paper-figure" | "schematic";

export interface ResearchFigureData {
  id: string;
  kind: ResearchFigureKind;
  src: string;
  width?: number;
  height?: number;
  alt: string;
  caption: string;
  captionLabel?: string;
  credit?: string;
  source?: {
    publicationId: string;
    locator?: string;
    showDoi?: boolean;
  };
}

export const researchFigures = Object.fromEntries(readRecords("src/content/figures").map((figure) => [figure.id, { ...figure, source: figure.source?.publicationId ? { ...figure.source, publicationId: referenceId(figure.source.publicationId) } : undefined }])) as Record<string, ResearchFigureData>;

// Figure filenames are stable keys; new library entries need no code change.
export type ResearchFigureId = string;

export interface ResearchPublicationReference {
  publicationId: string;
  role: string;
}

export interface ResearchCollaborationReference {
  publicationId: string;
  label: string;
}

export interface ResearchStoryData {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  paragraphs: readonly string[];
  photoFigureIds: readonly ResearchFigureId[];
  /*
    Optional: a field note carries its own paper figure only when that figure
    is not already shown by the group above it. Promoting the hexagonal-diamond
    micrograph to a group figure means the note keeps just the photographs.
  */
  paperFigureId?: ResearchFigureId;
  historicalSources: readonly {
    label: string;
    href: string;
  }[];
}

export interface ResearchScaleGroup {
  id: string;
  anchor?: string;
  index: string;
  label: string;
  title: string;
  description: string;
  publications: readonly ResearchPublicationReference[];
  collaborations?: readonly ResearchCollaborationReference[];
  /*
    A list, not a single id: a group that covers two papers should be able to
    show the evidence for both. Open crystal lattices carries the pyrochlore
    and hexagonal-diamond micrographs side by side.
  */
  figureIds?: readonly ResearchFigureId[];
  story?: ResearchStoryData;
}

export const researchScaleGroups = ((researchData.groups ?? []) as ResearchScaleGroup[]).map((group, index) => ({
  ...group,
  id: group.id || group.anchor!,
  index: String(index + 1).padStart(2, "0"),
  publications: (group.publications ?? []).map((item) => ({ ...item, publicationId: referenceId(item.publicationId) })),
  collaborations: (group.collaborations ?? []).map((item) => ({ ...item, publicationId: referenceId(item.publicationId) })),
  figureIds: (group.figureIds ?? []).map(referenceId),
  story: group.story ? { ...group.story, id: group.story.id || `${group.id || group.anchor}-note`, photoFigureIds: (group.story.photoFigureIds ?? []).map(referenceId), paperFigureId: group.story.paperFigureId ? referenceId(group.story.paperFigureId) : undefined, historicalSources: group.story.historicalSources ?? [] } : undefined,
}));
