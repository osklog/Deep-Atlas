import { describe, it, expect } from "vitest";
import { stripCodeFences, extractJSON } from "../lib/json-extract.js";

describe("stripCodeFences", () => {
  it("strips ```json fences", () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("strips ``` fences without language", () => {
    const input = '```\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("strips ```JSON fences (case insensitive)", () => {
    const input = '```JSON\n{"key": "value"}\n```';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("returns trimmed input when no fences", () => {
    const input = '  {"key": "value"}  ';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });

  it("handles empty string", () => {
    expect(stripCodeFences("")).toBe("");
  });

  it("handles fences with extra whitespace", () => {
    const input = '```json   \n{"key": "value"}\n   ```  ';
    expect(stripCodeFences(input)).toBe('{"key": "value"}');
  });
});

describe("extractJSON", () => {
  it("parses plain JSON", () => {
    const result = extractJSON('{"title": "Test", "nodes": []}');
    expect(result).toEqual({ title: "Test", nodes: [] });
  });

  it("parses code-fenced JSON", () => {
    const result = extractJSON('```json\n{"title": "Test"}\n```');
    expect(result).toEqual({ title: "Test" });
  });

  it("extracts JSON from surrounding text", () => {
    const input = 'Here is the atlas:\n\n{"title": "Extracted", "nodes": [{"title": "A"}]}\n\nDone.';
    const result = extractJSON(input);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Extracted");
  });

  it("returns null for non-JSON", () => {
    expect(extractJSON("just some text")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractJSON("")).toBeNull();
  });

  it("returns null for completely malformed JSON", () => {
    expect(extractJSON("{{{broken}}}")).toBeNull();
  });

  it("handles nested JSON objects", () => {
    const input = '{"title": "T", "meta": {"count": 5, "nested": {"a": 1}}}';
    const result = extractJSON(input);
    expect(result).not.toBeNull();
    expect((result!.meta as any).count).toBe(5);
  });

  it("handles JSON with array values", () => {
    const input = '{"nodes": [{"title": "A"}, {"title": "B"}], "edges": []}';
    const result = extractJSON(input);
    expect(result).not.toBeNull();
    expect((result!.nodes as any[]).length).toBe(2);
  });

  it("handles AI preamble text before JSON", () => {
    const input = `I've analyzed your content and created a knowledge graph. Here's the result:

{"title": "AI Output", "nodes": [{"title": "Concept1", "type": "concept"}], "edges": []}

I hope this helps!`;
    const result = extractJSON(input);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("AI Output");
  });

  it("handles code-fenced JSON with preamble", () => {
    const input = 'Here is the output:\n\n```json\n{"title": "Fenced"}\n```\n\nDone.';
    const result = extractJSON(input);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Fenced");
  });
});
