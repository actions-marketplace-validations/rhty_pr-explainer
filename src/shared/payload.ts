export const REPORT_PAYLOAD_VERSION = 1 as const;

export interface ReportPayload {
  version: typeof REPORT_PAYLOAD_VERSION;
  language: string;
  title: string;
  repository?: string;
  pullNumber?: number;
  pullUrl?: string;
  headSha?: string;
  createdAt: string;
  html: string;
}

export function isReportPayload(value: unknown): value is ReportPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ReportPayload>;
  return (
    candidate.version === REPORT_PAYLOAD_VERSION &&
    typeof candidate.language === "string" &&
    candidate.language.length > 0 &&
    typeof candidate.title === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.html === "string" &&
    candidate.html.length > 0 &&
    (candidate.pullNumber === undefined ||
      (Number.isInteger(candidate.pullNumber) && candidate.pullNumber > 0))
  );
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(
      "The report payload contains invalid Base64URL characters.",
    );
  }

  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(
    value.replaceAll("-", "+").replaceAll("_", "/") + padding,
  );
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function parseReportPayload(json: string): ReportPayload {
  let value: unknown;

  try {
    value = JSON.parse(json);
  } catch {
    throw new Error("The report payload is not valid JSON.");
  }

  if (!isReportPayload(value)) {
    throw new Error(
      "This report uses an unsupported or invalid payload format.",
    );
  }

  return value;
}
