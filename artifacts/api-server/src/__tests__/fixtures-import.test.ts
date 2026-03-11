import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import fs from "node:fs";
import path from "node:path";

vi.mock("@workspace/integrations-openai-ai-server", () => {
  return {
    openai: {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    },
  };
});

vi.mock("pdf-parse", () => {
  return {
    default: vi.fn(async (buffer: Buffer) => {
      const header = buffer.slice(0, 10).toString("utf-8");
      if (!header.startsWith("%PDF")) {
        throw new Error("Invalid PDF structure");
      }
      const text = buffer.toString("utf-8");
      return { text };
    }),
  };
});

const fixturesDir = path.resolve(import.meta.dirname, "fixtures");

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), "utf-8");
}

function readFixtureBase64(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name)).toString("base64");
}

let app: express.Express;

async function setupApp() {
  const atlasModule = await import("../routes/atlas.js");
  app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/api/atlas", atlasModule.default);
  return app;
}

const { openai } = await import("@workspace/integrations-openai-ai-server");
const mockCreate = vi.mocked(openai.chat.completions.create);

function validAIResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    title: "Test Atlas",
    description: "Generated from fixtures",
    color: "#1E5AA8",
    nodes: [
      { title: "Concept A", type: "concept", note: "An important concept" },
      { title: "Person B", type: "person", note: "A key person" },
      { title: "Question C", type: "question", note: "An open question" },
    ],
    edges: [
      { sourceIndex: 0, targetIndex: 1, label: "involves" },
      { sourceIndex: 1, targetIndex: 2, label: "raises" },
    ],
    ...overrides,
  });
}

describe("import route with real fixture files", () => {
  beforeEach(async () => {
    mockCreate.mockReset();
    await setupApp();
  });

  it("imports short-note.txt — text content reaches AI prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: validAIResponse({ title: "Quantum Entanglement" }) } }],
    } as any);

    const content = readFixture("short-note.txt");
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "short-note.txt", mimeType: "text/plain", content, isBase64: false }],
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Quantum Entanglement");
    expect(res.body.nodes).toHaveLength(3);
    expect(res.body.edges).toHaveLength(2);

    const call = mockCreate.mock.calls[0];
    const parts = (call[0] as any).messages[0].content;
    const textPart = parts.find((p: any) => p.type === "text" && p.text.includes("Quantum entanglement"));
    expect(textPart).toBeDefined();
  });

  it("imports research-notes.md — preserves markdown structure in prompt", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: validAIResponse({ title: "Transformer Architecture" }) } }],
    } as any);

    const content = readFixture("research-notes.md");
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "research-notes.md", mimeType: "text/markdown", content, isBase64: false }],
    });

    expect(res.status).toBe(200);

    const call = mockCreate.mock.calls[0];
    const parts = (call[0] as any).messages[0].content;
    const filePart = parts.find((p: any) => p.type === "text" && p.text.includes("Vaswani"));
    expect(filePart).toBeDefined();
    expect(filePart.text).toContain("Self-Attention");
    expect(filePart.text).toContain("research-notes.md");
  });

  it("imports messy-contradictions.txt — large contradictory text", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: validAIResponse({
            title: "Nutrition Contradictions",
            nodes: [
              { title: "Intermittent Fasting", type: "concept", note: "Contested" },
              { title: "Dr. Sarah Chen", type: "person", note: "Nature 2023" },
              { title: "Red wine paradox", type: "hypothesis", note: "French Paradox vs WHO" },
            ],
          }),
        },
      }],
    } as any);

    const content = readFixture("messy-contradictions.txt");
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "messy-contradictions.txt", mimeType: "text/plain", content, isBase64: false }],
    });

    expect(res.status).toBe(200);
    expect(res.body.nodes.length).toBeGreaterThanOrEqual(3);

    const call = mockCreate.mock.calls[0];
    const parts = (call[0] as any).messages[0].content;
    const textPart = parts.find((p: any) => p.type === "text" && p.text.includes("contradictions"));
    expect(textPart).toBeDefined();
  });

  it("imports unicode-heavy.txt — unicode survives round-trip", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: validAIResponse({
            title: "量子力学 Atlas",
            nodes: [
              { title: "Нильс Бор", type: "person", note: "Copenhagen" },
              { title: "Schrödinger", type: "person", note: "Wave mechanics" },
              { title: "量子力学", type: "concept", note: "Quantum mechanics" },
            ],
          }),
        },
      }],
    } as any);

    const content = readFixture("unicode-heavy.txt");
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "unicode-heavy.txt", mimeType: "text/plain", content, isBase64: false }],
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("量子力学 Atlas");
    expect(res.body.nodes[0].title).toBe("Нильс Бор");
    expect(res.body.nodes[1].title).toBe("Schrödinger");

    const call = mockCreate.mock.calls[0];
    const parts = (call[0] as any).messages[0].content;
    const textPart = parts.find((p: any) => p.type === "text" && p.text.includes("多语言"));
    expect(textPart).toBeDefined();
    expect(textPart.text).toContain("Ελληνικά");
    expect(textPart.text).toContain("한국어");
  });

  it("rejects corrupt.pdf — reported in skipped, 400 when only file", async () => {
    const base64 = readFixtureBase64("corrupt.pdf");
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "corrupt.pdf", mimeType: "application/pdf", content: base64, isBase64: true }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No readable content");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("imports sample.pdf — text extracted and sent to AI", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: validAIResponse({ title: "PDF Atlas" }) } }],
    } as any);

    const base64 = readFixtureBase64("sample.pdf");
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "sample.pdf", mimeType: "application/pdf", content: base64, isBase64: true }],
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("PDF Atlas");

    const call = mockCreate.mock.calls[0];
    const parts = (call[0] as any).messages[0].content;
    const pdfPart = parts.find((p: any) => p.type === "text" && p.text.includes("[PDF: sample.pdf]"));
    expect(pdfPart).toBeDefined();
  });

  it("imports image-payload.json fixture — image_url sent to AI", async () => {
    const imagePayload = JSON.parse(readFixture("image-payload.json"));

    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: validAIResponse({
            title: "Image Analysis",
            nodes: [{ title: "Visual Content", type: "media", note: "From image" }],
          }),
        },
      }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [imagePayload],
    });

    expect(res.status).toBe(200);

    const call = mockCreate.mock.calls[0];
    const parts = (call[0] as any).messages[0].content;
    const imgPart = parts.find((p: any) => p.type === "image_url");
    expect(imgPart).toBeDefined();
    expect(imgPart.image_url.url).toMatch(/^data:image\/png;base64,/);
    const imgLabel = parts.find((p: any) => p.type === "text" && p.text.includes("[Image file: test-image.png]"));
    expect(imgLabel).toBeDefined();
  });

  it("handles unsupported file type (.zip) — rejected", async () => {
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "archive.zip", mimeType: "application/zip", content: "fakedata", isBase64: true }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No readable content");
  });

  it("handles mixed valid + corrupt files — processes valid, skips corrupt", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: validAIResponse({ title: "Mixed Import" }) } }],
    } as any);

    const corruptBase64 = readFixtureBase64("corrupt.pdf");
    const textContent = readFixture("short-note.txt");

    const res = await request(app).post("/api/atlas/import").send({
      files: [
        { name: "corrupt.pdf", mimeType: "application/pdf", content: corruptBase64, isBase64: true },
        { name: "short-note.txt", mimeType: "text/plain", content: textContent, isBase64: false },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Mixed Import");
    expect(res.body.skipped).toEqual(expect.arrayContaining(["corrupt.pdf (could not extract text)"]));
    expect(mockCreate).toHaveBeenCalledOnce();
  });
});
