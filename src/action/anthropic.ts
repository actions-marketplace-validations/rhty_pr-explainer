import { normalizeHtml } from "./html";

export interface GenerateAnthropicHtmlOptions {
  apiKey: string;
  model: string;
  instructions: string;
  input: string;
  fetchImplementation?: typeof fetch;
}

interface AnthropicResponse {
  error?: { message?: string };
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string | null;
}

export async function generateHtmlWithAnthropic(
  options: GenerateAnthropicHtmlOptions,
): Promise<string> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImplementation(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "x-api-key": options.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            max_tokens: 24_000,
            system: options.instructions,
            messages: [{ role: "user", content: options.input }],
          }),
          signal: AbortSignal.timeout(360_000),
        },
      );

      if (!response.ok) {
        const message = await readErrorMessage(response);
        const requestId =
          response.headers.get("request-id") ??
          response.headers.get("x-request-id");
        const error = new Error(
          `Anthropic API returned ${response.status}: ${message}${requestId ? ` (request ${requestId})` : ""}`,
        );

        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < 2
        ) {
          lastError = error;
          await delay(retryDelay(response, attempt));
          continue;
        }
        throw error;
      }

      const result = (await response.json()) as AnthropicResponse;
      if (result.error?.message) throw new Error(result.error.message);
      if (result.stop_reason === "max_tokens") {
        throw new Error(
          "Anthropic stopped at max_tokens before completing the HTML document.",
        );
      }

      const html = (result.content ?? [])
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();
      if (!html) {
        throw new Error(
          `Anthropic returned no HTML output (stop reason: ${result.stop_reason ?? "unknown"}).`,
        );
      }

      return normalizeHtml(html);
    } catch (error) {
      if (attempt < 2 && isRetryableNetworkError(error)) {
        lastError = asError(error);
        await delay(1_000 * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }

  throw (
    lastError ?? new Error("Anthropic request failed after three attempts.")
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText || "Unknown error";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1_000, 20_000);
  }
  return 1_000 * 2 ** attempt;
}

function isRetryableNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === "TimeoutError")
  );
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
