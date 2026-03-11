import { describe, it, expect, vi, beforeEach } from "vitest";
import { getApiBase, apiPost, apiStream, type StreamCallbacks } from "@/lib/api";

describe("getApiBase", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses EXPO_PUBLIC_DOMAIN when set", () => {
    process.env.EXPO_PUBLIC_DOMAIN = "myapp.replit.dev";
    expect(getApiBase()).toBe("https://myapp.replit.dev/api");
  });

  it("falls back to /api when no domain", () => {
    delete process.env.EXPO_PUBLIC_DOMAIN;
    expect(getApiBase()).toBe("/api");
  });
});

describe("apiPost", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_DOMAIN;
  });

  it("sends POST with JSON body and returns parsed response", async () => {
    const mockResponse = { data: "test" };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await apiPost("/test", { key: "value" });
    expect(result).toEqual(mockResponse);

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toContain("/api/test");
    expect(call[1]?.method).toBe("POST");
    expect(call[1]?.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(call[1]?.body as string)).toEqual({ key: "value" });
  });

  it("throws on server error with error message from body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ error: "Custom error message" }),
    } as unknown as Response);

    await expect(apiPost("/test", {})).rejects.toThrow("Custom error message");
  });

  it("throws on server error with status when no body error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error(); },
    } as unknown as Response);

    await expect(apiPost("/test", {})).rejects.toThrow("Server error 500");
  });

  it("throws timeout error on AbortError", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);

    await expect(apiPost("/test", {}, { timeout: 1 })).rejects.toThrow("Request timed out");
  });

  it("propagates external abort signal", async () => {
    const ac = new AbortController();
    const fetchPromise = new Promise<Response>((_, reject) => {
      ac.signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(fetchPromise);

    const promise = apiPost("/test", {}, { signal: ac.signal, timeout: 60000 });
    ac.abort();
    await expect(promise).rejects.toThrow("Request timed out");
  });
});

describe("apiStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.EXPO_PUBLIC_DOMAIN;
  });

  it("calls onContent for each content chunk", async () => {
    const chunks = [
      'data: {"content":"Hello "}\n\n',
      'data: {"content":"World"}\n\n',
      'data: {"done":true}\n\n',
    ];

    let chunkIndex = 0;
    const mockReader = {
      read: async () => {
        if (chunkIndex < chunks.length) {
          const chunk = new TextEncoder().encode(chunks[chunkIndex++]);
          return { done: false, value: chunk };
        }
        return { done: true, value: undefined };
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const contents: string[] = [];
    let doneCount = 0;
    const callbacks: StreamCallbacks = {
      onContent: (text) => contents.push(text),
      onDone: () => doneCount++,
      onError: () => {},
    };

    await apiStream("/test", {}, callbacks);
    expect(contents).toEqual(["Hello ", "World"]);
    expect(doneCount).toBeGreaterThanOrEqual(1);
  });

  it("calls onError when response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      body: null,
    } as unknown as Response);

    const errors: string[] = [];
    const callbacks: StreamCallbacks = {
      onContent: () => {},
      onDone: () => {},
      onError: (msg) => errors.push(msg),
    };

    await apiStream("/test", {}, callbacks);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Failed to connect");
  });

  it("calls onError on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const errors: string[] = [];
    const callbacks: StreamCallbacks = {
      onContent: () => {},
      onDone: () => {},
      onError: (msg) => errors.push(msg),
    };

    await apiStream("/test", {}, callbacks);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Connection failed");
  });

  it("handles SSE lines that are not data: prefixed", async () => {
    const chunks = [
      ': comment\nevent: something\ndata: {"content":"OK"}\n\n',
    ];
    let chunkIndex = 0;
    const mockReader = {
      read: async () => {
        if (chunkIndex < chunks.length) {
          return { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) };
        }
        return { done: true, value: undefined };
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const contents: string[] = [];
    await apiStream("/test", {}, {
      onContent: (t) => contents.push(t),
      onDone: () => {},
      onError: () => {},
    });
    expect(contents).toEqual(["OK"]);
  });

  it("handles malformed JSON in SSE data gracefully", async () => {
    const chunks = ['data: {broken json}\ndata: {"content":"OK"}\n\n'];
    let chunkIndex = 0;
    const mockReader = {
      read: async () => {
        if (chunkIndex < chunks.length) {
          return { done: false, value: new TextEncoder().encode(chunks[chunkIndex++]) };
        }
        return { done: true, value: undefined };
      },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const contents: string[] = [];
    const errors: string[] = [];
    await apiStream("/test", {}, {
      onContent: (t) => contents.push(t),
      onDone: () => {},
      onError: (m) => errors.push(m),
    });
    expect(contents).toEqual(["OK"]);
    expect(errors).toHaveLength(0);
  });
});
