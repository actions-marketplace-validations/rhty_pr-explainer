# Security

## Supported versions

Security fixes are applied to the latest release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting feature for this repository. Do not include
private pull-request data, API keys, or complete report URLs in a public issue.

## Trust model

- The Action reads pull-request metadata and patches through the GitHub API. It does not check out
  or execute code from the pull request.
- Pull-request data is sent directly to the selected OpenAI or Anthropic API using the caller's API
  key. OpenAI requests set `store: false`; Anthropic requests use the Messages API.
- The complete report is encoded in the URL fragment. Anyone who receives that complete URL can
  decode the report, so links for private pull requests must be treated as sensitive.
- Browsers do not send URL fragments in the HTTP request for the Viewer page. The Viewer has no
  analytics and no report storage backend.
- Model-generated scripts, event handlers, forms, frames, and active embeds are removed. Reports
  render inside an iframe without `allow-same-origin`.
- The Viewer may load report-specified HTTPS images and stylesheets. Those external hosts can
  observe the request. The Viewer applies `no-referrer`, but organizations may still choose to
  disallow external assets through a fork or custom Viewer URL.
- Mermaid is the only Viewer-owned report script. Its version is pinned and it runs with Mermaid's
  strict security setting inside the sandboxed report frame.

Pin third-party Actions to a full commit SHA when your organization requires immutable supply-chain
references.
