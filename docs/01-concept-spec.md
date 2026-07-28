# 01 — md-reader: GitHub-style local Markdown reader (Chrome extension)

Status: **proposed — awaiting sign-off** · Tier 2 · Combined concept + spec + implementation plan (small feature, one doc).

## Problem

Reading local `.md` files in a git working folder means either a terminal pager, an editor, or pushing to GitHub. Wanted: point at a folder once, browse its files in a Chrome side panel, read any Markdown file rendered the way github.com renders it.

## Thesis

A Manifest V3 extension using `chrome.sidePanel` (file browser + reader) and the File System Access API (`showDirectoryPicker`). No server, no native host, no file content leaves the machine. Rendering is local: markdown-it + github-markdown-css.

## Research log

- ✅ VERIFIED (2026-07-28) `chrome.sidePanel` is stable (Chrome 114+); side panel pages are extension pages with full API access. Source: [chrome.sidePanel docs](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).
- 📚 SOURCED `showDirectoryPicker()` works from extension pages/side panels; it is unreliable from **popups** (dialog focus steals close the popup). Sources: [WICG/file-system-access#314](https://github.com/WICG/file-system-access/issues/314), [crbug 40240444](https://issues.chromium.org/issues/40240444). → Folder picking happens in the side panel, never a popup.
- 📚 SOURCED `FileSystemDirectoryHandle` is structured-cloneable → persist in **IndexedDB** (not `chrome.storage`). Restored handles report permission `'prompt'`; `requestPermission()` needs a user gesture. Chrome's persistent-permissions prompt offers "Allow on every visit" → zero re-prompts thereafter. Source: [Persistent permissions blog](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api). → UX: a one-click "Reconnect <folder>" button when state is `'prompt'`.
- 📚 SOURCED Clearing browsing data wipes stored handles → graceful "pick a folder" empty state, never an error.
- 🤔 ASSUMPTION GitHub-parity rendering needs: GFM tables, task lists, strikethrough, autolinks, fenced code + syntax highlight, `> [!NOTE]`-style alerts, anchor links on headings. Footnotes/mermaid/math deferred to v2.

## Brand (§3.5)

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
│ README.md · 4.1 KB · read 2s ago  │ freshness line (§0.1)
└───────────────────────────────┘
```

Layout: tree and reader stacked in the side panel (panel is user-resizable); `⧉` opens the same rendered file in a full tab (`reader.html`) for wide reading — same renderer, no divergence.

Interactions: click file → render; relative `.md` links navigate within the reader (history back/forward); relative images resolved through the directory handle to blob URLs; external links open in a new tab. Refresh re-reads from disk; the freshness line always shows file mtime + when it was read.

Edge states (first-class): no folder picked (CTA), permission `'prompt'` (Reconnect button), folder deleted/moved (explain + re-pick), empty folder (no `.md` found), file >1 MB (confirm before render), binary/non-md file (not listed).

## Spec

**Manifest (MV3):** `side_panel.default_path`, `action` (click → open panel), permissions: `sidePanel` only. No host permissions, no content scripts, no remote code. All libs vendored.

**Components:**
- `panel.html/js` — tree + reader, folder lifecycle (pick → store handle in IndexedDB via ~30-line helper → restore → query/requestPermission).
- `reader.html/js` — full-tab reader, `?path=` param, same modules.
- `lib/fs.js` — directory walk (`.md`, `.markdown`; skips `.git`, `node_modules`), file read, mtime.
- `lib/render.js` — markdown-it pipeline → DOMPurify sanitize → inject; heading anchors; link/image rewriting.

**Dependencies (licenses recorded per §6.5 — all permissive):**

| lib | purpose | license |
|---|---|---|
| markdown-it (+ task-lists, github-alerts plugins) | GFM parse | MIT |
| github-markdown-css | GitHub body styling | MIT |
| highlight.js (common-languages build) | code blocks | BSD-3-Clause |
| DOMPurify | sanitize rendered HTML | Apache-2.0 (dual w/ MPL; we take Apache-2.0) |

No bundler: vendored minified builds in `vendor/` + a `vendor/LICENSES.md` inventory.

**Security posture:** rendered HTML is sanitized (raw HTML in md stripped to a safe subset); extension page CSP disallows remote script; file content never leaves the machine (contrast: `grip` sends content to GitHub's API).

**Test plan (§5):**
- Unit (node, vitest — MIT): render pipeline against a fixture set of GFM features (tables, task lists, alerts, code, relative links/images); sanitizer strips `<script>`/event handlers; fs walk skip-list.
- Real-run (§5.7): load unpacked, pick this repo's folder, screenshot side panel + full tab in light and dark, drive edge states (deny permission, delete folder mid-session), design critique on the screenshots, fix, re-shoot.

## Implementation plan

1. **Skeleton + folder lifecycle** — manifest, side panel opens, pick/persist/reconnect folder, tree lists `.md` files. ✓ = restart Chrome, one click restores the tree.
2. **Renderer** — markdown-it pipeline + sanitize + github-markdown-css, unit tests green. ✓ = fixture file renders visually to par with github.com side-by-side screenshot.
3. **Reader UX** — relative link/image navigation, history, full-tab reader, freshness line, edge states. ✓ = each edge state screenshotted.
4. **Polish + §5.6/§5.7 gate** — motion, dark mode, design critique loop, drift audit vs this doc.

Deferred (tracked here, not built): mermaid, math, footnotes, multi-folder workspaces, search, file watching (FS Access API has no change events — refresh is manual in v1).
