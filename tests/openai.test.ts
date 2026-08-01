import { describe, expect, it, vi } from "vitest";
import { generateHtmlWithOpenAi } from "../src/action/openai";

describe("OpenAI response handling", () => {
  it("calls Responses with storage disabled and extracts HTML", async () => {
    const fetchImplementation = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        expect(body.store).toBe(false);
        expect(body.model).toBe("gpt-test");
        expect(body.reasoning).toEqual({ effort: "low" });

        return new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: "```html\n<html><body><h1>Report</h1></body></html>\n```",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        );
      },
    );

    const html = await generateHtmlWithOpenAi({
      apiKey: "secret",
      model: "gpt-test",
      reasoningEffort: "low",
      instructions: "Create HTML",
      input: "{}",
      fetchImplementation: fetchImplementation as typeof fetch,
    });

    expect(html).toMatch(/^<!doctype html>/iu);
    expect(html).toContain("<h1>Report</h1>");
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });

  it("surfaces API errors", async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: "Invalid API key" } }),
          {
            status: 401,
            headers: { "x-request-id": "req_test" },
          },
        ),
    );

    await expect(
      generateHtmlWithOpenAi({
        apiKey: "bad",
        model: "gpt-test",
        reasoningEffort: "low",
        instructions: "Create HTML",
        input: "{}",
        fetchImplementation: fetchImplementation as typeof fetch,
      }),
    ).rejects.toThrow(/Invalid API key.*req_test/u);
  });
});
