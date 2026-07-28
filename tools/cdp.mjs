// Minimal Chrome DevTools Protocol client on node's built-in WebSocket —
// no npm dependencies (corp registry needs interactive auth; see docs).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

export const CHROME_BIN =
  process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.md': 'text/markdown',
  '.svg': 'image/svg+xml',
};

// Static file server rooted at `root`; resolves to { port, close }.
export function serveStatic(root) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://x');
        const path = join(root, decodeURIComponent(url.pathname));
        if (!path.startsWith(root)) throw new Error('traversal');
        const body = await readFile(path);
        res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () =>
      resolve({ port: server.address().port, close: () => server.close() })
    );
  });
}

class CDPConnection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.data || ''})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(fn) {
    this.listeners.push(fn);
  }
}

export async function launchChrome({ args = [] } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'md-reader-chrome-'));
  const proc = spawn(
    CHROME_BIN,
    [
      '--headless=new',
      '--disable-gpu',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      ...args,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(
      () => reject(new Error(`Chrome gave no DevTools endpoint in 15s:\n${buf}`)),
      15000
    );
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (${code}):\n${buf}`));
    });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP websocket failed')));
  });
  const cdp = new CDPConnection(ws);

  async function openPage(url, { width = 1200, height = 800, dark = false } = {}) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: false,
    });
    if (dark) {
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: 'dark' }],
      });
    }
    const loaded = new Promise((resolve) => {
      cdp.on((msg) => {
        if (msg.method === 'Page.loadEventFired' && msg.sessionId === sessionId) resolve();
      });
    });
    await send('Page.navigate', { url });
    await loaded;

    return {
      send,
      // Evaluate an expression; returns the value (awaits promises).
      async eval(expression) {
        const r = await send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
        if (r.exceptionDetails) {
          throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
        }
        return r.result.value;
      },
      async screenshot(path) {
        const { writeFile } = await import('node:fs/promises');
        const { data } = await send('Page.captureScreenshot', { format: 'png' });
        await writeFile(path, Buffer.from(data, 'base64'));
      },
      close: () => cdp.send('Target.closeTarget', { targetId }),
    };
  }

  return {
    cdp,
    openPage,
    async close() {
      try {
        ws.close();
        proc.kill();
      } finally {
        setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
      }
    },
  };
}

// Poll `page.eval(expr)` until it returns a truthy value or timeout.
export async function waitFor(page, expr, { timeoutMs = 10000, stepMs = 100 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const v = await page.eval(expr);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for: ${expr}`);
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
