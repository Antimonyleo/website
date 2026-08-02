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
    height: 1427,
    alt: "Four columns repeated for five DNA polycube targets: the target shape, the cube-level design, an oxDNA simulation of the assembled structure, and the corresponding electron-microscopy image.",
    caption:
      "Finite DNA polycubes, from target geometry through simulation to experimental imaging.",
    source: {
      publicationId: "polycubes-2025",
      locator: "Figure 2",
    },
  },
  pyrochlore: {
    id: "pyrochlore-published-evidence",
    kind: "paper-figure",
    src: "images/research/pyrochlore-crystal.webp",
    width: 1200,
    height: 900,
    alt: "Scanning electron micrograph of a faceted, silica-preserved DNA-origami pyrochlore crystal about ten micrometers across, its surface showing the ordered pore pattern of the underlying lattice.",
    caption:
      "Silica-preserved DNA-origami pyrochlore crystal imaged by scanning electron microscopy; the faceted habit and ordered surface pores follow the designed lattice. Topology and long-range order are established in the linked paper by small-angle X-ray scattering, following interaction design and coarse-grained modeling.",
    source: {
      publicationId: "pyrochlore-2024",
      showDoi: true,
    },
  },
  tessellations: {
    id: "tessellations-public-evidence",
    kind: "paper-figure",
    src: "images/research/dna-origami-tessellations.webp",
    width: 853,
    height: 301,
    alt: "Three atomic-force micrographs side by side, each showing rings assembled from wedge-shaped DNA-origami tiles: five-tile rings in the first field, six in the second, seven in the third.",
    caption:
      "A detail from the published figure: the same wedge-shaped tile closes into five-, six-, or seven-member rings depending on the interhelical spacing it is designed with. Scale bar 200 nm.",
    source: {
      publicationId: "dna-origami-tessellations-2023",
    },
  },
  meteorCrater: {
    id: "meteor-crater-field-photo",
    kind: "photograph",
    src: "images/research/meteor-crater.webp",
    width: 1600,
    height: 1200,
    alt: "Wide view across Meteor Crater in northern Arizona.",
    captionLabel: "Site.",
    caption: "Meteor Crater, Arizona.",
    credit: "Photo by Hao Liu, 2025.",
  },
  canyonDiablo: {
    id: "canyon-diablo-specimen",
    kind: "photograph",
    src: "images/research/canyon-diablo-meteorite.webp",
    width: 1200,
    height: 900,
    alt: "Canyon Diablo meteorite specimen displayed at the Meteor Crater visitor center.",
    captionLabel: "Specimen.",
    caption: "Canyon Diablo meteorite.",
    credit: "Photo by Hao Liu, 2025.",
  },
  hexagonalDiamond: {
    id: "hexagonal-diamond-public-evidence",
    kind: "paper-figure",
    src: "images/research/hexagonal-diamond-detail.webp",
    width: 1640,
    height: 560,
    alt: "Scanning electron micrographs show a faceted DNA-origami hexagonal-diamond crystal and the ordered pattern resolved on its basal plane.",
    captionLabel: "Laboratory analogue.",
    caption:
      "A detail from the preprint figure: the hexagonal habit and the ordered basal-plane pattern. In-plane order alone does not distinguish hexagonal from cubic diamond — the two differ only in stacking sequence, which the preprint resolves by small-angle X-ray scattering. The complete figure is in the linked preprint.",
    source: {
      publicationId: "tetrahedral-lattices-2026",
      locator: "Figure 4f–g detail",
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
    label: "Finite systems",
    title: "Programmable three-dimensional objects",
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
    id: "two-dimensional-arrays",
    index: "02",
    label: "Extended arrays",
    title: "DNA origami tessellations",
    description:
      "Tuned tile geometry and interhelical spacing allow DNA-origami building blocks to form micrometer-scale two-dimensional patterns with nanometer-scale organization.",
    publications: [
      {
        publicationId: "dna-origami-tessellations-2023",
        role: "Second author",
      },
    ],
    figureId: "tessellations",
  },
  {
    id: "open-crystal-lattices",
    index: "03",
    label: "Open crystal lattices",
    title: "Interaction design for three-dimensional topology",
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
    figureId: "pyrochlore",
    story: {
      id: "hexagonal-diamond-story",
      eyebrow: "Field note",
      title: "A hexagonal-diamond connection",
      description:
        "Natural-history context for the three-dimensional lattice work.",
      paragraphs: [
        "In 1967, a hexagonal polymorph of diamond was described in shock-transformed graphite inclusions from the Canyon Diablo iron meteorite, the body that formed Arizona’s Meteor Crater. Whether those grains are a distinct hexagonal phase or stacking-disordered cubic diamond has been debated, and the interpretation refined, ever since.",
        "I visited the crater after leading a study that reports selective assembly of the same diamond network at the colloidal scale. The shared problem is polytype selection, not composition: cubic and hexagonal diamond differ only in stacking sequence, which is exactly what makes it hard to show that one has formed rather than the other. The meteoritic case is a long-running example of that difficulty in shock-transformed carbon; the laboratory crystal is assembled from DNA-origami tetrahedra, where the stacking is set by design and read out by scattering.",
      ],
      photoFigureIds: ["meteorCrater", "canyonDiablo"],
      paperFigureId: "hexagonalDiamond",
      historicalSources: [
        {
          label: "Frondel & Marvin, Nature 1967",
          href: "https://doi.org/10.1038/214587a0",
        },
        {
          label: "Hanneman et al., Science 1967",
          href: "https://doi.org/10.1126/science.155.3765.995",
        },
        {
          label: "Németh et al., Phil. Trans. R. Soc. A 2023",
          href: "https://doi.org/10.1098/rsta.2022.0344",
        },
      ],
    },
  },
] as const satisfies readonly ResearchScaleGroup[];
