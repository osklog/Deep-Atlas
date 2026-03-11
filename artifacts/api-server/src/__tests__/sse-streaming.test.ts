import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("pdf-parse", () => ({ default: vi.fn() }));

const { openai } = await import("@workspace/integrations-openai-ai-server");
const mockCreate = vi.mocked(openai.chat.completions.create);

function createSSEApp() {
  const sseApp = express();
  sseApp.use(express.json());

  sseApp.post("/sse-test", async (req, res) => {
    const { words, shouldError, emptyDeltas } = req.body;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (shouldError) {
      res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
      res.end();
      return;
    }

    if (emptyDeltas) {
      res.write(`data: ${JSON.stringify({ content: "Text" })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    for (const word of (words || [])) {
      res.write(`data: ${JSON.stringify({ content: word })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  });

  return sseApp;
}

let server: http.Server;
let port: number;

function startServer(): Promise<void> {
  const app = createSSEApp();
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      port = (server.address() as any).port;
      resolve();
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

function collectSSE(
  body: Record<string, unknown>,
): Promise<{ events: Array<Record<string, unknown>>; rawData: string; statusCode: number; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/sse-test",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          Accept: "text/event-stream",
        },
      },
      (res) => {
        let rawData = "";
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === "string") headers[k] = v;
        }

        res.setEncoding("utf-8");
        res.on("data", (chunk: string) => {
          rawData += chunk;
        });

        res.on("end", () => {
          const events: Array<Record<string, unknown>> = [];
          const lines = rawData.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                events.push(JSON.parse(line.slice(6)));
              } catch {}
            }
          }
          resolve({ events, rawData, statusCode: res.statusCode ?? 0, headers });
        });
      },
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

describe("SSE streaming via raw HTTP (direct server)", () => {
  beforeEach(async () => {
    await startServer();
  });

  afterEach(async () => {
    await stopServer();
  });

  it("streams multiple content chunks and a done event", async () => {
    const words = ["The ", "transformer ", "architecture ", "is ", "powerful."];
    const result = await collectSSE({ words });

    expect(result.statusCode).toBe(200);

    const contentEvents = result.events.filter((e) => "content" in e);
    const doneEvent = result.events.find((e) => (e as any).done === true);

    expect(contentEvents.length).toBe(words.length);
    expect((contentEvents[0] as any).content).toBe("The ");
    expect((contentEvents[contentEvents.length - 1] as any).content).toBe("powerful.");
    expect(doneEvent).toBeDefined();

    const fullText = contentEvents.map((e) => (e as any).content).join("");
    expect(fullText).toBe("The transformer architecture is powerful.");
  });

  it("streams error event when AI throws", async () => {
    const result = await collectSSE({ shouldError: true });

    expect(result.statusCode).toBe(200);

    const errorEvent = result.events.find((e) => "error" in e);
    expect(errorEvent).toBeDefined();
    expect((errorEvent as any).error).toBe("Generation failed");
  });

  it("SSE response has correct headers", async () => {
    const result = await collectSSE({ words: ["OK"] });

    expect(result.headers["content-type"]).toBe("text/event-stream");
    expect(result.headers["cache-control"]).toBe("no-cache");
    expect(result.headers["connection"]).toBe("keep-alive");
  });

  it("handles single-word stream correctly", async () => {
    const result = await collectSSE({ words: ["Hello"] });

    const contents = result.events.filter((e) => "content" in e);
    expect(contents).toHaveLength(1);
    expect((contents[0] as any).content).toBe("Hello");
    expect(result.events.some((e) => (e as any).done)).toBe(true);
  });

  it("handles response with only content (no empty deltas)", async () => {
    const result = await collectSSE({ emptyDeltas: true });

    const contents = result.events.filter((e) => "content" in e);
    expect(contents).toHaveLength(1);
    expect((contents[0] as any).content).toBe("Text");
    expect(result.events.some((e) => (e as any).done)).toBe(true);
  });

  it("raw SSE format is correct (data: + JSON + double newline)", async () => {
    const result = await collectSSE({ words: ["X"] });

    expect(result.rawData).toContain('data: {"content":"X"}');
    expect(result.rawData).toContain('data: {"done":true}');
    const dataLines = result.rawData.split("\n").filter((l) => l.startsWith("data: "));
    expect(dataLines.length).toBe(2);
  });

  it("streams many chunks without data loss", async () => {
    const words = Array.from({ length: 20 }, (_, i) => `chunk${i} `);
    const result = await collectSSE({ words });

    const contents = result.events.filter((e) => "content" in e);
    expect(contents).toHaveLength(20);
    const fullText = contents.map((e) => (e as any).content).join("");
    expect(fullText).toBe(words.join(""));
  });

  it("handles empty words array — only done event", async () => {
    const result = await collectSSE({ words: [] });

    const contents = result.events.filter((e) => "content" in e);
    expect(contents).toHaveLength(0);
    expect(result.events.some((e) => (e as any).done)).toBe(true);
  });
});

describe("SSE generate route integration (mocked AI)", () => {
  let routeApp: express.Express;
  let routeServer: http.Server;
  let routePort: number;

  async function startRouteServer() {
    const atlasModule = await import("../routes/atlas.js");
    routeApp = express();
    routeApp.use(express.json());
    routeApp.use("/api/atlas", atlasModule.default);

    return new Promise<void>((resolve) => {
      routeServer = routeApp.listen(0, () => {
        routePort = (routeServer.address() as any).port;
        resolve();
      });
    });
  }

  beforeEach(async () => {
    mockCreate.mockReset();
    await startRouteServer();
  });

  afterEach(async () => {
    return new Promise<void>((resolve) => {
      routeServer.close(() => resolve());
    });
  });

  it("verifies AI is called with correct parameters for SSE stream", async () => {
    const mockStream = {
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: "OK" } }] };
      },
      controller: { abort: vi.fn() },
    };
    mockCreate.mockResolvedValueOnce(mockStream as any);

    await new Promise<void>((resolve, reject) => {
      const body = JSON.stringify({
        atlasTitle: "My Atlas",
        nodes: [
          { type: "concept", title: "Node A", note: "note", tags: ["t1"] },
          { type: "person", title: "Node B" },
        ],
        edges: [{ sourceTitle: "A", targetTitle: "B", label: "supports" }],
        mode: "summary",
      });

      const req = http.request({
        hostname: "127.0.0.1",
        port: routePort,
        path: "/api/atlas/generate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      }, (res) => {
        res.on("data", () => {});
        res.on("end", () => {
          expect(mockCreate).toHaveBeenCalledOnce();
          const call = mockCreate.mock.calls[0];
          const opts = call[0] as any;
          expect(opts.model).toBe("gpt-4o");
          expect(opts.max_tokens).toBe(4096);
          expect(opts.stream).toBe(true);
          const prompt = opts.messages[0].content;
          expect(prompt).toContain("My Atlas");
          expect(prompt).toContain("Node A");
          expect(prompt).toContain("synthesizer");
          resolve();
        });
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  });

  it("verifies each mode uses the correct system prompt keyword", async () => {
    const modes = [
      { mode: "summary", keyword: "synthesizer" },
      { mode: "explain", keyword: "accessible" },
      { mode: "questions", keyword: "provocateur" },
      { mode: "gaps", keyword: "contradictions" },
    ];

    for (const { mode, keyword } of modes) {
      mockCreate.mockReset();
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: "OK" } }] };
        },
        controller: { abort: vi.fn() },
      };
      mockCreate.mockResolvedValueOnce(mockStream as any);

      await new Promise<void>((resolve, reject) => {
        const body = JSON.stringify({
          atlasTitle: "T",
          nodes: [{ type: "concept", title: "X" }],
          edges: [],
          mode,
        });
        const req = http.request({
          hostname: "127.0.0.1",
          port: routePort,
          path: "/api/atlas/generate",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        }, (res) => {
          res.on("data", () => {});
          res.on("end", () => {
            const prompt = (mockCreate.mock.calls[0][0] as any).messages[0].content;
            expect(prompt).toContain(keyword);
            resolve();
          });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
      });
    }
  });
});
