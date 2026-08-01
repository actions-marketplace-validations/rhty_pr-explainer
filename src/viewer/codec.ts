import {
  base64UrlToBytes,
  bytesToBase64Url,
  isReportPayload,
  parseReportPayload,
  type ReportPayload,
} from "../shared/payload";

const MAX_DECOMPRESSED_BYTES = 1_000_000;

export async function decodeReport(value: string): Promise<ReportPayload> {
  if (value.length > 100_000) {
    throw new Error("This report URL is larger than the viewer safety limit.");
  }

  const compressed = base64UrlToBytes(value);
  const compressedBuffer = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([compressedBuffer])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const bytes = await readWithLimit(stream, MAX_DECOMPRESSED_BYTES);
  return parseReportPayload(new TextDecoder().decode(bytes));
}

export async function encodeReport(payload: ReportPayload): Promise<string> {
  if (!isReportPayload(payload))
    throw new Error("Cannot encode an invalid report.");

  const stream = new Blob([JSON.stringify(payload)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return bytesToBase64Url(bytes);
}

async function readWithLimit(
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error(
        "The decompressed report exceeds the viewer safety limit.",
      );
    }
    chunks.push(value);
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
