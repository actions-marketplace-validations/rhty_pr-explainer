// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { prepareReportDocument } from "../src/viewer/sanitize";

describe("report sanitization", () => {
  it("removes report-owned scripts and active content", () => {
    const output = prepareReportDocument(`<!doctype html>
      <html><head>
        <script>window.top.location = 'https://evil.example'</script>
        <link rel="stylesheet" href="https://cdn.example/style.css">
      </head><body onload="alert(1)">
        <a href="javascript:alert(1)">bad</a>
        <a href="https://github.com/rhty/example/blob/abc/file.ts#L10">good</a>
        <iframe src="https://evil.example"></iframe>
        <img src="https://images.example/diagram.png" onerror="alert(1)">
      </body></html>`);
    const parsed = new DOMParser().parseFromString(output, "text/html");

    expect(parsed.querySelector("script")).toBeNull();
    expect(parsed.querySelector("iframe")).toBeNull();
    expect(parsed.body.hasAttribute("onload")).toBe(false);
    expect(parsed.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(parsed.querySelectorAll("a")[1]?.target).toBe("_blank");
    expect(parsed.querySelector("img")?.hasAttribute("onerror")).toBe(false);
    expect(parsed.querySelector('link[rel="stylesheet"]')).not.toBeNull();
  });

  it("injects only the viewer-owned Mermaid runtime", () => {
    const output = prepareReportDocument(
      '<html><body><pre class="mermaid">graph LR; A-->B</pre></body></html>',
    );
    const parsed = new DOMParser().parseFromString(output, "text/html");
    const scripts = parsed.querySelectorAll("script");
    const policy = parsed.querySelector<HTMLMetaElement>(
      'meta[http-equiv="Content-Security-Policy"]',
    );

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.textContent).toContain("mermaid@11.16.0");
    expect(policy?.content).toContain("https://cdn.jsdelivr.net");
    expect(scripts[0]?.getAttribute("nonce")).toBeTruthy();
  });
});
