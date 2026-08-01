import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("viewer security policy", () => {
  it("allows sandboxed report styles, HTTPS assets, and pinned Mermaid", () => {
    const index = readFileSync("src/viewer/index.html", "utf8");

    expect(index).toContain("script-src 'self' https://cdn.jsdelivr.net");
    expect(index).toContain("style-src 'self' 'unsafe-inline' https:");
    expect(index).toContain("img-src 'self' https: data: blob:");
    expect(index).toContain("connect-src 'none'");
    expect(index).toContain('sandbox="allow-scripts');
    expect(index).not.toContain("allow-same-origin");
  });
});
