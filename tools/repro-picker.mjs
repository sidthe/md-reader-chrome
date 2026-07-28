// Repro harness for the folder-picker hang: loads the extension in a real
// headed Chrome, opens panel.html, and calls showDirectoryPicker with and
// without a user gesture, reporting how the promise settles.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const profile = mkdtempSync(join(tmpdir(), 'md-reader-repro-'));

const proc = spawn(
  CHROME,
  [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    `--load-extension=${root}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=900,700',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] }
);

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const t = setTimeout(() => reject(new Error('no devtools endpoint: ' + buf)), 15000);
  proc.stderr.on('data', (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 1;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id: id++, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

// find the extension id from its targets
let extId = null;
for (let i = 0; i < 20 && !extId; i++) {
  const { targetInfos } = await send('Target.getTargets');
  const t = targetInfos.find((t) => t.url.startsWith('chrome-extension://'));
  if (t) extId = new URL(t.url).host;
  else await new Promise((r) => setTimeout(r, 250));
}
console.log('extension id:', extId || 'NOT FOUND');

const { targetId } = await send('Target.createTarget', { url: `chrome-extension://${extId}/panel.html` });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
const ev = (expression, userGesture) =>
  send('Runtime.evaluate', { expression, returnByValue: true, userGesture }, sessionId);
await new Promise((r) => setTimeout(r, 800));

// 1. no gesture — expect immediate SecurityError
await ev(`globalThis.__p1 = 'pending'; showDirectoryPicker({mode:'read'}).then(h => __p1 = 'ok:' + h.name, e => __p1 = 'err:' + e.name + ': ' + e.message)`, false);
await new Promise((r) => setTimeout(r, 500));
console.log('no-gesture   :', (await ev('__p1', false)).result.value);

// 2. with CDP user gesture — does the dialog appear / how does it settle?
await ev(`globalThis.__p2 = 'pending'; showDirectoryPicker({mode:'read'}).then(h => __p2 = 'ok:' + h.name, e => __p2 = 'err:' + e.name + ': ' + e.message)`, true);
for (let i = 0; i < 16; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const v = (await ev('__p2', false)).result.value;
  if (v !== 'pending') { console.log('with-gesture :', v, `(after ${(i + 1) * 0.5}s)`); break; }
  if (i === 15) console.log('with-gesture : still pending after 8s — a native dialog is (or should be) on screen');
}

// 3. second call while first may be active — the "already active" signal
await ev(`globalThis.__p3 = 'pending'; showDirectoryPicker({mode:'read'}).then(h => __p3 = 'ok:' + h.name, e => __p3 = 'err:' + e.name + ': ' + e.message)`, true);
await new Promise((r) => setTimeout(r, 700));
console.log('second-call  :', (await ev('__p3', false)).result.value);

proc.kill();
setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
process.exit(0);
