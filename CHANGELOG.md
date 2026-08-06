# Changelog

## 0.2.4 - 2026-08-06

- Update version to v0.2.4.

## 0.2.1 - 2026-08-01

- Allow report-owned embedded CSS and HTTPS assets through the parent Viewer policy.
- Render pinned Mermaid diagrams from external, Viewer-owned scripts without enabling arbitrary
  report scripts.

## 0.2.0 - 2026-08-01

- Add Anthropic Messages API support with `provider: anthropic`.
- Add provider-neutral `api-key` and pass custom `model` IDs through unchanged.
- Select provider-specific default models while preserving the v0.1 `openai-api-key` input.
- Report the selected provider and model in Action outputs, summaries, and PR comments.

## 0.1.0 - 2026-08-01

- Generate interactive HTML explanations from GitHub pull-request metadata and patches.
- Support repository defaults and per-comment language overrides.
- Share compressed reports through a backendless URL-fragment format.
- Render sanitized reports in a sandboxed GitHub Pages Viewer.
- Support pinned Mermaid diagrams and external HTTPS images and stylesheets.
