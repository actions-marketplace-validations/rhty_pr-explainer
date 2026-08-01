export interface GenerateHtmlOptions {
  apiKey: string;
  model: string;
  reasoningEffort: string;
  instructions: string;
  input: string;
  fetchImplementation?: typeof fetch;
}

interface OpenAiResponse {
  status?: string;
  error?: { message?: string } | null;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

export async function generateHtmlWithOpenAi(
  options: GenerateHtmlOptions,
): Promise<string> {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImplementation(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            instructions: options.instructions,
            input: options.input,
            reasoning: { effort: options.reasoningEffort },
            max_output_tokens: 24_000,
            store: false,
            text: { format: { type: "text" } },
          }),
          signal: AbortSignal.timeout(360_000),
        },
      );

      if (!response.ok) {
        const message = await readErrorMessage(response);
        const requestId = response.headers.get("x-request-id");
        const error = new Error(
          `OpenAI API returned ${response.status}: ${message}${requestId ? ` (request ${requestId})` : ""}`,
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

      const result = (await response.json()) as OpenAiResponse;
      if (result.error?.message) throw new Error(result.error.message);

      const html = extractOutputText(result);
      if (!html) {
        const reason =
          result.incomplete_details?.reason ?? result.status ?? "unknown";
        throw new Error(`OpenAI returned no HTML output (status: ${reason}).`);
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

  throw lastError ?? new Error("OpenAI request failed after three attempts.");
}

function extractOutputText(result: OpenAiResponse): string {
  return (result.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text ?? "")
    .join("\n")
    .trim();
}

function normalizeHtml(output: string): string {
  const withoutFence = output
    .replace(/^```(?:html)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();

  if (
    !/<html[\s>]/iu.test(withoutFence) ||
    !/<body[\s>]/iu.test(withoutFence)
  ) {
    throw new Error("The model response was not a complete HTML document.");
  }

  return /^<!doctype html>/iu.test(withoutFence)
    ? withoutFence
    : `<!doctype html>\n${withoutFence}`;
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
