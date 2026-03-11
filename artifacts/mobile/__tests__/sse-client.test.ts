import { describe, it, expect, vi, beforeEach } from "vitest";
import http from "node:http";
import { apiStream, type StreamCallbacks } from "@/lib/api";

describe("SSE client consumption against a real local server", () => {
  let server: http.Server;
  let port: number;

  function startMockSSEServer(
    handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  ): Promise<void> {
    return new Promise((resolve) => {
      server = http.createServer(handler);
      server.listen(0, () => {
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

  afterEach(async () => {
    await stopServer();
  });

  it("receives streamed content chunks from a mock SSE server", async () => {
    await startMockSSEServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write('data: {"content":"First "}\n\n');
      res.write('data: {"content":"chunk. "}\n\n');
      res.write('data: {"content":"Final chunk."}\n\n');
      res.write('data: {"done":true}\n\n');
      res.end();
    });

    const contents: string[] = [];
    let doneCount = 0;
    const errors: string[] = [];

    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string"
        ? input.replace(/^.*\/api/, `http://127.0.0.1:${port}`)
        : input;
      return originalFetch(url, init);
    });

    const callbacks: StreamCallbacks = {
      onContent: (text) => contents.push(text),
      onDone: () => doneCount++,
      onError: (msg) => errors.push(msg),
    };

    await apiStream("/test-sse", { data: "x" }, callbacks);

    vi.restoreAllMocks();

    expect(contents).toEqual(["First ", "chunk. ", "Final chunk."]);
    expect(doneCount).toBeGreaterThanOrEqual(1);
    expect(errors).toHaveLength(0);
  });

  it("handles server error response", async () => {
    await startMockSSEServer((_req, res) => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    });

    const contents: string[] = [];
    const errors: string[] = [];

    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string"
        ? input.replace(/^.*\/api/, `http://127.0.0.1:${port}`)
        : input;
      return originalFetch(url, init);
    });

    await apiStream("/test-error", {}, {
      onContent: (t) => contents.push(t),
      onDone: () => {},
      onError: (msg) => errors.push(msg),
    });

    vi.restoreAllMocks();

    expect(contents).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Failed to connect");
  });

  it("handles interleaved data and non-data lines", async () => {
    await startMockSSEServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      res.write(": this is a comment\n");
      res.write("event: heartbeat\n\n");
      res.write('data: {"content":"A"}\n\n');
      res.write(": another comment\n");
      res.write('data: {"content":"B"}\n\n');
      res.write('data: {"done":true}\n\n');
      res.end();
    });

    const contents: string[] = [];

    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string"
        ? input.replace(/^.*\/api/, `http://127.0.0.1:${port}`)
        : input;
      return originalFetch(url, init);
    });

    await apiStream("/test-interleaved", {}, {
      onContent: (t) => contents.push(t),
      onDone: () => {},
      onError: () => {},
    });

    vi.restoreAllMocks();

    expect(contents).toEqual(["A", "B"]);
  });

  it("handles delayed chunks (simulating real streaming latency)", async () => {
    await startMockSSEServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });

      const chunks = [
        'data: {"content":"Slow "}\n\n',
        'data: {"content":"stream "}\n\n',
        'data: {"content":"works."}\n\n',
        'data: {"done":true}\n\n',
      ];

      let i = 0;
      const interval = setInterval(() => {
        if (i < chunks.length) {
          res.write(chunks[i]);
          i++;
        } else {
          clearInterval(interval);
          res.end();
        }
      }, 20);
    });

    const contents: string[] = [];
    let done = false;

    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = typeof input === "string"
        ? input.replace(/^.*\/api/, `http://127.0.0.1:${port}`)
        : input;
      return originalFetch(url, init);
    });

    await apiStream("/test-delayed", {}, {
      onContent: (t) => contents.push(t),
      onDone: () => { done = true; },
      onError: () => {},
    });

    vi.restoreAllMocks();

    expect(contents).toEqual(["Slow ", "stream ", "works."]);
    expect(done).toBe(true);
  });
});

import { afterEach } from "vitest";
