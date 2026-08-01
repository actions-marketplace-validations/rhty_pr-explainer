import createDOMPurify from "dompurify";

const MERMAID_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js";

export function prepareReportDocument(
  html: string,
  mermaidRunnerUrl = "https://rhty.github.io/pr-explainer/mermaid-runner.js",
): string {
  const purifier = createDOMPurify(window);
  const sanitized = purifier.sanitize(html, {
    WHOLE_DOCUMENT: true,
    ADD_TAGS: ["link"],
    ADD_ATTR: ["rel", "target", "referrerpolicy"],
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "textarea",
      "select",
      "option",
      "base",
    ],
    FORBID_ATTR: ["srcdoc", "nonce"],
  });
  const documentNode = new DOMParser().parseFromString(sanitized, "text/html");

  hardenElements(documentNode);
  injectSecurityPolicy(documentNode);
  injectMermaid(documentNode, mermaidRunnerUrl);

  return `<!doctype html>\n${documentNode.documentElement.outerHTML}`;
}

function hardenElements(documentNode: Document): void {
  documentNode
    .querySelectorAll(
      "script, iframe, object, embed, form, input, button, textarea, select, option, base",
    )
    .forEach((element) => element.remove());
  documentNode
    .querySelectorAll('meta[http-equiv], meta[name="referrer"]')
    .forEach((element) => element.remove());

  for (const link of documentNode.querySelectorAll<HTMLLinkElement>("link")) {
    if (link.rel.toLowerCase() !== "stylesheet" || !isHttpsUrl(link.href)) {
      link.remove();
      continue;
    }
    link.referrerPolicy = "no-referrer";
  }

  for (const anchor of documentNode.querySelectorAll<HTMLAnchorElement>(
    "a[href]",
  )) {
    const rawHref = anchor.getAttribute("href") ?? "";
    if (!isSafeLink(rawHref)) {
      anchor.removeAttribute("href");
      continue;
    }
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.referrerPolicy = "no-referrer";
  }

  for (const image of documentNode.querySelectorAll<HTMLImageElement>(
    "img[src]",
  )) {
    const rawSource = image.getAttribute("src") ?? "";
    if (!isHttpsUrl(rawSource) && !isImageDataUrl(rawSource)) {
      image.removeAttribute("src");
      continue;
    }
    image.referrerPolicy = "no-referrer";
    image.loading = "lazy";
    image.decoding = "async";
  }

  for (const media of documentNode.querySelectorAll<HTMLMediaElement>(
    "audio[src], video[src], source[src]",
  )) {
    const rawSource = media.getAttribute("src") ?? "";
    if (!isHttpsUrl(rawSource)) media.removeAttribute("src");
  }
}

function injectSecurityPolicy(documentNode: Document): void {
  const referrer = documentNode.createElement("meta");
  referrer.name = "referrer";
  referrer.content = "no-referrer";

  const policy = documentNode.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = [
    "default-src 'none'",
    "img-src https: data: blob:",
    "media-src https: data: blob:",
    "style-src 'unsafe-inline' https:",
    "font-src https: data:",
    "script-src 'none'",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  documentNode.head.prepend(policy, referrer);
}

function injectMermaid(documentNode: Document, mermaidRunnerUrl: string): void {
  if (!documentNode.querySelector(".mermaid")) return;
  if (!isHttpsUrl(mermaidRunnerUrl) && !isLocalhostUrl(mermaidRunnerUrl)) {
    return;
  }

  const policy = documentNode.querySelector<HTMLMetaElement>(
    'meta[http-equiv="Content-Security-Policy"]',
  );
  if (policy) {
    const scriptSources = [MERMAID_URL, mermaidRunnerUrl]
      .map((value) => new URL(value).origin)
      .join(" ");
    policy.content = policy.content.replace(
      "script-src 'none'",
      `script-src ${scriptSources}`,
    );
  }

  const mermaid = documentNode.createElement("script");
  mermaid.src = MERMAID_URL;
  mermaid.defer = true;
  const runner = documentNode.createElement("script");
  runner.src = mermaidRunnerUrl;
  runner.defer = true;
  documentNode.body.append(mermaid, runner);
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "localhost";
  } catch {
    return false;
  }
}

function isSafeLink(value: string): boolean {
  if (value.startsWith("#")) return true;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "mailto:";
  } catch {
    return false;
  }
}

function isImageDataUrl(value: string): boolean {
  return /^data:image\/(?:png|gif|jpe?g|webp|avif);base64,/iu.test(value);
}
