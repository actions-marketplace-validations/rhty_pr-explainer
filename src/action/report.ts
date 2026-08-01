import { gzipSync } from "node:zlib";
import { REPORT_PAYLOAD_VERSION, type ReportPayload } from "../shared/payload";

export interface ReportMetadata {
  language: string;
  title: string;
  repository: string;
  pullNumber: number;
  pullUrl: string;
  headSha: string;
  html: string;
}

export function createReportPayload(metadata: ReportMetadata): ReportPayload {
  return {
    version: REPORT_PAYLOAD_VERSION,
    language: metadata.language,
    title: metadata.title.slice(0, 240),
    repository: metadata.repository,
    pullNumber: metadata.pullNumber,
    pullUrl: metadata.pullUrl,
    headSha: metadata.headSha,
    createdAt: new Date().toISOString(),
    html: metadata.html,
  };
}

export function encodeReportPayload(payload: ReportPayload): string {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload)), {
    level: 9,
  });
  return compressed.toString("base64url");
}

export function createReportUrl(
  viewerUrl: string,
  payload: ReportPayload,
  maxUrlChars: number,
): string {
  const encoded = encodeReportPayload(payload);
  const reportUrl = `${viewerUrl}#r=${encoded}`;

  if (reportUrl.length > maxUrlChars) {
    throw new Error(
      `The generated report URL is ${reportUrl.length.toLocaleString()} characters, exceeding the configured limit of ${maxUrlChars.toLocaleString()}. Reduce max-diff-chars or ask the model for a shorter report.`,
    );
  }

  return reportUrl;
}
