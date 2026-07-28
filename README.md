# md-reader

Chrome extension for reading local Markdown the way github.com renders it. Point it at a folder once; browse its `.md` files from the side panel; documents open in a full tab with GitHub styling — tables, task lists, syntax-highlighted code, `[!NOTE]`-style alerts, heading anchors, light and dark.

Local-only by design: files are read through the [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) and rendered in the extension. No server, no account, no file content leaves the machine. The only permission it asks for is `sidePanel`.

## Install

Not on the Web Store yet — load it unpacked:

1. Clone this repo
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the cloned folder
4. Click the md-reader toolbar icon → **Choose folder…**

Clicking a file in the tree opens it in a full tab (one tab, reused). The layout toggle in the panel header switches to reading inside the panel instead. After a Chrome restart, one click on **Reconnect** restores folder access — choose "Allow on every visit" in Chrome's prompt to skip even that.

## Features

- GitHub-parity rendering: GFM tables, task lists, strikethrough, autolinks, fenced code with highlight.js, all five `> [!NOTE]`/`[!TIP]`/`[!IMPORTANT]`/`[!WARNING]`/`[!CAUTION]` alerts, hover anchor links on headings
- File tree of `.md`/`.markdown` files (skips `.git` and `node_modules`), persisted expansion state, per-folder last-file memory
- Relative links navigate between documents; relative images resolve from the folder; external links open in a new tab
- Light/dark follows the system theme
- Freshness line: file size, mtime, and when it was last read from disk; files over 1 MB ask before rendering
- Rendered HTML is sanitized with DOMPurify; the extension requests no host permissions and runs no remote code

## Development

No `npm install` — dependencies are vendored and pinned (`vendor/LICENSES.md`); tests run on node built-ins plus your local Chrome.

```sh
npm test              # node:test — renderer + fs units against the vendored builds
npm run test:browser  # sanitizer/DOM tests in headless Chrome (tools/cdp.mjs, raw CDP)
npm run shots         # panel + reader screenshots into shots/
```

`panel.html?mock=1` and `reader.html?mock=1&path=README.md` serve packaged fixture data (marked with an amber MOCK badge) so screenshots and DOM tests are reproducible without picking a real folder. Design/architecture notes: `docs/01-concept-spec.md`.

## License

Apache-2.0 (see `LICENSE`). Vendored dependencies keep their own permissive licenses, inventoried in `vendor/LICENSES.md`.
