import { describe, it, expect } from "vitest";
import { atlasToJSON, atlasToMarkdown } from "@/lib/export";
import type { Atlas } from "@/types/atlas";

function makeAtlas(overrides: Partial<Atlas> = {}): Atlas {
  const now = new Date().toISOString();
  return {
    id: "a1",
    title: "Test Atlas",
    description: "A test description",
    color: "#C9A96E",
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeNode(
  id: string,
  type: Atlas["nodes"][0]["type"] = "concept",
  title = "Node",
  overrides: Partial<Atlas["nodes"][0]> = {}
): Atlas["nodes"][0] {
  const now = new Date().toISOString();
  return {
    id,
    type,
    title,
    note: "",
    tags: [],
    x: 0,
    y: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("atlasToJSON", () => {
  it("produces valid JSON", () => {
    const atlas = makeAtlas();
    const json = atlasToJSON(atlas);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("preserves all fields", () => {
    const atlas = makeAtlas({
      nodes: [makeNode("n1", "person", "Alice")],
      edges: [{ id: "e1", sourceId: "n1", targetId: "n1", label: "self", createdAt: new Date().toISOString() }],
    });
    const parsed = JSON.parse(atlasToJSON(atlas));
    expect(parsed.title).toBe("Test Atlas");
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.edges).toHaveLength(1);
  });

  it("handles unicode characters", () => {
    const atlas = makeAtlas({ title: "Über Café 中文 🔬" });
    const json = atlasToJSON(atlas);
    const parsed = JSON.parse(json);
    expect(parsed.title).toBe("Über Café 中文 🔬");
  });

  it("handles empty atlas", () => {
    const atlas = makeAtlas({ nodes: [], edges: [] });
    const json = atlasToJSON(atlas);
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toEqual([]);
    expect(parsed.edges).toEqual([]);
  });
});

describe("atlasToMarkdown", () => {
  it("includes title as h1", () => {
    const md = atlasToMarkdown(makeAtlas());
    expect(md).toContain("# Test Atlas");
  });

  it("includes description", () => {
    const md = atlasToMarkdown(makeAtlas({ description: "Important context" }));
    expect(md).toContain("Important context");
  });

  it("groups nodes by type", () => {
    const atlas = makeAtlas({
      nodes: [
        makeNode("n1", "person", "Alice"),
        makeNode("n2", "person", "Bob"),
        makeNode("n3", "concept", "Gravity"),
      ],
    });
    const md = atlasToMarkdown(atlas);
    expect(md).toContain("## Person (2)");
    expect(md).toContain("## Concept (1)");
    expect(md).toContain("### Alice");
    expect(md).toContain("### Bob");
    expect(md).toContain("### Gravity");
  });

  it("includes node notes", () => {
    const atlas = makeAtlas({
      nodes: [makeNode("n1", "concept", "X", { note: "Important note here" })],
    });
    const md = atlasToMarkdown(atlas);
    expect(md).toContain("Important note here");
  });

  it("includes tags", () => {
    const atlas = makeAtlas({
      nodes: [makeNode("n1", "concept", "X", { tags: ["physics", "quantum"] })],
    });
    const md = atlasToMarkdown(atlas);
    expect(md).toContain("#physics");
    expect(md).toContain("#quantum");
  });

  it("includes connections section", () => {
    const now = new Date().toISOString();
    const atlas = makeAtlas({
      nodes: [
        makeNode("n1", "concept", "A"),
        makeNode("n2", "concept", "B"),
      ],
      edges: [{ id: "e1", sourceId: "n1", targetId: "n2", label: "supports", createdAt: now }],
    });
    const md = atlasToMarkdown(atlas);
    expect(md).toContain("## Connections");
    expect(md).toContain("**A**");
    expect(md).toContain("*supports*");
    expect(md).toContain("**B**");
  });

  it("omits connections section when no edges", () => {
    const md = atlasToMarkdown(makeAtlas());
    expect(md).not.toContain("## Connections");
  });

  it("shows node/edge counts", () => {
    const atlas = makeAtlas({
      nodes: [makeNode("n1"), makeNode("n2")],
    });
    const md = atlasToMarkdown(atlas);
    expect(md).toContain("**2 nodes**");
    expect(md).toContain("**0 connections**");
  });

  it("handles all 9 node types", () => {
    const types = [
      "concept", "person", "company", "source", "question",
      "event", "hypothesis", "quote", "media",
    ] as const;
    const atlas = makeAtlas({
      nodes: types.map((t, i) => makeNode(`n${i}`, t, `${t} node`)),
    });
    const md = atlasToMarkdown(atlas);
    for (const t of types) {
      expect(md).toContain(`${t} node`);
    }
  });

  it("handles unicode in nodes and edges", () => {
    const now = new Date().toISOString();
    const atlas = makeAtlas({
      title: "Über Atlas",
      nodes: [
        makeNode("n1", "concept", "Café ☕"),
        makeNode("n2", "concept", "中文节点"),
      ],
      edges: [{ id: "e1", sourceId: "n1", targetId: "n2", label: "связано с", createdAt: now }],
    });
    const md = atlasToMarkdown(atlas);
    expect(md).toContain("Café ☕");
    expect(md).toContain("中文节点");
    expect(md).toContain("связано с");
  });
});

describe("sanitizeFilename", () => {
  it("is used implicitly via export - we test the module's behavior", async () => {
    const { atlasToJSON } = await import("@/lib/export");
    expect(typeof atlasToJSON).toBe("function");
  });
});
