import { describe, expect, it } from "vitest";
import {
  hasRequiredPermission,
  parseLanguageOverride,
  readActionConfig,
  resolveLanguage,
} from "../src/action/config";

describe("action configuration", () => {
  it("reads defaults and required secrets", () => {
    const values: Record<string, string> = {
      "github-token": "github-token",
      "openai-api-key": "openai-key",
    };
    const config = readActionConfig((name) => values[name] ?? "");

    expect(config.language).toBe("auto");
    expect(config.model).toBe("gpt-5.6-terra");
    expect(config.viewerUrl).toBe("https://rhty.github.io/pr-explainer/");
    expect(config.maxUrlChars).toBe(48_000);
  });

  it("rejects unsafe viewer URLs", () => {
    expect(() =>
      readActionConfig((name) => {
        if (name === "github-token" || name === "openai-api-key")
          return "secret";
        if (name === "viewer-url") return "http://example.com/viewer";
        return "";
      }),
    ).toThrow(/HTTPS/u);
  });
});

describe("language resolution", () => {
  it("lets an exact command override the configured language", () => {
    expect(parseLanguageOverride("/pr-explain --lang ja", "/pr-explain")).toBe(
      "ja",
    );
    expect(
      resolveLanguage("en", "/pr-explain --lang ja", "/pr-explain", "English"),
    ).toBe("ja");
  });

  it("infers Japanese, Korean, Chinese, and English", () => {
    expect(
      resolveLanguage("auto", undefined, "/pr-explain", "変更を説明"),
    ).toBe("ja");
    expect(resolveLanguage("auto", undefined, "/pr-explain", "변경 설명")).toBe(
      "ko",
    );
    expect(resolveLanguage("auto", undefined, "/pr-explain", "变更说明")).toBe(
      "zh-CN",
    );
    expect(
      resolveLanguage("auto", undefined, "/pr-explain", "Explain change"),
    ).toBe("en");
  });
});

describe("permission checks", () => {
  it("uses GitHub's permission ordering", () => {
    expect(hasRequiredPermission("admin", "write")).toBe(true);
    expect(hasRequiredPermission("write", "write")).toBe(true);
    expect(hasRequiredPermission("triage", "write")).toBe(false);
  });
});
