import { idbGet, idbSet } from './lib/idb.js';
import { createRealSource, createMockSource } from './lib/source.js';
import { createRenderer } from './lib/render.js';
import { createViewer } from './lib/viewer.js';

const params = new URLSearchParams(location.search);
const IS_MOCK = params.get('mock') === '1';

const els = Object.fromEntries(
  ['crumb', 'mockBadge', 'refreshBtn', 'edge', 'readerWrap', 'content', 'status'].map((id) => [
    id,
    document.getElementById(id),
  ])
);

const renderer = createRenderer({
  markdownit: globalThis.markdownit,
  taskLists: globalThis.markdownitTaskLists,
  hljs: globalThis.hljs,
  DOMPurify: globalThis.DOMPurify,
});

let source = null;

const viewer = createViewer({
  renderer,
  contentEl: els.content,
  statusEl: els.status,
  onNavigate: (path, hash) => navigate(path, hash, { push: true }),
});

function showReady() {
  document.body.dataset.state = 'ready';
  els.edge.hidden = true;
  els.readerWrap.hidden = false;
  els.status.hidden = false;
  els.refreshBtn.disabled = false;
}

function showEdge(html, buttons = []) {
  document.body.dataset.state = 'edge';
  els.edge.innerHTML = html;
  for (const { label, onClick, secondary } of buttons) {
    const btn = document.createElement('button');
    btn.className = secondary ? 'btn secondary' : 'btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    els.edge.appendChild(btn);
  }
  els.edge.hidden = false;
  els.readerWrap.hidden = true;
  els.status.hidden = true;
  els.refreshBtn.disabled = true;
}

function setCrumb(path) {
  els.crumb.innerHTML = '';
  const segs = [source.name, ...path.split('/')];
  segs.forEach((seg, i) => {
    if (i) {
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      els.crumb.appendChild(sep);
    }
    els.crumb.appendChild(document.createTextNode(seg));
  });
  document.title = `${path.split('/').pop()} · md-reader`;
}

async function openFile(path, hash) {
  try {
    await viewer.open(path, { hash });
    showReady();
    setCrumb(path);
    if (IS_MOCK) els.mockBadge.hidden = false; // badge only when mock content is on screen
  } catch (err) {
    showEdge(
      `<h2>Could not read file</h2>
       <p>${path}: ${err?.name === 'NotFoundError' ? 'not found in the folder (moved or deleted?)' : err?.message || err}</p>`
    );
  }
}

function navigate(path, hash = '', { push = false } = {}) {
  if (push) {
    const url = new URL(location.href);
    url.searchParams.set('path', path);
    url.hash = hash;
    history.pushState({ path, hash }, '', url);
  }
  openFile(path, hash);
}

window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search).get('path');
  if (p) openFile(p, location.hash.slice(1));
});

els.refreshBtn.addEventListener('click', () => viewer.refresh());

const NO_FILE_HTML = `<svg class="blank-icon" viewBox="0 0 16 16" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg>
  <h2>No file specified</h2>
  <p>Open the md-reader side panel (click the toolbar icon) and pick a file — the ⧉ button reopens it here.</p>`;

// Folder picking happens here, in a full tab — showDirectoryPicker from side
// panels/popups can return AbortError even when a directory was selected
// (crbug 40240444, WICG/file-system-access#314). Tab context is reliable.
async function pickFlow() {
  const start = () =>
    showEdge(
      `<svg class="blank-icon" viewBox="0 0 16 16" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2A1.75 1.75 0 0 0 5 1H1.75Z"/></svg>
       <h2>Choose a folder for md-reader</h2>
       <p>Its Markdown files will be listed in the side panel. Read directly from disk — nothing leaves this machine.</p>`,
      [{ label: 'Choose folder…', onClick: doPick }]
    );

  async function doPick() {
    let handle;
    try {
      handle = await window.showDirectoryPicker({ id: 'md-reader', mode: 'read' });
    } catch (err) {
      if (err?.name === 'AbortError') {
        showEdge(
          `<h2>No folder selected</h2>
           <p>The picker closed without granting access. If you did select a folder, Chrome refused it — check for a permission bubble near the address bar, then try again.</p>`,
          [{ label: 'Try again', onClick: doPick }]
        );
      } else {
        showEdge(
          `<h2>Folder picker failed</h2><p>${err?.name || 'Error'}: ${err?.message || err}</p>`,
          [{ label: 'Try again', onClick: doPick }]
        );
      }
      return;
    }
    await idbSet('root', handle);
    new BroadcastChannel('md-reader').postMessage({ type: 'folder-picked', name: handle.name });
    showEdge(`<h2>Connected to “${handle.name}”</h2><p>The side panel is loading it. This tab will close.</p>`);
    setTimeout(async () => {
      try {
        const tab = await chrome.tabs.getCurrent();
        if (tab?.id != null) chrome.tabs.remove(tab.id);
      } catch {
        /* not a tab or no chrome.tabs — leave the confirmation on screen */
      }
    }, 1200);
  }

  start();
}

async function boot() {
  els.crumb.textContent = 'md-reader';
  if (params.get('pick') === '1') return pickFlow();
  const path = params.get('path');
  if (IS_MOCK) {
    source = await createMockSource();
    viewer.setSource(source);
    if (path) return openFile(path, location.hash.slice(1));
    return showEdge(NO_FILE_HTML);
  }

  const handle = await idbGet('root');
  if (!handle) {
    showEdge('<h2>No folder connected</h2><p>Open the md-reader side panel and choose a folder first.</p>');
    return;
  }
  const perm = await handle.queryPermission({ mode: 'read' });
  if (perm !== 'granted') {
    showEdge(
      `<h2>Reconnect “${handle.name}”</h2>
       <p>Chrome needs a click to re-allow access.</p>`,
      [
        {
          label: `Reconnect ${handle.name}`,
          onClick: async () => {
            const p = await handle.requestPermission({ mode: 'read' });
            if (p === 'granted') {
              source = createRealSource(handle);
              viewer.setSource(source);
              if (path) openFile(path, location.hash.slice(1));
            }
          },
        },
      ]
    );
    return;
  }
  source = createRealSource(handle);
  viewer.setSource(source);
  if (path) return openFile(path, location.hash.slice(1));
  showEdge(NO_FILE_HTML);
}

boot();
