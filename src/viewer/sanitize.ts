import createDOMPurify from "dompurify";

const MERMAID_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs";

export function prepareReportDocument(html: string): string {
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
  injectMermaid(documentNode);

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

function injectMermaid(documentNode: Document): void {
  if (!documentNode.querySelector(".mermaid")) return;

  const nonce = createNonce();
  const policy = documentNode.querySelector<HTMLMetaElement>(
    'meta[http-equiv="Content-Security-Policy"]',
  );
  if (policy) {
    policy.content = policy.content.replace(
      "script-src 'none'",
      `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    );
  }

  const script = documentNode.createElement("script");
  script.type = "module";
  script.setAttribute("nonce", nonce);
  script.textContent = `
    import mermaid from ${JSON.stringify(MERMAID_URL)};
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      maxTextSize: 50000,
      maxEdges: 500,
      theme: "default"
    });
    try {
      await mermaid.run({ nodes: document.querySelectorAll(".mermaid") });
    } catch (error) {
      console.warn("PR Explainer could not render a Mermaid diagram.", error);
    }
  `;
  documentNode.body.append(script);
}

function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
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
