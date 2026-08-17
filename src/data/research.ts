export type ResearchFigureKind = "photograph" | "paper-figure";

export interface ResearchFigureData {
  id: string;
  kind: ResearchFigureKind;
  src: string;
  width: number;
  height: number;
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

export const researchFigures = {
  polycubes: {
    id: "polycubes-public-evidence",
    kind: "paper-figure",
    src: "images/research/dna-polycubes.webp",
    width: 1200,
    height: 799,
    alt: "Four columns repeated for three DNA polycube targets: the target shape, the cube-level design, an oxDNA simulation of the assembled structure, and the corresponding electron-microscopy image.",
    caption:
      "Finite DNA polycubes, from target geometry through simulation to experimental imaging. Three of the five targets in the published figure.",
    source: {
      publicationId: "polycubes-2025",
      locator: "Figure 2",
    },
  },
} as const satisfies Record<string, ResearchFigureData>;

export type ResearchFigureId = keyof typeof researchFigures;

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
  paperFigureId: ResearchFigureId;
  historicalSources: readonly {
    label: string;
    href: string;
  }[];
}

export interface ResearchScaleGroup {
  id: string;
  index: string;
  label: string;
  title: string;
  description: string;
  publications: readonly ResearchPublicationReference[];
  collaborations?: readonly ResearchCollaborationReference[];
  figureId?: ResearchFigureId;
  story?: ResearchStoryData;
}

export const researchScaleGroups = [
  {
    id: "finite-assemblies",
    index: "01",
    label: "Finite 3D assemblies",
    title: "Designing objects from programmable cubes",
    description:
      "DNA-origami cubes can be assigned a compact set of interaction rules that direct their assembly into finite targets, from small motifs to multicomponent, self-similar objects.",
    publications: [
      {
        publicationId: "polycubes-2025",
        role: "Co-first and co-corresponding author",
      },
    ],
    collaborations: [
      {
        publicationId: "meta-dna-2020",
        label: "hierarchical meta-DNA assembly",
      },
      {
        publicationId: "hairygami-2024",
        label: "conformational change in DNA nanostructures",
      },
    ],
    figureId: "polycubes",
  },
  {
    id: "open-crystal-lattices",
    index: "02",
    label: "Open crystal lattices",
    title: "Selecting crystal topology by interaction design",
    description:
      "Positive and negative design are posed as Boolean satisfiability problems and screened with patchy-particle simulations; the surviving designs are realized in DNA origami and verified by scattering and microscopy. One tetrahedron-shaped origami, reprogrammed only at its four sticky ends, assembles selectively into cubic diamond, hexagonal diamond, and ice 0 — precisely the polytype discrimination that makes tetrahedral lattices hard to assemble selectively. Calculations on idealized high-refractive-index analogues of these lattices connect the approach to photonic design.",
    publications: [
      {
        publicationId: "pyrochlore-2024",
        role: "First author",
      },
      {
        publicationId: "tetrahedral-lattices-2026",
        role: "First and co-corresponding author",
      },
    ],
  },
] as const satisfies readonly ResearchScaleGroup[];
