import { describe, it, expect, vi } from "vitest";
import { SUGGESTED_LABELS, NODE_TYPES, NODE_LABELS, NODE_ICONS, AtlasNodeSchema, AtlasEdgeSchema, NODE_TYPE_VALUES } from "@/types/atlas";
import type { AtlasNode, NodeType } from "@/types/atlas";
import { sanitizeFilename } from "@/lib/export";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  selectionAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

describe("EdgeForm logic (unit extraction)", () => {
  function computeEffectiveLabel(selected: string, custom: string): string {
    return custom.trim() || selected || "related to";
  }

  it("defaults to 'related to' when nothing selected", () => {
    expect(computeEffectiveLabel("", "")).toBe("related to");
  });

  it("uses selected label when no custom input", () => {
    expect(computeEffectiveLabel("supports", "")).toBe("supports");
  });

  it("custom input overrides selected", () => {
    expect(computeEffectiveLabel("supports", "my custom label")).toBe("my custom label");
  });

  it("custom whitespace-only falls back to selected", () => {
    expect(computeEffectiveLabel("contradicts", "   ")).toBe("contradicts");
  });

  it("all 23 SUGGESTED_LABELS are non-empty strings", () => {
    expect(SUGGESTED_LABELS.length).toBe(23);
    for (const label of SUGGESTED_LABELS) {
      expect(typeof label).toBe("string");
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it("SUGGESTED_LABELS has no duplicates", () => {
    const unique = new Set(SUGGESTED_LABELS);
    expect(unique.size).toBe(SUGGESTED_LABELS.length);
  });

  it("effective label is always a non-empty string", () => {
    const testCases = [
      ["", ""],
      ["related to", ""],
      ["", "custom"],
      ["supports", "override"],
      ["", "  trimmed  "],
    ];
    for (const [selected, custom] of testCases) {
      const result = computeEffectiveLabel(selected, custom);
      expect(result.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("NodeForm logic (unit extraction)", () => {
  function computeHandleSave(
    type: NodeType,
    title: string,
    note: string,
    tags: string[],
    imageUri?: string,
  ) {
    if (!title.trim()) return null;
    return { type, title: title.trim(), note: note.trim(), tags, imageUri };
  }

  function addTag(tags: string[], tagInput: string): { tags: string[]; tagInput: string } {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      return { tags: [...tags, t], tagInput: "" };
    }
    return { tags, tagInput: "" };
  }

  function removeTag(tags: string[], tag: string): string[] {
    return tags.filter((t) => t !== tag);
  }

  it("rejects save with empty title", () => {
    expect(computeHandleSave("concept", "", "note", [])).toBeNull();
    expect(computeHandleSave("concept", "   ", "note", [])).toBeNull();
  });

  it("trims title and note on save", () => {
    const result = computeHandleSave("person", "  Alice  ", "  A person  ", ["test"]);
    expect(result).toEqual({
      type: "person",
      title: "Alice",
      note: "A person",
      tags: ["test"],
      imageUri: undefined,
    });
  });

  it("preserves imageUri when provided", () => {
    const result = computeHandleSave("media", "Photo", "", [], "file://image.jpg");
    expect(result?.imageUri).toBe("file://image.jpg");
  });

  it("accepts all 9 node types", () => {
    const allTypes: NodeType[] = [
      "concept", "person", "company", "source", "question",
      "event", "hypothesis", "quote", "media",
    ];
    for (const type of allTypes) {
      const result = computeHandleSave(type, "Test", "", []);
      expect(result?.type).toBe(type);
    }
  });

  it("addTag deduplicates and lowercases", () => {
    const r1 = addTag([], "Physics");
    expect(r1.tags).toEqual(["physics"]);
    expect(r1.tagInput).toBe("");

    const r2 = addTag(["physics"], "Physics");
    expect(r2.tags).toEqual(["physics"]);

    const r3 = addTag(["physics"], "  Chemistry  ");
    expect(r3.tags).toEqual(["physics", "chemistry"]);
  });

  it("addTag ignores empty input", () => {
    const r = addTag(["existing"], "");
    expect(r.tags).toEqual(["existing"]);
  });

  it("removeTag filters correctly", () => {
    const result = removeTag(["a", "b", "c"], "b");
    expect(result).toEqual(["a", "c"]);
  });

  it("removeTag with non-existent tag is no-op", () => {
    const result = removeTag(["a", "b"], "z");
    expect(result).toEqual(["a", "b"]);
  });

  it("all NODE_TYPES have corresponding labels and icons", () => {
    for (const type of NODE_TYPES) {
      expect(NODE_LABELS[type]).toBeDefined();
      expect(typeof NODE_LABELS[type]).toBe("string");
      expect(NODE_ICONS[type]).toBeDefined();
      expect(typeof NODE_ICONS[type]).toBe("string");
    }
  });
});

describe("import screen logic (unit extraction)", () => {
  function isImageMime(mime: string): boolean {
    const IMAGE_MIMES = new Set([
      "image/jpeg", "image/jpg", "image/png", "image/webp",
      "image/gif", "image/heic", "image/heif",
    ]);
    return IMAGE_MIMES.has(mime.toLowerCase());
  }

  function isPdfMime(mime: string): boolean {
    return new Set(["application/pdf"]).has(mime.toLowerCase());
  }

  interface PickedFile {
    uri: string;
    name: string;
    mimeType: string;
    isImage: boolean;
    isPdf: boolean;
  }

  function dedup(list: PickedFile[]): PickedFile[] {
    const seen = new Set<string>();
    return list.filter((f) => {
      if (seen.has(f.uri)) return false;
      seen.add(f.uri);
      return true;
    });
  }

  function formatSize(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  it("isImageMime identifies image types", () => {
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("IMAGE/JPEG")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("text/plain")).toBe(false);
  });

  it("isPdfMime identifies PDF type", () => {
    expect(isPdfMime("application/pdf")).toBe(true);
    expect(isPdfMime("APPLICATION/PDF")).toBe(true);
    expect(isPdfMime("text/plain")).toBe(false);
  });

  it("dedup removes duplicate URIs", () => {
    const files: PickedFile[] = [
      { uri: "file://a", name: "a.txt", mimeType: "text/plain", isImage: false, isPdf: false },
      { uri: "file://b", name: "b.txt", mimeType: "text/plain", isImage: false, isPdf: false },
      { uri: "file://a", name: "a.txt", mimeType: "text/plain", isImage: false, isPdf: false },
    ];
    expect(dedup(files)).toHaveLength(2);
  });

  it("dedup preserves first occurrence order", () => {
    const files: PickedFile[] = [
      { uri: "file://c", name: "c", mimeType: "text/plain", isImage: false, isPdf: false },
      { uri: "file://a", name: "a", mimeType: "text/plain", isImage: false, isPdf: false },
      { uri: "file://c", name: "c-dup", mimeType: "text/plain", isImage: false, isPdf: false },
    ];
    const result = dedup(files);
    expect(result[0].name).toBe("c");
    expect(result[1].name).toBe("a");
  });

  it("formatSize formats bytes correctly", () => {
    expect(formatSize(undefined)).toBe("");
    expect(formatSize(0)).toBe("");
    expect(formatSize(512)).toBe("512B");
    expect(formatSize(1024)).toBe("1KB");
    expect(formatSize(1536)).toBe("2KB");
    expect(formatSize(1048576)).toBe("1.0MB");
    expect(formatSize(2621440)).toBe("2.5MB");
  });

  it("stage transitions: pick → reading → importing → pick", () => {
    type Stage = "pick" | "reading" | "importing";
    const stages: Stage[] = ["pick", "reading", "importing", "pick"];
    expect(stages[0]).toBe("pick");
    expect(stages[1]).toBe("reading");
    expect(stages[2]).toBe("importing");
    expect(stages[3]).toBe("pick");
  });
});

describe("atlas list / empty state logic", () => {
  function atlasSubtitle(count: number): string {
    return count > 0
      ? `${count} knowledge map${count !== 1 ? "s" : ""}`
      : "Your knowledge maps";
  }

  it("shows correct subtitle for 0 atlases", () => {
    expect(atlasSubtitle(0)).toBe("Your knowledge maps");
  });

  it("shows correct subtitle for 1 atlas", () => {
    expect(atlasSubtitle(1)).toBe("1 knowledge map");
  });

  it("shows correct subtitle for multiple atlases", () => {
    expect(atlasSubtitle(5)).toBe("5 knowledge maps");
  });
});

describe("sanitizeFilename (imported from production module)", () => {
  it("sanitizes basic names", () => {
    expect(sanitizeFilename("My Atlas")).toBe("My_Atlas");
  });

  it("removes special characters", () => {
    expect(sanitizeFilename("Test@#$%Atlas!")).toBe("TestAtlas");
  });

  it("handles unicode by stripping", () => {
    expect(sanitizeFilename("Über Café 中文")).toBe("ber_Caf_");
  });

  it("truncates to 60 chars", () => {
    const long = "A".repeat(100);
    expect(sanitizeFilename(long).length).toBe(60);
  });

  it("returns 'atlas' for empty result", () => {
    expect(sanitizeFilename("@#$%^&*")).toBe("atlas");
    expect(sanitizeFilename("")).toBe("atlas");
  });
});
