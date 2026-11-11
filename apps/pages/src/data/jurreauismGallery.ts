export interface ArtArtifact {
  id: string;
  title: string;
  category:
    | "JURREAUISM CANNABIS / ART"
    | "MEMOIR"
    | "TECHNICAL MONOGRAPH"
    | "SONIC ARTIFACT";
  description: string;
  valuationUsd: string;
  signature: string;
}

export const JURREAUISM_GALLERY: ArtArtifact[] = [
  {
    id: "ART-001",
    title: "The Crown of Return (Canvas Rendering I)",
    category: "JURREAUISM CANNABIS / ART",
    description:
      "Core visual manifestation of somatic sovereignty and symbolic art cryptography.",
    valuationUsd: "$2,400.00",
    signature: "MaxJ",
  },
  {
    id: "ART-002",
    title: "The Distortion Principle",
    category: "TECHNICAL MONOGRAPH",
    description:
      "Advanced computational systems model and quantum-inspired macroeconomic framework.",
    valuationUsd: "$1,850.00",
    signature: "Max Jurreau",
  },
  {
    id: "ART-003",
    title: "Descent → Abyss → Edge → Ascent",
    category: "MEMOIR",
    description:
      "Transformational narrative architecture tracking non-ordinary perception and sovereignty.",
    valuationUsd: "$1,200.00",
    signature: "Max Jurreau",
  },
  {
    id: "ART-004",
    title: "Path-B Sector 01 Simulation Matrix",
    category: "JURREAUISM CANNABIS / ART",
    description:
      "Deterministic 1Hz execution grid rendering emotional metadata into canvas coordinates.",
    valuationUsd: "$3,100.00",
    signature: "MaxJ",
  },
];
