// Screenshots panel + reader in mock mode (light/dark) plus edge states,
// into shots/. Served over localhost — same files the extension packages;
// the real side-panel + folder-pick flow is verified manually in Chrome.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launchChrome, serveStatic, waitFor } from './cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'shots'), { recursive: true });

const PANEL = { width: 360, height: 800 };
const TAB = { width: 1280, height: 900 };
const RENDERED = `!!document.querySelector('#content h1')`;
const EDGE = `!!document.querySelector('#edge h2') && !document.getElementById('edge').hidden`;

const server = await serveStatic(root);
const chrome = await launchChrome();
const base = `http://127.0.0.1:${server.port}`;

async function shot(name, url, size, { dark = false, ready = RENDERED, action = null } = {}) {
  const page = await chrome.openPage(`${base}/${url}`, { ...size, dark });
  await waitFor(page, ready);
  if (action) {
    await page.eval(action);
    await new Promise((r) => setTimeout(r, 300));
  }
  await new Promise((r) => setTimeout(r, 250)); // let images/motion settle
  await page.screenshot(join(root, 'shots', `${name}.png`));
  await page.close();
  console.log(`shot: shots/${name}.png`);
}

const TREE = `!!document.querySelector('.tree-row.file')`;

try {
  await shot('panel-light', 'panel.html?mock=1&read=panel', PANEL);
  await shot('panel-dark', 'panel.html?mock=1&read=panel', PANEL, { dark: true });
  await shot('panel-tabmode', 'panel.html?mock=1', PANEL, { ready: TREE });
  await shot('panel-welcome', 'panel.html', PANEL, { ready: EDGE });
  await shot('panel-guide', 'panel.html?mock=1&read=panel', PANEL, {
    action: `document.querySelector('.tree-row.dir').click(),
             document.querySelector('.tree-row.file[data-path="docs/guide.md"]')?.click()`,
  });
  await shot('reader-light', 'reader.html?mock=1&path=README.md', TAB);
  await shot('reader-dark', 'reader.html?mock=1&path=README.md', TAB, { dark: true });
  await shot('reader-nofile', 'reader.html?mock=1', TAB, { ready: EDGE });
} finally {
  await chrome.close();
  server.close();
}
process.exit(0); // keep-alive sockets would otherwise hold the loop open
