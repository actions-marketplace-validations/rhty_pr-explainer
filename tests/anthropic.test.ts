import { describe, expect, it, vi } from "vitest";
import { generateHtmlWithAnthropic } from "../src/action/anthropic";

describe("Anthropic response handling", () => {
  it("calls Messages with the configured model and extracts HTML", async () => {
    const fetchImplementation = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
        const headers = new Headers(init?.headers);
        expect(headers.get("x-api-key")).toBe("secret");
        expect(headers.get("anthropic-version")).toBe("2023-06-01");

        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body.model).toBe("claude-custom");
        expect(body.max_tokens).toBe(24_000);
        expect(body.system).toBe("Create HTML");
        expect(body.messages).toEqual([{ role: "user", content: "{}" }]);

        return new Response(
          JSON.stringify({
            content: [
              {
                type: "text",
                text: "```html\n<html><body><h1>Claude report</h1></body></html>\n```",
              },
            ],
            stop_reason: "end_turn",
          }),
          { status: 200 },
        );
      },
    );

    const html = await generateHtmlWithAnthropic({
      apiKey: "secret",
      model: "claude-custom",
      instructions: "Create HTML",
      input: "{}",
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    expect(html).toMatch(/^<!doctype html>/iu);
    expect(html).toContain("<h1>Claude report</h1>");
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("surfaces API errors and request IDs", async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: "Invalid API key" } }),
          {
            status: 401,
            headers: { "request-id": "req_anthropic" },
          },
        ),
    );

    await expect(
      generateHtmlWithAnthropic({
        apiKey: "bad",
        model: "claude-custom",
        instructions: "Create HTML",
        input: "{}",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).rejects.toThrow(/Invalid API key.*req_anthropic/u);
  });

  it("rejects output truncated by the provider", async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            content: [{ type: "text", text: "<html><body>" }],
            stop_reason: "max_tokens",
          }),
          { status: 200 },
        ),
    );

    await expect(
      generateHtmlWithAnthropic({
        apiKey: "secret",
        model: "claude-custom",
        instructions: "Create HTML",
        input: "{}",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).rejects.toThrow(/max_tokens/u);
  });
});
