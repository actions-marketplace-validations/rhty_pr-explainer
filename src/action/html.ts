export function normalizeHtml(output: string): string {
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
