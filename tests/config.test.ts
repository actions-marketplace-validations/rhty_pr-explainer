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

    expect(config.provider).toBe("openai");
    expect(config.apiKey).toBe("openai-key");
    expect(config.language).toBe("auto");
    expect(config.model).toBe("gpt-5.6-terra");
    expect(config.viewerUrl).toBe("https://rhty.github.io/pr-explainer/");
    expect(config.maxUrlChars).toBe(48_000);
  });

  it("uses the Anthropic default with the provider-neutral API key", () => {
    const values: Record<string, string> = {
      "github-token": "github-token",
      "api-key": "anthropic-key",
      provider: "anthropic",
    };
    const config = readActionConfig((name) => values[name] ?? "");

    expect(config.provider).toBe("anthropic");
    expect(config.apiKey).toBe("anthropic-key");
    expect(config.model).toBe("claude-sonnet-5");
  });

  it("passes a custom provider model ID through unchanged", () => {
    const values: Record<string, string> = {
      "github-token": "github-token",
      "api-key": "anthropic-key",
      provider: "anthropic",
      model: "claude-opus-5",
    };
    const config = readActionConfig((name) => values[name] ?? "");

    expect(config.model).toBe("claude-opus-5");
  });

  it("rejects unsupported providers and missing provider keys", () => {
    expect(() =>
      readActionConfig((name) => (name === "provider" ? "other" : "secret")),
    ).toThrow(/Invalid provider/u);

    expect(() =>
      readActionConfig((name) => {
        if (name === "github-token") return "github-token";
        if (name === "provider") return "anthropic";
        return "";
      }),
    ).toThrow(/api-key is required/u);
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
