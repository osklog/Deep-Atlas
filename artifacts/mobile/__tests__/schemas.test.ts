import { describe, it, expect } from "vitest";
import {
  AtlasNodeSchema,
  AtlasEdgeSchema,
  AtlasSchema,
  ImportResponseSchema,
  NODE_TYPE_VALUES,
  SUGGESTED_LABELS,
  NODE_ICONS,
  NODE_LABELS,
  ATLAS_COLORS,
} from "@/types/atlas";

describe("AtlasNodeSchema", () => {
  const now = new Date().toISOString();
  const validNode = {
    id: "n1",
    type: "concept",
    title: "Test",
    note: "A note",
    tags: ["tag1"],
    x: 100,
    y: 200,
    createdAt: now,
    updatedAt: now,
  };

  it("accepts a valid node", () => {
    const result = AtlasNodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("concept");
      expect(result.data.title).toBe("Test");
    }
  });

  it("accepts all 9 node types", () => {
    for (const type of NODE_TYPE_VALUES) {
      const result = AtlasNodeSchema.safeParse({ ...validNode, type });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.type).toBe(type);
    }
  });

  it("catches invalid type and falls back to concept", () => {
    const result = AtlasNodeSchema.safeParse({ ...validNode, type: "bogus" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("concept");
  });

  it("rejects empty title", () => {
    const result = AtlasNodeSchema.safeParse({ ...validNode, title: "" });
    expect(result.success).toBe(false);
  });

  it("defaults missing note to empty string", () => {
    const { note, ...rest } = validNode;
    const result = AtlasNodeSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.note).toBe("");
  });

  it("defaults missing tags to empty array", () => {
    const { tags, ...rest } = validNode;
    const result = AtlasNodeSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tags).toEqual([]);
  });

  it("catches non-number x/y and falls back to 0", () => {
    const result = AtlasNodeSchema.safeParse({ ...validNode, x: "abc", y: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.x).toBe(0);
      expect(result.data.y).toBe(0);
    }
  });

  it("allows optional imageUri", () => {
    const result = AtlasNodeSchema.safeParse({ ...validNode, imageUri: "file://img.png" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUri).toBe("file://img.png");
  });

  it("allows missing imageUri", () => {
    const result = AtlasNodeSchema.safeParse(validNode);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.imageUri).toBeUndefined();
  });
});

describe("AtlasEdgeSchema", () => {
  const now = new Date().toISOString();
  const validEdge = {
    id: "e1",
    sourceId: "n1",
    targetId: "n2",
    label: "supports",
    createdAt: now,
  };

  it("accepts a valid edge", () => {
    const result = AtlasEdgeSchema.safeParse(validEdge);
    expect(result.success).toBe(true);
  });

  it("catches empty label and falls back to 'related to'", () => {
    const result = AtlasEdgeSchema.safeParse({ ...validEdge, label: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.label).toBe("related to");
  });

  it("accepts any free-form string label", () => {
    const result = AtlasEdgeSchema.safeParse({ ...validEdge, label: "custom relationship 🔗" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.label).toBe("custom relationship 🔗");
  });
});

describe("AtlasSchema", () => {
  const now = new Date().toISOString();
  const validAtlas = {
    id: "a1",
    title: "Test Atlas",
    description: "Desc",
    color: "#FF0000",
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  };

  it("accepts a valid atlas", () => {
    const result = AtlasSchema.safeParse(validAtlas);
    expect(result.success).toBe(true);
  });

  it("defaults missing optional fields", () => {
    const result = AtlasSchema.safeParse({
      id: "a1",
      title: "Minimal",
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
      expect(result.data.color).toBe("#C9A96E");
      expect(result.data.nodes).toEqual([]);
      expect(result.data.edges).toEqual([]);
    }
  });

  it("rejects empty title", () => {
    const result = AtlasSchema.safeParse({ ...validAtlas, title: "" });
    expect(result.success).toBe(false);
  });

  it("validates nested nodes", () => {
    const result = AtlasSchema.safeParse({
      ...validAtlas,
      nodes: [
        { id: "n1", type: "person", title: "A", createdAt: now, updatedAt: now },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0].type).toBe("person");
    }
  });

  it("catches invalid node types within atlas", () => {
    const result = AtlasSchema.safeParse({
      ...validAtlas,
      nodes: [
        { id: "n1", type: "invalid_type", title: "A", createdAt: now, updatedAt: now },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nodes[0].type).toBe("concept");
    }
  });
});

describe("ImportResponseSchema", () => {
  it("accepts valid import response", () => {
    const data = {
      title: "Test",
      description: "Desc",
      color: "#123456",
      nodes: [{ title: "Node1", type: "concept", note: "n" }],
      edges: [{ sourceIndex: 0, targetIndex: 0, label: "self" }],
    };
    const result = ImportResponseSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("requires at least one node", () => {
    const result = ImportResponseSchema.safeParse({
      title: "T",
      nodes: [],
    });
    expect(result.success).toBe(false);
  });

  it("defaults missing fields", () => {
    const result = ImportResponseSchema.safeParse({
      nodes: [{ title: "A" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Imported Atlas");
      expect(result.data.description).toBe("");
      expect(result.data.color).toBe("#6E9CF0");
      expect(result.data.nodes[0].type).toBe("concept");
    }
  });

  it("rejects negative edge indices", () => {
    const result = ImportResponseSchema.safeParse({
      nodes: [{ title: "A" }],
      edges: [{ sourceIndex: -1, targetIndex: 0, label: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer edge indices", () => {
    const result = ImportResponseSchema.safeParse({
      nodes: [{ title: "A" }],
      edges: [{ sourceIndex: 0.5, targetIndex: 0, label: "x" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("Constants completeness", () => {
  it("NODE_TYPE_VALUES has exactly 9 types", () => {
    expect(NODE_TYPE_VALUES).toHaveLength(9);
  });

  it("SUGGESTED_LABELS has 23 labels", () => {
    expect(SUGGESTED_LABELS).toHaveLength(23);
  });

  it("NODE_ICONS covers all 9 types", () => {
    for (const t of NODE_TYPE_VALUES) {
      expect(NODE_ICONS[t]).toBeDefined();
      expect(typeof NODE_ICONS[t]).toBe("string");
    }
  });

  it("NODE_LABELS covers all 9 types", () => {
    for (const t of NODE_TYPE_VALUES) {
      expect(NODE_LABELS[t]).toBeDefined();
      expect(NODE_LABELS[t].length).toBeGreaterThan(0);
    }
  });

  it("ATLAS_COLORS has at least 4 colors", () => {
    expect(ATLAS_COLORS.length).toBeGreaterThanOrEqual(4);
    for (const c of ATLAS_COLORS) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
