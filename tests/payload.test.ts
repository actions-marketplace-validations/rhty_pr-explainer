import { describe, expect, it } from "vitest";
import { createReportPayload, createReportUrl } from "../src/action/report";
import { decodeReport } from "../src/viewer/codec";

describe("report payload", () => {
  it("round-trips through the same format used by Action and Viewer", async () => {
    const payload = createReportPayload({
      language: "ja",
      title: "認証フローを更新",
      repository: "rhty/example",
      pullNumber: 42,
      pullUrl: "https://github.com/rhty/example/pull/42",
      headSha: "abc123",
      html: '<!doctype html><html lang="ja"><body>説明</body></html>',
    });
    const url = createReportUrl("https://example.com/viewer/", payload, 48_000);
    const encoded = new URLSearchParams(new URL(url).hash.slice(1)).get("r");

    expect(encoded).toBeTruthy();
    await expect(decodeReport(encoded!)).resolves.toMatchObject({
      version: 1,
      language: "ja",
      pullNumber: 42,
      html: payload.html,
    });
  });

  it("enforces the configured URL limit", () => {
    const payload = createReportPayload({
      language: "en",
      title: "Large report",
      repository: "rhty/example",
      pullNumber: 1,
      pullUrl: "https://github.com/rhty/example/pull/1",
      headSha: "abc123",
      html: `<!doctype html><html><body>${crypto.randomUUID().repeat(500)}</body></html>`,
    });

    expect(() => createReportUrl("https://example.com/", payload, 100)).toThrow(
      /exceeding the configured limit/u,
    );
  });
});
