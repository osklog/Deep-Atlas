export const cacheDirectory = "/tmp/test-cache/";

export async function writeAsStringAsync(
  _uri: string,
  _content: string,
  _opts?: unknown
): Promise<void> {}

export async function readAsStringAsync(
  _uri: string,
  _opts?: unknown
): Promise<string> {
  return "";
}

export const EncodingType = {
  UTF8: "utf8",
  Base64: "base64",
};
