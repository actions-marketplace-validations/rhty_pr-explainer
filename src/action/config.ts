const BCP_47_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u;
const REASONING_EFFORTS = new Set([
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const PERMISSION_LEVELS = [
  "none",
  "read",
  "triage",
  "write",
  "maintain",
  "admin",
] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export interface ActionConfig {
  githubToken: string;
  openAiApiKey: string;
  pullNumber?: number;
  language: string;
  model: string;
  reasoningEffort: string;
  viewerUrl: string;
  command: string;
  minimumPermission: PermissionLevel;
  maxDiffChars: number;
  maxUrlChars: number;
  customInstructions: string;
}

type InputGetter = (name: string, options?: { required?: boolean }) => string;

export function readActionConfig(getInput: InputGetter): ActionConfig {
  const pullNumberInput = getInput("pull-number").trim();
  const language = getInput("language").trim() || "auto";
  const reasoningEffort = getInput("reasoning-effort").trim() || "low";
  const minimumPermission = (getInput("minimum-permission").trim() ||
    "write") as PermissionLevel;

  if (language !== "auto" && !BCP_47_PATTERN.test(language)) {
    throw new Error(
      `Invalid language '${language}'. Use a BCP 47 tag such as ja, en, or zh-CN, or use auto.`,
    );
  }

  if (!REASONING_EFFORTS.has(reasoningEffort)) {
    throw new Error(
      `Invalid reasoning-effort '${reasoningEffort}'. Use none, low, medium, high, xhigh, or max.`,
    );
  }

  if (!PERMISSION_LEVELS.includes(minimumPermission)) {
    throw new Error(
      `Invalid minimum-permission '${minimumPermission}'. Use read, triage, write, maintain, or admin.`,
    );
  }

  return {
    githubToken: getInput("github-token", { required: true }),
    openAiApiKey: getInput("openai-api-key", { required: true }),
    pullNumber: pullNumberInput
      ? parseInteger(pullNumberInput, "pull-number", 1, Number.MAX_SAFE_INTEGER)
      : undefined,
    language,
    model: getInput("model").trim() || "gpt-5.6-terra",
    reasoningEffort,
    viewerUrl: validateViewerUrl(getInput("viewer-url").trim()),
    command: getInput("command").trim() || "/pr-explain",
    minimumPermission,
    maxDiffChars: parseInteger(
      getInput("max-diff-chars").trim() || "180000",
      "max-diff-chars",
      10_000,
      1_000_000,
    ),
    maxUrlChars: parseInteger(
      getInput("max-url-chars").trim() || "48000",
      "max-url-chars",
      4_000,
      64_000,
    ),
    customInstructions: getInput("custom-instructions").trim(),
  };
}

export function parseLanguageOverride(
  commentBody: string | undefined,
  command: string,
): string | undefined {
  if (!commentBody || !commentBody.trimStart().startsWith(command))
    return undefined;

  const match = commentBody.match(
    /(?:^|\s)--lang(?:=|\s+)([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\b/u,
  );
  return match?.[1];
}

export function resolveLanguage(
  configuredLanguage: string,
  commentBody: string | undefined,
  command: string,
  pullText: string,
): string {
  const override = parseLanguageOverride(commentBody, command);
  if (override) return normalizeLanguage(override);
  if (configuredLanguage !== "auto")
    return normalizeLanguage(configuredLanguage);

  if (/[ぁ-ゟ゠-ヿ]/u.test(pullText)) return "ja";
  if (/[가-힣]/u.test(pullText)) return "ko";
  if (/\p{Script=Han}/u.test(pullText)) return "zh-CN";
  return "en";
}

export function hasRequiredPermission(
  actual: PermissionLevel,
  minimum: PermissionLevel,
): boolean {
  return (
    PERMISSION_LEVELS.indexOf(actual) >= PERMISSION_LEVELS.indexOf(minimum)
  );
}

function normalizeLanguage(language: string): string {
  const [primary, ...rest] = language.split("-");
  if (!primary) return language;
  return [primary.toLowerCase(), ...rest].join("-");
}

function parseInteger(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
): number {
  if (!/^\d+$/u.test(value)) {
    throw new Error(`${name} must be an integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }

  return parsed;
}

function validateViewerUrl(value: string): string {
  const fallback = "https://rhty.github.io/pr-explainer/";
  const url = new URL(value || fallback);

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error(
      "viewer-url must use HTTPS (HTTP is allowed only for localhost). ",
    );
  }

  url.hash = "";
  url.search = "";
  return url.toString();
}
