# PR Explainer

Turn GitHub pull requests into interactive, AI-generated HTML explanations.

PR Explainer is a backendless GitHub Action and static Viewer for teams that want to understand a
change before reviewing every line. The Action reads a PR through the GitHub API, asks OpenAI or
Anthropic to produce a standalone HTML explanation, compresses the report into a URL fragment, and
posts the Viewer link back to the PR.

```text
/pr-explain
     ↓
GitHub Action → OpenAI / Anthropic → HTML → gzip + Base64URL
                                             ↓
                    GitHub Pages Viewer ← URL fragment
```

No PR report database, account, OAuth flow, or application backend is required.

## What you get

- A narrative overview of what changed and why it matters
- Diagrams, impact maps, review guides, and links to exact GitHub files and lines
- Responsive, printable HTML generated specifically for each pull request
- Japanese, English, or any BCP 47 output language
- A browser-only Viewer with sandboxing, sanitization, and pinned Mermaid support
- OpenAI and Anthropic support with a caller-selected model ID
- Bring your own provider API key, stored in the consuming repository's Actions secrets

## Install

### 1. Add a provider key

In the repository that will use PR Explainer, open **Settings → Secrets and variables → Actions**
and create a repository or organization secret such as `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

### 2. Add the workflow

Create `.github/workflows/pr-explainer.yml` in the consuming repository:

```yaml
name: PR Explainer

on:
  issue_comment:
    types: [created]

permissions:
  contents: read
  pull-requests: write

jobs:
  explain:
    if: >-
      github.event.issue.pull_request &&
      startsWith(github.event.comment.body, '/pr-explain')
    runs-on: ubuntu-latest

    steps:
      - name: Generate interactive PR explanation
        uses: rhty/pr-explainer@v0.2.0
        with:
          github-token: ${{ github.token }}
          provider: openai
          api-key: ${{ secrets.OPENAI_API_KEY }}
          language: auto
```

To use Claude instead, change the provider, secret, and optionally the model:

```yaml
with:
  github-token: ${{ github.token }}
  provider: anthropic
  api-key: ${{ secrets.ANTHROPIC_API_KEY }}
  model: claude-sonnet-5
  language: ja
```

`model` accepts a model ID supported by the selected provider and passes it through unchanged. For
example, set `gpt-5.6-sol` for OpenAI or `claude-opus-5` for Anthropic. When omitted, it defaults to
`gpt-5.6-terra` for OpenAI and `claude-sonnet-5` for Anthropic.

The workflow must exist on the consuming repository's default branch. Organizations that restrict
third-party Actions must also allow `rhty/pr-explainer`.

### 3. Generate a report

Leave a normal PR conversation comment:

```text
/pr-explain
```

Override the configured language for one report:

```text
/pr-explain --lang ja
/pr-explain --lang en
```

The Action updates its previous report comment instead of adding a new comment on every run.

## Configuration

| Input                 | Default            | Description                                            |
| --------------------- | ------------------ | ------------------------------------------------------ |
| `github-token`        | required           | Token used to read the PR and write its report comment |
| `api-key`             | required           | Caller-owned key for the selected provider             |
| `provider`            | `openai`           | `openai` or `anthropic`                                |
| `model`               | provider-dependent | Provider model ID, passed through unchanged            |
| `language`            | `auto`             | BCP 47 language such as `ja`, `en`, or `zh-CN`         |
| `reasoning-effort`    | `low`              | OpenAI-only reasoning effort                           |
| `viewer-url`          | hosted Viewer      | Custom static Viewer base URL                          |
| `command`             | `/pr-explain`      | Comment command recognized by the Action               |
| `minimum-permission`  | `write`            | Minimum permission required to spend the API key       |
| `max-diff-chars`      | `180000`           | Maximum patch characters sent to the model             |
| `max-url-chars`       | `48000`            | Maximum generated report URL length                    |
| `custom-instructions` | empty              | Additional report-generation guidance                  |
| `pull-number`         | inferred           | Explicit PR number for manual or custom workflows      |

`openai-api-key` remains available as a deprecated alias for `api-key` when `provider: openai`, so
existing v0.1 workflows continue to work. `reasoning-effort` is ignored by Anthropic.

The `auto` language mode looks at the PR title and body. A comment's `--lang` value always wins.
The generated document sets its own language, while the Viewer currently localizes its chrome in
Japanese and English.

## Privacy and security

PR Explainer intentionally uses a capability-link model:

- The Action runs in the consuming repository and never checks out or executes PR code.
- PR metadata and included patches are sent directly to the selected provider. OpenAI requests set
  `store: false`; Anthropic requests use the Messages API.
- The resulting HTML is compressed into the part of the URL after `#`. Browsers do not send that
  fragment when requesting the static Viewer page.
- There is no analytics endpoint or report storage service.
- Anyone with the complete URL can decode the report. Treat links for private repositories as
  sensitive.
- AI-authored scripts and active embeds are removed. The sanitized report runs in a sandboxed
  iframe without same-origin access.
- HTTPS images and stylesheets are allowed. Their hosts can observe that a resource was requested,
  although the Viewer applies a no-referrer policy.
- Mermaid diagrams use a Viewer-owned, pinned runtime with strict security settings. Reports only
  supply Mermaid source inside `<pre class="mermaid">`.

See [SECURITY.md](SECURITY.md) for the complete trust model and vulnerability reporting process.

## Limits

The default URL limit is 48,000 characters so the report and its surrounding GitHub comment remain
practical across common browsers and chat tools. Compression makes typical reports much smaller
than their source HTML, but extremely large reports fail rather than silently publishing a broken
link.

The Action includes up to 500 changed files, 30,000 patch characters per file, and 180,000 patch
characters overall by default. It tells both the model and the reader when input was truncated.

## Self-host the Viewer

The Viewer is a static Vite build. Fork this repository, publish `dist/viewer` on any HTTPS static
host, then configure the Action:

```yaml
with:
  viewer-url: https://reviews.example.com/
```

The same Viewer can open a local HTML file from its landing page and create a shareable URL entirely
in the browser.

## Development

Node.js 24 or later is required.

```bash
npm install
npm run dev
npm run check
```

`npm run build` produces:

- `dist/action/index.js` — committed JavaScript Action bundle
- `dist/viewer` — deployable static Viewer

The Action and Viewer share a versioned payload contract in `src/shared/payload.ts`.

## License

[MIT](LICENSE)

---

## 日本語

PR Explainerは、GitHubのPR差分をAIが読み解き、レビューしやすいインタラクティブなHTML
レポートに変換するGitHub Actionです。OpenAIまたはAnthropicと任意のモデル名を選択でき、
利用Repo側のAPIキーを使います。生成HTMLはURLのフラグメントに圧縮して載せるため、
レポート保存用のバックエンドはありません。

導入後、PRに `/pr-explain` または `/pr-explain --lang ja` とコメントすると、同じPRに
Viewerへのリンクが投稿されます。Private Repoでは、その完全なURL自体を機密情報として扱って
ください。
