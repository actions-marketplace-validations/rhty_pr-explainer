import "./style.css";
import { encodeReport, decodeReport } from "./codec";
import { prepareReportDocument } from "./sanitize";
import { REPORT_PAYLOAD_VERSION, type ReportPayload } from "../shared/payload";

const MAX_LOCAL_HTML_BYTES = 250_000;
const elements = {
  shell: requiredElement<HTMLElement>("viewer-shell"),
  empty: requiredElement<HTMLElement>("empty-state"),
  error: requiredElement<HTMLElement>("error-state"),
  errorMessage: requiredElement<HTMLElement>("error-message"),
  report: requiredElement<HTMLElement>("report-state"),
  frame: requiredElement<HTMLIFrameElement>("report-frame"),
  title: requiredElement<HTMLElement>("report-title"),
  meta: requiredElement<HTMLElement>("report-meta"),
  openPull: requiredElement<HTMLAnchorElement>("open-pull"),
  copy: requiredElement<HTMLButtonElement>("copy-link"),
  download: requiredElement<HTMLButtonElement>("download-report"),
  fileInput: requiredElement<HTMLInputElement>("html-file"),
  dropZone: requiredElement<HTMLElement>("drop-zone"),
  retry: requiredElement<HTMLButtonElement>("retry"),
};

let currentDocument = "";
let currentPayload: ReportPayload | undefined;

elements.fileInput.addEventListener("change", () => {
  const file = elements.fileInput.files?.[0];
  if (file) void loadLocalHtml(file);
});
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.dataset.dragging = "true";
});
elements.dropZone.addEventListener("dragleave", () => {
  delete elements.dropZone.dataset.dragging;
});
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  delete elements.dropZone.dataset.dragging;
  const file = event.dataTransfer?.files[0];
  if (file) void loadLocalHtml(file);
});
elements.copy.addEventListener("click", () => void copyCurrentLink());
elements.download.addEventListener("click", downloadCurrentReport);
elements.retry.addEventListener("click", () => void renderFromLocation());
window.addEventListener("hashchange", () => void renderFromLocation());

void renderFromLocation();

async function renderFromLocation(): Promise<void> {
  const encoded = new URLSearchParams(location.hash.slice(1)).get("r");
  if (!encoded) {
    showState("empty");
    return;
  }

  showLoading();
  try {
    const payload = await decodeReport(encoded);
    renderPayload(payload);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

function renderPayload(payload: ReportPayload): void {
  currentPayload = payload;
  currentDocument = prepareReportDocument(payload.html);
  const strings = translations(payload.language);

  document.documentElement.lang = strings.language;
  document.title = `${payload.title} · PR Explainer`;
  elements.title.textContent = payload.title;
  elements.meta.textContent = formatMetadata(payload, strings.language);
  elements.copy.textContent = strings.copy;
  elements.download.textContent = strings.download;
  elements.openPull.textContent = strings.openPull;
  elements.openPull.hidden = !isGitHubUrl(payload.pullUrl);
  if (payload.pullUrl) elements.openPull.href = payload.pullUrl;
  elements.frame.title = strings.frameTitle;
  elements.frame.srcdoc = currentDocument;
  showState("report");
}

async function loadLocalHtml(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".html") && file.type !== "text/html") {
    showError("Choose an HTML file.");
    return;
  }
  if (file.size > MAX_LOCAL_HTML_BYTES) {
    showError("The HTML file must be 250 KB or smaller.");
    return;
  }

  try {
    const html = await file.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const payload: ReportPayload = {
      version: REPORT_PAYLOAD_VERSION,
      language: parsed.documentElement.lang || navigator.language || "en",
      title: parsed.title || file.name.replace(/\.html?$/iu, ""),
      createdAt: new Date().toISOString(),
      html,
    };
    const encoded = await encodeReport(payload);
    location.hash = `r=${encoded}`;
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    elements.fileInput.value = "";
  }
}

async function copyCurrentLink(): Promise<void> {
  const strings = translations(currentPayload?.language ?? "en");
  try {
    await navigator.clipboard.writeText(location.href);
    elements.copy.textContent = strings.copied;
    window.setTimeout(() => {
      elements.copy.textContent = strings.copy;
    }, 1_600);
  } catch {
    elements.copy.textContent = strings.copyFailed;
  }
}

function downloadCurrentReport(): void {
  if (!currentDocument || !currentPayload) return;
  const blobUrl = URL.createObjectURL(
    new Blob([currentDocument], { type: "text/html;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = `${slugify(currentPayload.title) || "pr-explanation"}.html`;
  anchor.click();
  URL.revokeObjectURL(blobUrl);
}

function showLoading(): void {
  elements.shell.dataset.loading = "true";
  elements.empty.hidden = true;
  elements.error.hidden = true;
  elements.report.hidden = true;
}

function showState(state: "empty" | "report"): void {
  delete elements.shell.dataset.loading;
  elements.empty.hidden = state !== "empty";
  elements.report.hidden = state !== "report";
  elements.error.hidden = true;
}

function showError(message: string): void {
  delete elements.shell.dataset.loading;
  elements.errorMessage.textContent = message;
  elements.empty.hidden = true;
  elements.report.hidden = true;
  elements.error.hidden = false;
}

function formatMetadata(payload: ReportPayload, locale: string): string {
  const pieces: string[] = [];
  if (payload.repository && payload.pullNumber) {
    pieces.push(`${payload.repository} #${payload.pullNumber}`);
  }
  const created = new Date(payload.createdAt);
  if (!Number.isNaN(created.valueOf())) {
    pieces.push(
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(created),
    );
  }
  return pieces.join(" · ");
}

function isGitHubUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).hostname === "github.com";
  } catch {
    return false;
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase()
    .slice(0, 80);
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}.`);
  return element as T;
}

function translations(language: string): {
  language: string;
  copy: string;
  copied: string;
  copyFailed: string;
  download: string;
  openPull: string;
  frameTitle: string;
} {
  if (language.toLowerCase().startsWith("ja")) {
    return {
      language: "ja",
      copy: "リンクをコピー",
      copied: "コピーしました",
      copyFailed: "コピーできませんでした",
      download: "HTMLを保存",
      openPull: "GitHubでPRを開く ↗",
      frameTitle: "PRのHTML解説",
    };
  }
  return {
    language: "en",
    copy: "Copy link",
    copied: "Copied",
    copyFailed: "Copy failed",
    download: "Save HTML",
    openPull: "Open PR on GitHub ↗",
    frameTitle: "Interactive pull request explanation",
  };
}
