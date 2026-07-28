// Runs test/browser/harness.html in headless Chrome via CDP and reports
// pass/fail. Serves the repo over localhost so ES modules load.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launchChrome, serveStatic, waitFor } from './cdp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const server = await serveStatic(root);
const chrome = await launchChrome();
let failed = 0;
try {
  const page = await chrome.openPage(`http://127.0.0.1:${server.port}/test/browser/harness.html`);
  const { results } = await waitFor(page, 'globalThis.__results');
  for (const r of results) {
    console.log(`${r.ok ? '✔' : '✖'} ${r.name}${r.ok ? '' : `\n    ${r.err}`}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} browser tests passed`);
} finally {
  await chrome.close();
  server.close();
}
process.exit(failed ? 1 : 0);
