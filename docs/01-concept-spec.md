# 01 — md-reader: GitHub-style local Markdown reader (Chrome extension)

Status: **implemented** (v1 merged 2026-07-28) · Combined concept + spec + implementation plan (small feature, one doc).

## Problem

Reading local `.md` files in a git working folder means either a terminal pager, an editor, or pushing to GitHub. Wanted: point at a folder once, browse its files in a Chrome side panel, read any Markdown file rendered the way github.com renders it.

## Thesis

A Manifest V3 extension using `chrome.sidePanel` (file browser + reader) and the File System Access API (`showDirectoryPicker`). No server, no native host, no file content leaves the machine. Rendering is local: markdown-it + github-markdown-css.

## Research log

- ✅ VERIFIED (2026-07-28) `chrome.sidePanel` is stable (Chrome 114+); side panel pages are extension pages with full API access. Source: [chrome.sidePanel docs](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).
- ❌ SUPERSEDED (2026-07-29) ~~`showDirectoryPicker()` works from extension pages/side panels; unreliable only from popups~~ — user hit the extension-context picker bug from the side panel: dialog opens, a directory is selected, Chrome still returns `AbortError` (indistinguishable from a cancel). Sources: [WICG/file-system-access#314](https://github.com/WICG/file-system-access/issues/314), [crbug 40240444](https://issues.chromium.org/issues/40240444). Superseded by:
- 📚 SOURCED (2026-07-29) The reliable picker context for extensions is a **full tab**. → All folder picking runs in `reader.html?pick=1`; the pick tab stores the handle in IndexedDB, notifies the panel over `BroadcastChannel('md-reader')`, and closes itself.
- 📚 SOURCED (2026-07-29) Drag-and-drop is a second grant path: `DataTransferItem.getAsFileSystemHandle()` yields a directory handle with read permission, no picker dialog. Added after managed-Chrome content-analysis scans hung the picker flow (org policy refresh 2026-07-28; a `chrome://restart` cleared it once, then it recurred). → Both the pick page and the panel accept a dropped folder (`lib/drop.js`); the picker remains the fallback. Drop-path scan behavior under the org connector: 🤔 ASSUMPTION until user-tested.
- 📚 SOURCED `FileSystemDirectoryHandle` is structured-cloneable → persist in **IndexedDB** (not `chrome.storage`). Restored handles report permission `'prompt'`; `requestPermission()` needs a user gesture. Chrome's persistent-permissions prompt offers "Allow on every visit" → zero re-prompts thereafter. Source: [Persistent permissions blog](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api). → UX: a one-click "Reconnect <folder>" button when state is `'prompt'`.
- 📚 SOURCED Clearing browsing data wipes stored handles → graceful "pick a folder" empty state, never an error.
- 🤔 ASSUMPTION GitHub-parity rendering needs: GFM tables, task lists, strikethrough, autolinks, fenced code + syntax highlight, `> [!NOTE]`-style alerts, anchor links on headings. Footnotes/mermaid/math deferred to v2.

## Brand

Basis: **match a reference product — GitHub** (user-specified). `github-markdown-css` for the document body (auto light/dark via `prefers-color-scheme`); chrome around it uses the same GitHub palette + system font stack. Signature moment: on file open, the document fades/slides in and the active tree row carries a GitHub-blue accent bar. `prefers-reduced-motion` honored.

## Design

```
Wireframe proposal — not a real screenshot
┌───────────────────────────────┐
│ ▤ md-reader   my-repo ⌄   ⧉ ↻ │  header: folder name (click = switch), open-in-tab, refresh
├───────────────────────────────┤
│ ▸ docs/                       │  collapsible tree strip (only .md + dirs
│ ▾ src/            (12 files)  │  containing .md); persisted expansion
│    notes.md                   │
│  ● README.md                  │  ● = open file, blue accent bar
├───────────────────────────────┤
│ # My Project                  │
│ Rendered GitHub-style body    │  reader pane: github-markdown-css,
│ - [x] task list               │  highlighted code, heading anchors
│ ```code```                    │
│                               │
├───────────────────────────────┤
│ README.md · 4.1 KB · read 2s ago  │ freshness line              
└───────────────────────────────┘
```

Layout — two read modes, toggled by a header button, persisted (changed 2026-07-28 on user feedback after first real use):
- **Tab mode (default):** the panel is a tree-only navigator; clicking a file opens/reuses one reader tab (`reader.html?path=`) so the document fills the main window. The panel never spawns a tab on its own — only on click.
- **Panel mode:** tree and reader stacked in the side panel as originally wireframed, with back/forward buttons.
`⧉` explicitly opens the current file in the reader tab from either mode — same renderer everywhere, no divergence.

Interactions: click file → render; relative `.md` links navigate within the reader (history back/forward); relative images resolved through the directory handle to blob URLs; external links open in a new tab. Refresh re-reads from disk; the freshness line always shows file mtime + when it was read.

Edge states (first-class): no folder picked (CTA), permission `'prompt'` (Reconnect button), folder deleted/moved (explain + re-pick), empty folder (no `.md` found), file >1 MB (confirm before render), binary/non-md file (not listed), folder scan in progress (live entry count + current path — scans are disk-speed-bound and cloud-synced folders can stall), folder-picker failure (error shown with retry, never silent).

## Spec

**Manifest (MV3):** `side_panel.default_path`, `action` (click → open panel), permissions: `sidePanel` only. No host permissions, no content scripts, no remote code. All libs vendored.

**Components:**
- `panel.html/js` — tree + reader, folder lifecycle (restore → query/requestPermission; picking delegated to the pick tab, result received via BroadcastChannel).
- `reader.html/js` — full-tab reader, `?path=` param, same modules; also the folder-pick page (`?pick=1`, see research log).
- `lib/fs.js` — directory walk (`.md`, `.markdown`; skips `.git`, `node_modules`), file read, mtime.
- `lib/render.js` — markdown-it pipeline → DOMPurify sanitize → inject; heading anchors; link/image rewriting.

**Dependencies (all permissive; inventory in `vendor/LICENSES.md`):**

| lib | purpose | license |
|---|---|---|
| markdown-it (+ task-lists, github-alerts plugins) | GFM parse | MIT |
| github-markdown-css | GitHub body styling | MIT |
| highlight.js (common-languages build) | code blocks | BSD-3-Clause |
| DOMPurify | sanitize rendered HTML | Apache-2.0 (dual w/ MPL; we take Apache-2.0) |

No bundler: vendored minified builds in `vendor/` + a `vendor/LICENSES.md` inventory.

**Security posture:** rendered HTML is sanitized (raw HTML in md stripped to a safe subset); extension page CSP disallows remote script; file content never leaves the machine (contrast: `grip` sends content to GitHub's API).

**Test plan** *(changed from the signed-off draft: vitest/npm devDeps dropped — the npm registry here needs interactive auth, and testing the vendored UMD builds directly is stronger anyway; tooling is zero-dependency CDP on node's built-in WebSocket)*:
- Unit (`npm test`, node:test): render pipeline against the **vendored builds** via `createRequire` (tables, task lists, all five alerts, code highlighting, heading anchors/slugger, relative links); `fs.js` resolvePath/skip-list/walk. Sanitizer assertions are excluded here — DOMPurify needs a real DOM.
- Browser (`npm run test:browser`, headless Chrome via `tools/cdp.mjs`): real vendored DOMPurify — strips `<script>`/handlers/`javascript:` hrefs, keeps checkboxes/octicons/heading ids, full README fixture renders.
- Screenshots (`npm run shots`): panel + reader, light/dark + edge states, from `?mock=1` fixture mode (amber MOCK badge) served over localhost; design-critique loop on the shots.
- Real-run (manual — folder picking can't be automated): load unpacked, pick this repo's folder, restart Chrome → one-click reconnect, deny permission / delete folder mid-session.

**Renderer notes:** heading ids carry GitHub's `user-content-` prefix — GitHub parity, and DOMPurify's DOM-clobbering protection strips bare ids like `title`. Anchor `href`s stay unprefixed; the viewer resolves both.

## Implementation plan

1. **Skeleton + folder lifecycle** — manifest, side panel opens, pick/persist/reconnect folder, tree lists `.md` files. ✓ = restart Chrome, one click restores the tree.
2. **Renderer** — markdown-it pipeline + sanitize + github-markdown-css, unit tests green. ✓ = fixture file renders visually to par with github.com side-by-side screenshot.
3. **Reader UX** — relative link/image navigation, history, full-tab reader, freshness line, edge states. ✓ = each edge state screenshotted.
4. **Polish + review gate** — motion, dark mode, design critique loop, drift audit vs this doc.

Deferred (tracked here, not built): mermaid, math, footnotes, multi-folder workspaces, search, file watching (FS Access API has no change events — refresh is manual in v1).
