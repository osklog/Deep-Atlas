const DEFAULT_TIMEOUT = 120_000;

export function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return "/api";
}

export async function apiPost<T = unknown>(
  path: string,
  body: unknown,
  opts?: { timeout?: number; signal?: AbortSignal }
): Promise<T> {
  const controller = new AbortController();
  const timeout = opts?.timeout ?? DEFAULT_TIMEOUT;
  const timer = setTimeout(() => controller.abort(), timeout);

  if (opts?.signal) {
    opts.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      let msg = `Server error ${res.status}`;
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {}
      throw new Error(msg);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      throw new Error("Request timed out. Try with fewer or smaller files.");
    }
    throw err;
  }
}

export interface StreamCallbacks {
  onContent: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

export async function apiStream(
  path: string,
  body: unknown,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  if (signal) {
    signal.addEventListener("abort", () => controller.abort());
  }

  try {
    const res = await fetch(`${getApiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok || !res.body) {
      callbacks.onError("Failed to connect to AI. Check your connection.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.content) callbacks.onContent(data.content);
          if (data.done) callbacks.onDone();
          if (data.error) callbacks.onError(data.error);
        } catch {}
      }
    }
    callbacks.onDone();
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === "AbortError") {
      callbacks.onError("Request timed out.");
    } else {
      callbacks.onError("Connection failed. Make sure the API server is running.");
    }
  }
}
