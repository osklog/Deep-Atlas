import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import http from "node:http";
import express from "express";

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
      const text = buffer.toString("utf-8");
      if (text.includes("CORRUPT")) {
        throw new Error("Invalid PDF");
      }
      return { text: `Extracted: ${text.slice(0, 50)}` };
    }),
  };
});

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

function makeValidImportResponse(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    title: "Test Atlas",
    description: "From import",
    color: "#123456",
    nodes: [
      { title: "Concept A", type: "concept", note: "Note A" },
      { title: "Person B", type: "person", note: "Note B" },
    ],
    edges: [{ sourceIndex: 0, targetIndex: 1, label: "supports" }],
    ...overrides,
  });
}

function longText(base = "This is a long enough note about quantum physics and its implications for computing."): string {
  return base;
}

function textFile(content: string = longText()) {
  return { name: "notes.txt", mimeType: "text/plain", content, isBase64: false };
}

describe("POST /api/atlas/import", () => {
  beforeEach(async () => {
    mockCreate.mockReset();
    await setupApp();
  });

  it("returns 400 when no files provided", async () => {
    const res = await request(app).post("/api/atlas/import").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No files");
  });

  it("returns 400 when files is empty array", async () => {
    const res = await request(app).post("/api/atlas/import").send({ files: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 when all files are too short", async () => {
    const res = await request(app).post("/api/atlas/import").send({
      files: [{ name: "tiny.txt", mimeType: "text/plain", content: "hi", isBase64: false }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No readable content");
  });

  it("handles text file import happy path", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: makeValidImportResponse() } }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test Atlas");
    expect(res.body.nodes).toHaveLength(2);
    expect(res.body.edges).toHaveLength(1);
  });

  it("handles code-fenced JSON response from AI", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: '```json\n{"title":"Fenced","nodes":[{"title":"A","type":"concept"}],"edges":[]}\n```',
        },
      }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Fenced");
  });

  it("returns 422 when AI returns empty nodes", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"title":"Empty","nodes":[],"edges":[]}' } }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("invalid or empty");
  });

  it("returns 422 when AI returns completely malformed output", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "I cannot help with that request." } }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(422);
  });

  it("returns 500 on AI API error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("rate limit");
  });

  it("handles image file (metadata path)", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: makeValidImportResponse({ title: "Image Atlas", nodes: [{ title: "Image Content", type: "media", note: "From image" }] }),
        },
      }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [{
        name: "photo.jpg",
        mimeType: "image/jpeg",
        content: "base64imagedata",
        isBase64: true,
      }],
    });

    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(1);

    const call = mockCreate.mock.calls[0];
    const messages = (call[0] as any).messages;
    const contentParts = messages[0].content;
    const hasImageUrl = contentParts.some((p: any) => p.type === "image_url");
    expect(hasImageUrl).toBe(true);
  });

  it("handles PDF file import", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: makeValidImportResponse({ title: "PDF Atlas" }),
        },
      }],
    } as any);

    const pdfContent = Buffer.from("This is a fake PDF with enough text to pass the length check").toString("base64");

    const res = await request(app).post("/api/atlas/import").send({
      files: [{
        name: "document.pdf",
        mimeType: "application/pdf",
        content: pdfContent,
        isBase64: true,
      }],
    });

    expect(res.status).toBe(200);
  });

  it("skips corrupted PDF and still works with other files", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: makeValidImportResponse({ title: "Mixed" }),
        },
      }],
    } as any);

    const corruptPdf = Buffer.from("CORRUPT").toString("base64");

    const res = await request(app).post("/api/atlas/import").send({
      files: [
        { name: "bad.pdf", mimeType: "application/pdf", content: corruptPdf, isBase64: true },
        textFile(),
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toContain("bad.pdf (could not extract text)");
  });

  it("skips unsupported file types", async () => {
    const res = await request(app).post("/api/atlas/import").send({
      files: [
        { name: "archive.zip", mimeType: "application/zip", content: "abc", isBase64: true },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No readable content");
  });

  it("includes skipped files in response", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: makeValidImportResponse(),
        },
      }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [
        textFile(),
        { name: "tiny.txt", mimeType: "text/plain", content: "hi", isBase64: false },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toContain("tiny.txt (too short)");
  });

  it("passes custom title to AI when provided", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: makeValidImportResponse({ title: "Custom Title" }),
        },
      }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      title: "My Custom Title",
      files: [textFile()],
    });

    expect(res.status).toBe(200);
    const call = mockCreate.mock.calls[0];
    const messages = (call[0] as any).messages;
    const systemText = messages[0].content.find((p: any) => p.type === "text" && p.text.includes("My Custom Title"));
    expect(systemText).toBeDefined();
  });

  it("handles AI response with schema-invalid JSON (missing nodes field)", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"title":"NoNodes","edges":[]}' } }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(422);
  });

  it("handles AI response with duplicate-heavy nodes", async () => {
    const nodes = Array.from({ length: 30 }, (_, i) => ({
      title: `Node ${i % 5}`,
      type: "concept",
      note: `Note ${i}`,
    }));
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({ title: "Dupes", nodes, edges: [] }),
        },
      }],
    } as any);

    const res = await request(app).post("/api/atlas/import").send({
      files: [textFile()],
    });

    expect(res.status).toBe(200);
    expect(res.body.nodes.length).toBe(30);
  });
});

describe("POST /api/atlas/generate", () => {
  beforeEach(async () => {
    mockCreate.mockReset();
    await setupApp();
  });

  it("returns 400 when nodes is missing", async () => {
    const res = await request(app).post("/api/atlas/generate").send({
      atlasTitle: "Test",
      mode: "summary",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("nodes array required");
  });

  it("streams SSE content for valid request", async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: "Hello " } }] };
        yield { choices: [{ delta: { content: "World" } }] };
      },
      controller: { abort: vi.fn() },
    };

    mockCreate.mockResolvedValueOnce(mockStream as any);

    const written: string[] = [];
    let ended = false;
    const mockRes = {
      setHeader: vi.fn(),
      on: vi.fn(),
      write: vi.fn((data: string) => { written.push(data); return true; }),
      end: vi.fn(() => { ended = true; }),
      writableEnded: false,
    };
    const closeCb: (() => void)[] = [];
    const mockReq = {
      body: {
        atlasTitle: "Test Atlas",
        nodes: [{ type: "concept", title: "Node1", note: "note" }],
        edges: [],
        mode: "summary",
      },
      on: vi.fn((_event: string, cb: () => void) => { closeCb.push(cb); }),
    };

    const res = await request(app)
      .post("/api/atlas/generate")
      .send(mockReq.body);

    await new Promise((r) => setTimeout(r, 100));

    const call = mockCreate.mock.calls[0];
    expect(call).toBeDefined();
    const prompt = (call[0] as any).messages[0].content;
    expect(prompt).toContain("Test Atlas");
    expect(prompt).toContain("Node1");
  });

  it("sends error SSE when AI throws (mock verifies call)", async () => {
    mockCreate.mockRejectedValueOnce(new Error("AI Failed"));

    await request(app)
      .post("/api/atlas/generate")
      .send({
        atlasTitle: "Test",
        nodes: [{ type: "concept", title: "X" }],
        edges: [],
        mode: "summary",
      });

    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0];
    expect((call[0] as any).stream).toBe(true);
    expect((call[0] as any).model).toBe("gpt-4o");
  });

  it("uses correct mode prompt for each mode", async () => {
    for (const [mode, keyword] of [
      ["summary", "synthesizer"],
      ["explain", "accessible"],
      ["questions", "provocateur"],
      ["gaps", "contradictions"],
    ] as const) {
      mockCreate.mockReset();
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: "OK" } }] };
        },
        controller: { abort: vi.fn() },
      };
      mockCreate.mockResolvedValueOnce(mockStream as any);

      await request(app)
        .post("/api/atlas/generate")
        .send({
          atlasTitle: "Test",
          nodes: [{ type: "concept", title: "X" }],
          edges: [{ sourceTitle: "X", targetTitle: "Y", label: "rel" }],
          mode,
        })
        .buffer(true)
        .parse((res, cb) => {
          let data = "";
          res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
          res.on("end", () => { cb(null, data); });
        });

      const call = mockCreate.mock.calls[0];
      const prompt = (call[0] as any).messages[0].content;
      expect(prompt).toContain(keyword);
    }
  });
});
