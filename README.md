# md-reader-chrome

Chrome side-panel extension: point it at a local folder, browse its Markdown files, read them rendered GitHub-style. Local-only — no file content leaves the machine.

Design: `docs/01-concept-spec.md`.

## Install (unpacked)

`chrome://extensions` → Developer mode → Load unpacked → this folder. Click the toolbar icon to open the side panel, then Choose folder.

Clicking a file opens it in a full tab (the panel is the navigator). The layout toggle in the panel header switches to reading inside the panel instead.

## Development

No npm install needed — libs are vendored (`vendor/LICENSES.md`), tests run on node built-ins.

```sh
npm test              # node:test — renderer + fs units against the vendored builds
npm run test:browser  # sanitizer/DOM tests in headless Chrome (tools/cdp.mjs)
npm run shots         # panel + reader screenshots (mock fixture mode) into shots/
```

`panel.html?mock=1` / `reader.html?mock=1&path=README.md` render packaged fixture data (amber MOCK badge) for automated screenshots; real folders go through the File System Access API.
