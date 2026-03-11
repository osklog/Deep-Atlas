import { describe, it, expect, beforeEach } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getAllAtlases,
  getAtlas,
  createAtlas,
  updateAtlas,
  deleteAtlas,
  addNode,
  updateNode,
  deleteNode,
  addEdge,
  deleteEdge,
  createAtlasFromImport,
  searchAll,
  saveAtlas,
  resetMigrationFlag,
} from "@/storage/atlasStorage";

const ATLASES_KEY = "deep_dive_atlas:atlases";
const VERSION_KEY = "deep_dive_atlas:version";

describe("atlasStorage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetMigrationFlag();
  });

  describe("getAllAtlases", () => {
    it("returns empty array when storage is empty", async () => {
      const result = await getAllAtlases();
      expect(result).toEqual([]);
    });

    it("returns empty array when storage has non-array data", async () => {
      await AsyncStorage.setItem(ATLASES_KEY, '"not an array"');
      const result = await getAllAtlases();
      expect(result).toEqual([]);
    });

    it("returns empty array when storage has invalid JSON", async () => {
      await AsyncStorage.setItem(ATLASES_KEY, "{broken json");
      const result = await getAllAtlases();
      expect(result).toEqual([]);
    });

    it("migrates and returns atlases", async () => {
      const now = new Date().toISOString();
      await AsyncStorage.setItem(
        ATLASES_KEY,
        JSON.stringify([{ id: "a1", title: "Test", createdAt: now, updatedAt: now }])
      );
      const result = await getAllAtlases();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Test");
      expect(result[0].nodes).toEqual([]);
      expect(result[0].edges).toEqual([]);
    });

    it("sorts by updatedAt descending", async () => {
      const old = "2024-01-01T00:00:00.000Z";
      const newer = "2025-06-01T00:00:00.000Z";
      await AsyncStorage.setItem(
        ATLASES_KEY,
        JSON.stringify([
          { id: "a1", title: "Old", createdAt: old, updatedAt: old },
          { id: "a2", title: "New", createdAt: newer, updatedAt: newer },
        ])
      );
      const result = await getAllAtlases();
      expect(result[0].title).toBe("New");
      expect(result[1].title).toBe("Old");
    });
  });

  describe("createAtlas", () => {
    it("creates atlas with valid fields", async () => {
      const atlas = await createAtlas("My Atlas", "Description", "#FF0000");
      expect(atlas.id).toBeDefined();
      expect(atlas.title).toBe("My Atlas");
      expect(atlas.description).toBe("Description");
      expect(atlas.color).toBe("#FF0000");
      expect(atlas.nodes).toEqual([]);
      expect(atlas.edges).toEqual([]);
      expect(atlas.createdAt).toBeDefined();
    });

    it("persists to storage", async () => {
      await createAtlas("Persisted", "Desc", "#000");
      const all = await getAllAtlases();
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("Persisted");
    });
  });

  describe("getAtlas", () => {
    it("returns null for non-existent id", async () => {
      expect(await getAtlas("nonexistent")).toBeNull();
    });

    it("returns atlas by id", async () => {
      const atlas = await createAtlas("Find Me", "", "#000");
      const found = await getAtlas(atlas.id);
      expect(found).not.toBeNull();
      expect(found!.title).toBe("Find Me");
    });
  });

  describe("updateAtlas", () => {
    it("returns null for non-existent id", async () => {
      expect(await updateAtlas("nonexistent", { title: "X" })).toBeNull();
    });

    it("updates and persists", async () => {
      const atlas = await createAtlas("Original", "", "#000");
      const updated = await updateAtlas(atlas.id, { title: "Updated" });
      expect(updated!.title).toBe("Updated");
      const found = await getAtlas(atlas.id);
      expect(found!.title).toBe("Updated");
    });
  });

  describe("deleteAtlas", () => {
    it("removes atlas", async () => {
      const atlas = await createAtlas("ToDelete", "", "#000");
      await deleteAtlas(atlas.id);
      expect(await getAtlas(atlas.id)).toBeNull();
    });
  });

  describe("addNode", () => {
    it("returns null for non-existent atlas", async () => {
      expect(
        await addNode("bad", { type: "concept", title: "X", note: "", tags: [], x: 0, y: 0 })
      ).toBeNull();
    });

    it("adds a node with generated id", async () => {
      const atlas = await createAtlas("A", "", "#000");
      const node = await addNode(atlas.id, {
        type: "person",
        title: "Alice",
        note: "A note",
        tags: ["tag1"],
        x: 100,
        y: 200,
      });
      expect(node).not.toBeNull();
      expect(node!.id).toBeDefined();
      expect(node!.type).toBe("person");
      expect(node!.title).toBe("Alice");

      const found = await getAtlas(atlas.id);
      expect(found!.nodes).toHaveLength(1);
    });
  });

  describe("updateNode", () => {
    it("returns null for non-existent node", async () => {
      const atlas = await createAtlas("A", "", "#000");
      expect(await updateNode(atlas.id, "bad", { title: "X" })).toBeNull();
    });

    it("updates node fields", async () => {
      const atlas = await createAtlas("A", "", "#000");
      const node = await addNode(atlas.id, {
        type: "concept",
        title: "Old",
        note: "",
        tags: [],
        x: 0,
        y: 0,
      });
      const updated = await updateNode(atlas.id, node!.id, { title: "New" });
      expect(updated!.nodes[0].title).toBe("New");
    });
  });

  describe("deleteNode", () => {
    it("removes node and associated edges", async () => {
      const atlas = await createAtlas("A", "", "#000");
      const n1 = await addNode(atlas.id, { type: "concept", title: "N1", note: "", tags: [], x: 0, y: 0 });
      const n2 = await addNode(atlas.id, { type: "concept", title: "N2", note: "", tags: [], x: 0, y: 0 });
      await addEdge(atlas.id, n1!.id, n2!.id, "related to");

      const after = await deleteNode(atlas.id, n1!.id);
      expect(after!.nodes).toHaveLength(1);
      expect(after!.edges).toHaveLength(0);
    });
  });

  describe("addEdge", () => {
    it("returns null for non-existent atlas", async () => {
      expect(await addEdge("bad", "s", "t", "label")).toBeNull();
    });

    it("adds edge with generated id", async () => {
      const atlas = await createAtlas("A", "", "#000");
      const n1 = await addNode(atlas.id, { type: "concept", title: "N1", note: "", tags: [], x: 0, y: 0 });
      const n2 = await addNode(atlas.id, { type: "concept", title: "N2", note: "", tags: [], x: 0, y: 0 });
      const edge = await addEdge(atlas.id, n1!.id, n2!.id, "supports");
      expect(edge).not.toBeNull();
      expect(edge!.label).toBe("supports");
      expect(edge!.sourceId).toBe(n1!.id);
      expect(edge!.targetId).toBe(n2!.id);
    });
  });

  describe("deleteEdge", () => {
    it("removes edge", async () => {
      const atlas = await createAtlas("A", "", "#000");
      const n1 = await addNode(atlas.id, { type: "concept", title: "N1", note: "", tags: [], x: 0, y: 0 });
      const n2 = await addNode(atlas.id, { type: "concept", title: "N2", note: "", tags: [], x: 0, y: 0 });
      const edge = await addEdge(atlas.id, n1!.id, n2!.id, "x");
      const after = await deleteEdge(atlas.id, edge!.id);
      expect(after!.edges).toHaveLength(0);
    });
  });

  describe("searchAll", () => {
    it("finds atlas by title", async () => {
      await createAtlas("Quantum Physics", "Desc", "#000");
      await createAtlas("History Notes", "Desc", "#000");
      const result = await searchAll("quantum");
      expect(result.atlases).toHaveLength(1);
      expect(result.atlases[0].title).toBe("Quantum Physics");
    });

    it("finds nodes by title", async () => {
      const atlas = await createAtlas("A", "", "#000");
      await addNode(atlas.id, { type: "person", title: "Einstein", note: "", tags: [], x: 0, y: 0 });
      await addNode(atlas.id, { type: "concept", title: "Gravity", note: "", tags: [], x: 0, y: 0 });
      const result = await searchAll("einstein");
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].node.title).toBe("Einstein");
    });

    it("finds nodes by tags", async () => {
      const atlas = await createAtlas("A", "", "#000");
      await addNode(atlas.id, {
        type: "concept",
        title: "X",
        note: "",
        tags: ["physics", "quantum"],
        x: 0,
        y: 0,
      });
      const result = await searchAll("physics");
      expect(result.nodes).toHaveLength(1);
    });

    it("returns empty for no matches", async () => {
      await createAtlas("A", "", "#000");
      const result = await searchAll("zzzzz");
      expect(result.atlases).toHaveLength(0);
      expect(result.nodes).toHaveLength(0);
    });
  });

  describe("createAtlasFromImport", () => {
    it("creates atlas with positioned nodes and edges", async () => {
      const atlas = await createAtlasFromImport({
        title: "Imported",
        description: "From import",
        color: "#123456",
        nodes: [
          { title: "Center", type: "concept", note: "Main" },
          { title: "Spoke1", type: "person" },
          { title: "Spoke2", type: "event" },
        ],
        edges: [
          { sourceIndex: 0, targetIndex: 1, label: "supports" },
          { sourceIndex: 0, targetIndex: 2, label: "enables" },
        ],
      });

      expect(atlas.nodes).toHaveLength(3);
      expect(atlas.edges).toHaveLength(2);
      expect(atlas.title).toBe("Imported");

      for (const node of atlas.nodes) {
        expect(node.id).toBeDefined();
        expect(typeof node.x).toBe("number");
        expect(typeof node.y).toBe("number");
      }

      for (const edge of atlas.edges) {
        const src = atlas.nodes.find((n) => n.id === edge.sourceId);
        const tgt = atlas.nodes.find((n) => n.id === edge.targetId);
        expect(src).toBeDefined();
        expect(tgt).toBeDefined();
      }
    });

    it("skips self-referencing edges", async () => {
      const atlas = await createAtlasFromImport({
        title: "T",
        description: "",
        color: "#000",
        nodes: [{ title: "A", type: "concept" }],
        edges: [{ sourceIndex: 0, targetIndex: 0, label: "self" }],
      });
      expect(atlas.edges).toHaveLength(0);
    });

    it("skips edges with out-of-bounds indices", async () => {
      const atlas = await createAtlasFromImport({
        title: "T",
        description: "",
        color: "#000",
        nodes: [{ title: "A", type: "concept" }],
        edges: [{ sourceIndex: 0, targetIndex: 99, label: "x" }],
      });
      expect(atlas.edges).toHaveLength(0);
    });

    it("sanitizes invalid node types to concept", async () => {
      const atlas = await createAtlasFromImport({
        title: "T",
        description: "",
        color: "#000",
        nodes: [{ title: "A", type: "invalid_type" }],
        edges: [],
      });
      expect(atlas.nodes[0].type).toBe("concept");
    });

    it("truncates long node titles to 80 chars", async () => {
      const longTitle = "A".repeat(200);
      const atlas = await createAtlasFromImport({
        title: "T",
        description: "",
        color: "#000",
        nodes: [{ title: longTitle, type: "concept" }],
        edges: [],
      });
      expect(atlas.nodes[0].title.length).toBe(80);
    });

    it("handles large imports with inner + outer ring layout", async () => {
      const nodes = Array.from({ length: 15 }, (_, i) => ({
        title: `Node ${i}`,
        type: "concept",
      }));
      const atlas = await createAtlasFromImport({
        title: "Big Import",
        description: "",
        color: "#000",
        nodes,
        edges: [],
      });
      expect(atlas.nodes).toHaveLength(15);
      const positions = atlas.nodes.map((n) => ({ x: n.x, y: n.y }));
      const unique = new Set(positions.map((p) => `${p.x},${p.y}`));
      expect(unique.size).toBe(15);
    });
  });
});

describe("Storage migration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetMigrationFlag();
  });

  it("migrates v1 atlas without version key", async () => {
    const old = {
      id: "old1",
      title: "Legacy",
      nodes: [{ id: "n1", type: "concept", title: "T", createdAt: "2024-01-01", updatedAt: "2024-01-01" }],
      edges: [],
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
    };
    await AsyncStorage.setItem(ATLASES_KEY, JSON.stringify([old]));
    const result = await getAllAtlases();
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("");
    expect(result[0].color).toBe("#C9A96E");
    expect(result[0].nodes[0].tags).toEqual([]);
  });

  it("handles corrupted atlas objects in array", async () => {
    await AsyncStorage.setItem(
      ATLASES_KEY,
      JSON.stringify([null, "not an object", { id: "a1", title: "OK", createdAt: "2024-01-01", updatedAt: "2024-01-01" }])
    );
    const result = await getAllAtlases();
    expect(result.length).toBeGreaterThanOrEqual(1);
    const ok = result.find((a) => a.title === "OK");
    expect(ok).toBeDefined();
  });

  it("handles partial atlas with missing fields", async () => {
    await AsyncStorage.setItem(
      ATLASES_KEY,
      JSON.stringify([{ title: "Partial" }])
    );
    const result = await getAllAtlases();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBeDefined();
    expect(result[0].title).toBe("Partial");
    expect(result[0].nodes).toEqual([]);
  });

  it("handles nodes with invalid type values", async () => {
    await AsyncStorage.setItem(
      ATLASES_KEY,
      JSON.stringify([{
        id: "a1",
        title: "T",
        nodes: [{ id: "n1", type: "BOGUS", title: "X", createdAt: "c", updatedAt: "u" }],
        edges: [],
        createdAt: "c",
        updatedAt: "u",
      }])
    );
    const result = await getAllAtlases();
    expect(result[0].nodes[0].type).toBe("concept");
  });

  it("handles edges with missing sourceId/targetId", async () => {
    await AsyncStorage.setItem(
      ATLASES_KEY,
      JSON.stringify([{
        id: "a1",
        title: "T",
        nodes: [],
        edges: [
          { id: "e1", label: "x" },
          { id: "e2", sourceId: "s", targetId: "t", label: "ok" },
        ],
        createdAt: "c",
        updatedAt: "u",
      }])
    );
    const result = await getAllAtlases();
    expect(result[0].edges).toHaveLength(1);
    expect(result[0].edges[0].label).toBe("ok");
  });

  it("sets version key after migration", async () => {
    await AsyncStorage.setItem(ATLASES_KEY, JSON.stringify([]));
    await getAllAtlases();
    const ver = await AsyncStorage.getItem(VERSION_KEY);
    expect(ver).toBe("2");
  });

  it("skips migration when version is current", async () => {
    await AsyncStorage.setItem(VERSION_KEY, "2");
    const now = new Date().toISOString();
    await AsyncStorage.setItem(
      ATLASES_KEY,
      JSON.stringify([{ id: "a1", title: "T", createdAt: now, updatedAt: now }])
    );
    const result = await getAllAtlases();
    expect(result).toHaveLength(1);
  });
});

describe("Storage roundtrip integrity", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetMigrationFlag();
  });

  it("preserves all fields through save/load cycle", async () => {
    const atlas = await createAtlas("Roundtrip", "Desc", "#ABCDEF");
    const node = await addNode(atlas.id, {
      type: "hypothesis",
      title: "Test Hypothesis",
      note: "A long note with unicode: café, über, 中文",
      tags: ["tag1", "tag2", "special-chars!@#"],
      x: 123.456,
      y: 789.012,
      imageUri: "file://test.png",
    });
    await addEdge(atlas.id, node!.id, node!.id, "self-referential");

    const loaded = await getAtlas(atlas.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Roundtrip");
    expect(loaded!.description).toBe("Desc");
    expect(loaded!.color).toBe("#ABCDEF");
    expect(loaded!.nodes[0].type).toBe("hypothesis");
    expect(loaded!.nodes[0].note).toContain("café");
    expect(loaded!.nodes[0].tags).toContain("special-chars!@#");
    expect(loaded!.nodes[0].imageUri).toBe("file://test.png");
  });
});
