# Contributing

Issues and pull requests are welcome.

## Before opening a pull request

1. Install dependencies with `npm install`.
2. Make changes in `src/action`, `src/viewer`, or `src/shared`.
3. Add or update tests under `tests`.
4. Run `npm run format` and `npm run check`.
5. Commit the rebuilt `dist/action` bundle when Action source changes.

Do not include API keys, private repository content, or complete private report URLs in fixtures,
issues, logs, or pull requests.

Changes to the payload format must remain backward compatible or increment
`REPORT_PAYLOAD_VERSION` with a clear migration path for existing links.
