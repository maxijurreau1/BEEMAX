import { useState } from "react";
import { JURREAUISM_GALLERY, type ArtArtifact } from "../data/jurreauismGallery";

export const GalleryMarketplacePage: React.FC = () => {
  const [selectedArtifact, setSelectedArtifact] = useState<ArtArtifact>(
    JURREAUISM_GALLERY[0],
  );
  const [acquisitionStatus, setAcquisitionStatus] = useState(
    "READY FOR P2P SETTLEMENT",
  );

  const handleAcquire = (artifact: ArtArtifact) => {
    setAcquisitionStatus(
      `PROCESSING ACQUISITION FOR ${artifact.title} [100% RETENTION]`,
    );
    window.setTimeout(() => {
      setAcquisitionStatus(
        `SECURED: ${artifact.title} // SIGNED BY ${artifact.signature}`,
      );
    }, 1200);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>JURREAUISM // MAX ART &amp; MARKETPLACE GALLERY</h1>
        <div style={styles.statusBadge}>
          ANCHOR: bba28add4f99bd9aae158f173168145d [$0.00/MO]
        </div>
      </header>

      <div style={styles.grid}>
        <section style={styles.sidebar} aria-label="Artifact inventory">
          <h2 style={styles.sidebarTitle}>CATALOGUE // ARTIFACTS</h2>
          {JURREAUISM_GALLERY.map((artifact) => (
            <button
              key={artifact.id}
              type="button"
              aria-pressed={selectedArtifact.id === artifact.id}
              style={{
                ...styles.card,
                borderColor:
                  selectedArtifact.id === artifact.id
                    ? "#00ffcc"
                    : "rgba(0,255,204,0.15)",
              }}
              onClick={() => setSelectedArtifact(artifact)}
            >
              <span style={styles.cardTitle}>{artifact.title}</span>
              <span style={styles.cardSub}>
                {artifact.category} | {artifact.valuationUsd}
              </span>
            </button>
          ))}
        </section>

        <main style={styles.viewport}>
          <div style={styles.inspectorBox}>
            <div style={styles.inspectorTag}>
              INSPECTION MATRIX // {selectedArtifact.id}
            </div>
            <h2 style={styles.artifactTitle}>{selectedArtifact.title}</h2>
            <div style={styles.artifactMeta}>
              <span>
                AUTHOR: <strong>{selectedArtifact.signature}</strong>
              </span>
              <span>
                VALUATION: <strong style={{ color: "#00ffcc" }}>{selectedArtifact.valuationUsd}</strong>
              </span>
            </div>
            <p style={styles.artifactDesc}>{selectedArtifact.description}</p>

            <div style={styles.acquisitionPanel}>
              <div aria-live="polite" style={styles.acquisitionStatus}>
                STATUS: {acquisitionStatus}
              </div>
              <button
                type="button"
                style={styles.acquireBtn}
                onClick={() => handleAcquire(selectedArtifact)}
              >
                Initiate Sovereign P2P Acquisition
              </button>
              <p style={styles.demoNote}>
                Demo interaction only; this does not process a payment or transfer ownership.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: "#010103",
    color: "#c0fef0",
    fontFamily: "'Courier New', Courier, monospace",
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: 20,
    boxSizing: "border-box",
  },
  header: {
    backgroundColor: "rgba(3, 3, 8, 0.92)",
    border: "1px solid rgba(0, 255, 204, 0.25)",
    backdropFilter: "blur(15px)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 25px",
    marginBottom: 20,
    gap: 16,
  },
  headerTitle: {
    fontSize: 15,
    letterSpacing: 3,
    color: "#00ffcc",
    margin: 0,
    textShadow: "0 0 10px rgba(0,255,204,0.5)",
  },
  statusBadge: {
    fontSize: 10,
    color: "#ffaa00",
    border: "1px solid #ffaa00",
    padding: "4px 10px",
    letterSpacing: 1,
    backgroundColor: "rgba(255, 170, 0, 0.04)",
    textAlign: "right",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)",
    gap: 20,
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  sidebar: {
    backgroundColor: "rgba(3, 3, 8, 0.92)",
    border: "1px solid rgba(0, 255, 204, 0.25)",
    padding: 20,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sidebarTitle: {
    fontSize: 12,
    color: "#ff00aa",
    borderBottom: "1px solid rgba(255,0,170,0.25)",
    paddingBottom: 6,
    letterSpacing: 2,
    margin: 0,
  },
  card: {
    appearance: "none",
    textAlign: "left",
    width: "100%",
    backgroundColor: "rgba(0, 255, 204, 0.02)",
    border: "1px solid",
    padding: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  },
  cardTitle: {
    display: "block",
    fontSize: 11,
    fontWeight: "bold",
    color: "#c0fef0",
  },
  cardSub: {
    display: "block",
    fontSize: 9,
    color: "#778899",
    marginTop: 4,
  },
  viewport: {
    backgroundColor: "rgba(3, 3, 8, 0.92)",
    border: "1px solid rgba(0, 255, 204, 0.25)",
    padding: 40,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    overflowY: "auto",
  },
  inspectorBox: {
    maxWidth: 600,
    width: "100%",
    border: "1px solid rgba(0, 255, 204, 0.3)",
    padding: 30,
    backgroundColor: "rgba(0, 255, 204, 0.01)",
  },
  inspectorTag: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#ff00aa",
    marginBottom: 10,
  },
  artifactTitle: {
    fontSize: 20,
    color: "#00ffcc",
    letterSpacing: 1.5,
    margin: "0 0 15px",
  },
  artifactMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 11,
    color: "#aabbcc",
    marginBottom: 20,
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    paddingBottom: 10,
  },
  artifactDesc: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "#c0fef0",
    marginBottom: 30,
  },
  acquisitionPanel: {
    borderTop: "1px dashed rgba(0,255,204,0.3)",
    paddingTop: 20,
    textAlign: "center",
  },
  acquisitionStatus: {
    fontSize: 10,
    color: "#ffaa00",
    marginBottom: 10,
  },
  acquireBtn: {
    backgroundColor: "transparent",
    border: "1px solid #00ffcc",
    color: "#00ffcc",
    padding: "12px 24px",
    fontFamily: "monospace",
    fontWeight: "bold",
    cursor: "pointer",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    width: "100%",
    transition: "0.2s",
  },
  demoNote: {
    color: "#778899",
    fontSize: 10,
    lineHeight: 1.5,
    margin: "12px 0 0",
  },
};
