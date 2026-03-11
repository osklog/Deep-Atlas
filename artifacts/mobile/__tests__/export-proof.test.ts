import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { atlasToJSON, atlasToMarkdown } from "@/lib/export";
import type { Atlas } from "@/types/atlas";

const EXPORT_DIR = path.resolve(import.meta.dirname, "../../../verification/sample-exports");

function makeProofAtlas(): Atlas {
  const now = new Date().toISOString();
  return {
    id: "proof-atlas-001",
    title: "Quantum Computing & Cryptography",
    description: "A deep dive into how quantum computing threatens and enables new forms of cryptography, including post-quantum algorithms.",
    color: "#1E5AA8",
    nodes: [
      { id: "n1", type: "concept", title: "Quantum Entanglement", note: "Particles share states across arbitrary distances — the foundation of quantum key distribution.", tags: ["physics", "foundation"], x: 100, y: 100, createdAt: now, updatedAt: now },
      { id: "n2", type: "concept", title: "Shor's Algorithm", note: "Polynomial-time integer factorization on a quantum computer. Threatens RSA and ECC.", tags: ["algorithm", "threat"], x: 250, y: 100, createdAt: now, updatedAt: now },
      { id: "n3", type: "person", title: "Peter Shor", note: "MIT mathematician who discovered the algorithm in 1994 that would eventually threaten public-key cryptography.", tags: ["researcher"], x: 250, y: 250, createdAt: now, updatedAt: now },
      { id: "n4", type: "company", title: "IBM Quantum", note: "Operates the largest fleet of quantum computers. Their 1,121-qubit Condor processor launched in 2023.", tags: ["industry"], x: 400, y: 100, createdAt: now, updatedAt: now },
      { id: "n5", type: "source", title: "NIST Post-Quantum Standards", note: "NIST finalized CRYSTALS-Kyber and CRYSTALS-Dilithium as post-quantum standards in 2024.", tags: ["standards"], x: 400, y: 250, createdAt: now, updatedAt: now },
      { id: "n6", type: "question", title: "When will RSA be broken?", note: "Estimates range from 2030 to 2050+. Depends on error correction breakthroughs.", tags: ["timeline"], x: 550, y: 100, createdAt: now, updatedAt: now },
      { id: "n7", type: "event", title: "NIST PQC Standardization (2024)", note: "First post-quantum cryptographic standards published, marking a critical milestone.", tags: ["milestone"], x: 550, y: 250, createdAt: now, updatedAt: now },
      { id: "n8", type: "hypothesis", title: "Quantum Supremacy is Overstated", note: "Some researchers argue current 'quantum advantage' demos solve contrived problems with no practical value.", tags: ["debate"], x: 100, y: 250, createdAt: now, updatedAt: now },
      { id: "n9", type: "quote", title: "Feynman on Simulation", note: '"Nature isn\'t classical, dammit, and if you want to make a simulation of nature, you\'d better make it quantum mechanical." — Richard Feynman, 1981', tags: ["philosophy"], x: 100, y: 400, createdAt: now, updatedAt: now },
      { id: "n10", type: "media", title: "IBM Quantum Roadmap Diagram", note: "Visual showing the path from 127 qubits (Eagle, 2021) to 100,000+ qubits by 2033.", tags: ["visual"], x: 400, y: 400, createdAt: now, updatedAt: now },
      { id: "n11", type: "concept", title: "Über-Verschränkung (超纠缠)", note: "Unicode test: A hypothetical stronger-than-entanglement quantum correlation. Ελληνικά: κβαντική. 日本語: 量子.", tags: ["unicode", "物理学"], x: 250, y: 400, createdAt: now, updatedAt: now },
    ],
    edges: [
      { id: "e1", sourceId: "n1", targetId: "n2", label: "enables", createdAt: now },
      { id: "e2", sourceId: "n3", targetId: "n2", label: "invented", createdAt: now },
      { id: "e3", sourceId: "n2", targetId: "n6", label: "raises", createdAt: now },
      { id: "e4", sourceId: "n4", targetId: "n8", label: "challenges", createdAt: now },
      { id: "e5", sourceId: "n5", targetId: "n7", label: "produced by", createdAt: now },
      { id: "e6", sourceId: "n9", targetId: "n1", label: "inspired", createdAt: now },
      { id: "e7", sourceId: "n4", targetId: "n10", label: "published", createdAt: now },
      { id: "e8", sourceId: "n1", targetId: "n11", label: "relates to", createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe("export proof — generate and verify real artifacts", () => {
  const atlas = makeProofAtlas();

  it("generates valid JSON export and writes to file", () => {
    const json = atlasToJSON(atlas);

    fs.mkdirSync(EXPORT_DIR, { recursive: true });
    fs.writeFileSync(path.join(EXPORT_DIR, "proof-atlas.json"), json, "utf-8");

    const parsed = JSON.parse(json);
    expect(parsed.id).toBe("proof-atlas-001");
    expect(parsed.title).toBe("Quantum Computing & Cryptography");
    expect(parsed.nodes).toHaveLength(11);
    expect(parsed.edges).toHaveLength(8);

    expect(parsed.nodes[10].title).toBe("Über-Verschränkung (超纠缠)");
    expect(parsed.nodes[10].tags).toContain("物理学");

    expect(parsed.nodes[8].note).toContain("Feynman");
    expect(parsed.nodes[8].note).toContain('"');
  });

  it("JSON round-trips without data loss", () => {
    const json = atlasToJSON(atlas);
    const parsed = JSON.parse(json);
    const reJson = JSON.stringify(parsed, null, 2);
    const reParsed = JSON.parse(reJson);

    expect(reParsed.title).toBe(atlas.title);
    expect(reParsed.nodes).toHaveLength(atlas.nodes.length);
    expect(reParsed.edges).toHaveLength(atlas.edges.length);

    for (let i = 0; i < atlas.nodes.length; i++) {
      expect(reParsed.nodes[i].title).toBe(atlas.nodes[i].title);
      expect(reParsed.nodes[i].type).toBe(atlas.nodes[i].type);
      expect(reParsed.nodes[i].note).toBe(atlas.nodes[i].note);
      expect(reParsed.nodes[i].tags).toEqual(atlas.nodes[i].tags);
    }

    for (let i = 0; i < atlas.edges.length; i++) {
      expect(reParsed.edges[i].label).toBe(atlas.edges[i].label);
      expect(reParsed.edges[i].sourceId).toBe(atlas.edges[i].sourceId);
      expect(reParsed.edges[i].targetId).toBe(atlas.edges[i].targetId);
    }
  });

  it("generates readable Markdown export and writes to file", () => {
    const md = atlasToMarkdown(atlas);

    fs.writeFileSync(path.join(EXPORT_DIR, "proof-atlas.md"), md, "utf-8");

    expect(md).toContain("# Quantum Computing & Cryptography");
    expect(md).toContain("**11 nodes**");
    expect(md).toContain("**8 connections**");

    expect(md).toContain("## Concept (3)");
    expect(md).toContain("## Person (1)");
    expect(md).toContain("## Company (1)");
    expect(md).toContain("## Source (1)");
    expect(md).toContain("## Question (1)");
    expect(md).toContain("## Event (1)");
    expect(md).toContain("## Hypothesis (1)");
    expect(md).toContain("## Quote (1)");
    expect(md).toContain("## Media (1)");

    expect(md).toContain("### Quantum Entanglement");
    expect(md).toContain("### Peter Shor");
    expect(md).toContain("### IBM Quantum");

    expect(md).toContain("## Connections");
    expect(md).toContain("**Quantum Entanglement** → *enables* → **Shor's Algorithm**");
    expect(md).toContain("**Peter Shor** → *invented* → **Shor's Algorithm**");

    expect(md).toContain("#physics");
    expect(md).toContain("#algorithm");

    expect(md).toContain("Über-Verschränkung (超纠缠)");
    expect(md).toContain("Ελληνικά");
    expect(md).toContain("#物理学");
  });

  it("filenames would be sane after sanitization", () => {
    function sanitizeFilename(name: string): string {
      return name.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 60) || "atlas";
    }

    const sanitized = sanitizeFilename(atlas.title);
    expect(sanitized).toBe("Quantum_Computing_Cryptography");
    expect(sanitized.length).toBeLessThanOrEqual(60);
    expect(sanitized).not.toContain("&");
  });

  it("exported files exist on disk with correct sizes", () => {
    const jsonPath = path.join(EXPORT_DIR, "proof-atlas.json");
    const mdPath = path.join(EXPORT_DIR, "proof-atlas.md");

    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(mdPath)).toBe(true);

    const jsonSize = fs.statSync(jsonPath).size;
    const mdSize = fs.statSync(mdPath).size;

    expect(jsonSize).toBeGreaterThan(1000);
    expect(mdSize).toBeGreaterThan(500);
  });
});
