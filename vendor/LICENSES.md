# Vendored dependencies

All permissive. Versions pinned; re-download from the URLs below to upgrade.

| file | package | version | license | source |
|---|---|---|---|---|
| markdown-it.min.js | markdown-it | 14.1.0 | MIT | https://cdn.jsdelivr.net/npm/markdown-it@14.1.0/dist/markdown-it.min.js |
| markdown-it-task-lists.min.js | markdown-it-task-lists | 2.1.1 | ISC | https://cdn.jsdelivr.net/npm/markdown-it-task-lists@2.1.1/dist/markdown-it-task-lists.min.js |
| github-markdown.css | github-markdown-css | 5.8.1 | MIT | https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown.css |
| highlight.min.js | highlight.js | 11.11.1 | BSD-3-Clause | https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js |
| hljs-github.min.css / hljs-github-dark.min.css | highlight.js styles | 11.11.1 | BSD-3-Clause | same release |
| purify.min.js | dompurify | 3.2.6 | Apache-2.0 (dual-licensed MPL-2.0 OR Apache-2.0; used under Apache-2.0) | https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js |

Inlined SVG path data (no library dependency):

- Octicons (`link`, `info`, `light-bulb`, `report`, `alert`, `stop`, `file`, `file-directory-fill`, `chevron-left/right`, `link-external`, `sync`) in `lib/render.js`, `panel.js`, `panel.html`, `reader.html`/`reader.js` — MIT (github/octicons).
- Markdown mark (extension icon, `tools/icon.html`) — hand-drawn variant; the reference mark is dual-licensed CC0-1.0 / OWFa-1.0 (dcurtis/markdown-mark).

`vendor/package.json` (`{"type":"commonjs"}`) is ours — it lets node tests `require()` these UMD builds directly, so tests run against the exact bytes that ship.
