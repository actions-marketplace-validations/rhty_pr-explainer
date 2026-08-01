import { generateHtmlWithAnthropic } from "./anthropic";
import type { AiProvider } from "./config";
import { generateHtmlWithOpenAi } from "./openai";

export interface GenerateHtmlOptions {
  provider: AiProvider;
  apiKey: string;
  model: string;
  reasoningEffort: string;
  instructions: string;
  input: string;
  fetchImplementation?: typeof fetch;
}

export function generateHtml(options: GenerateHtmlOptions): Promise<string> {
  if (options.provider === "anthropic") {
    return generateHtmlWithAnthropic({
      apiKey: options.apiKey,
      model: options.model,
      instructions: options.instructions,
      input: options.input,
      fetchImplementation: options.fetchImplementation,
    });
  }

  return generateHtmlWithOpenAi({
    apiKey: options.apiKey,
    model: options.model,
    reasoningEffort: options.reasoningEffort,
    instructions: options.instructions,
    input: options.input,
    fetchImplementation: options.fetchImplementation,
  });
}
