import { idbGet, idbSet } from './lib/idb.js';
import { createRealSource, createMockSource } from './lib/source.js';
import { createRenderer } from './lib/render.js';
import { createViewer } from './lib/viewer.js';

const PARAMS = new URLSearchParams(location.search);
const IS_MOCK = PARAMS.get('mock') === '1';

const els = Object.fromEntries(
  ['folderBtn', 'mockBadge', 'modeBtn', 'backBtn', 'fwdBtn', 'tabBtn', 'refreshBtn', 'edge', 'tree', 'readerWrap', 'content', 'status'].map(
    (id) => [id, document.getElementById(id)]
  )
);

const renderer = createRenderer({
  markdownit: globalThis.markdownit,
  taskLists: globalThis.markdownitTaskLists,
  hljs: globalThis.hljs,
  DOMPurify: globalThis.DOMPurify,
});

let source = null;
let tree = null;
let activePath = null;
const backStack = [];
const fwdStack = [];

/* ---------- read mode: files open in a full tab (default) or inline ---------- */

const READ_MODE_KEY = 'mdreader.readmode';
// ?read= overrides without persisting (used by the screenshot harness).
let readMode = PARAMS.get('read') || localStorage.getItem(READ_MODE_KEY) || 'tab';
let readerTabId = Number(sessionStorage.getItem('mdreader.readertab')) || null;

const MODE_ICONS = {
  tab: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M1.75 5.75h12.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  panel: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.25 2.75v10.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
};

function applyReadMode() {
  document.body.classList.toggle('mode-tab', readMode === 'tab');
  els.modeBtn.innerHTML = MODE_ICONS[readMode] || MODE_ICONS.tab;
  els.modeBtn.title =
    readMode === 'tab'
      ? 'Files open in a tab — click to read inside the panel'
      : 'Files render inside the panel — click to open in a tab instead';
}

els.modeBtn.addEventListener('click', () => {
  readMode = readMode === 'tab' ? 'panel' : 'tab';
  localStorage.setItem(READ_MODE_KEY, readMode);
  applyReadMode();
  if (readMode === 'panel' && activePath) openFile(activePath);
});

function readerUrl(path, hash = '') {
  const url = new URL('reader.html', location.href);
  url.searchParams.set('path', path);
  if (IS_MOCK) url.searchParams.set('mock', '1');
  if (hash) url.hash = hash;
  return url.toString();
}

async function openInReaderTab(path, hash = '') {
  const url = readerUrl(path, hash);
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    window.open(url, 'md-reader'); // http harness fallback (named window ≈ tab reuse)
    return;
  }
  if (readerTabId != null) {
    try {
      await chrome.tabs.update(readerTabId, { url, active: true });
      return;
    } catch {
      readerTabId = null; // tab was closed
    }
  }
  const tab = await chrome.tabs.create({ url });
  readerTabId = tab.id;
  sessionStorage.setItem('mdreader.readertab', String(tab.id));
}

const viewer = createViewer({
  renderer,
  contentEl: els.content,
  statusEl: els.status,
  onNavigate: (path, hash) => navigate(path, hash),
});

/* ---------- state display ---------- */

function showReady() {
  document.body.dataset.state = 'ready';
  els.edge.hidden = true;
  els.tree.hidden = false;
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
  els.tree.hidden = true;
  els.readerWrap.hidden = true;
  els.status.hidden = true;
  els.tabBtn.disabled = true;
  els.refreshBtn.disabled = true;
}

function setFolderName(name) {
  els.folderBtn.hidden = false;
  els.folderBtn.classList.remove('wordmark');
  els.folderBtn.textContent = name;
  els.folderBtn.title = `${name} — click to switch folder`;
}

function updateNavButtons() {
  els.backBtn.disabled = backStack.length === 0;
  els.fwdBtn.disabled = fwdStack.length === 0;
  els.tabBtn.disabled = !activePath;
}

/* ---------- tree ---------- */

const expandKey = () => `mdreader.expanded.${source.name}`;
const lastFileKey = () => `mdreader.lastfile.${source.name}`;

function loadExpanded() {
  try {
    return new Set(JSON.parse(localStorage.getItem(expandKey()) || '[]'));
  } catch {
    return new Set();
  }
}
const expanded = { set: new Set() };

function saveExpanded() {
  localStorage.setItem(expandKey(), JSON.stringify([...expanded.set]));
}

function mdCount(node) {
  return node.files.length + node.dirs.reduce((n, d) => n + mdCount(d), 0);
}

function treeHasPath(node, path) {
  return (
    node.files.some((f) => f.path === path) || node.dirs.some((d) => treeHasPath(d, path))
  );
}

function renderTree() {
  els.tree.innerHTML = '';
  els.tree.appendChild(renderDirChildren(tree, 0));
}

function renderDirChildren(node, depth) {
  const ul = document.createElement('ul');
  for (const dir of node.dirs) {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.className = 'tree-row dir';
    row.style.setProperty('--depth', depth);
    row.innerHTML = `<span class="chevron"></span><svg class="folder-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2A1.75 1.75 0 0 0 5 1H1.75Z"/></svg><span class="name"></span><span class="count"></span>`;
    row.querySelector('.name').textContent = dir.name;
    row.querySelector('.count').textContent = String(mdCount(dir));
    li.appendChild(row);
    const childrenHolder = document.createElement('div');
    li.appendChild(childrenHolder);
    const sync = () => {
      const isOpen = expanded.set.has(dir.path);
      row.classList.toggle('expanded', isOpen);
      childrenHolder.replaceChildren(...(isOpen ? [renderDirChildren(dir, depth + 1)] : []));
    };
    row.addEventListener('click', () => {
      if (expanded.set.has(dir.path)) expanded.set.delete(dir.path);
      else expanded.set.add(dir.path);
      saveExpanded();
      sync();
    });
    sync();
    ul.appendChild(li);
  }
  for (const file of node.files) {
    const li = document.createElement('li');
    const row = document.createElement('button');
    row.className = 'tree-row file';
    row.style.setProperty('--depth', depth);
    row.dataset.path = file.path;
    row.innerHTML = `<span class="lead-spacer"></span><svg class="doc-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/></svg><span class="name"></span>`;
    row.querySelector('.name').textContent = file.name;
    if (activePath === file.path) row.classList.add('active');
    row.addEventListener('click', () => navigate(file.path));
    li.appendChild(row);
    ul.appendChild(li);
  }
  return ul;
}

function markActive(path) {
  for (const seg of pathAncestors(path)) expanded.set.add(seg);
  saveExpanded();
  renderTree();
  const row = els.tree.querySelector(`.tree-row.file[data-path="${CSS.escape(path)}"]`);
  row?.scrollIntoView({ block: 'nearest' });
}

function pathAncestors(path) {
  const segs = path.split('/').slice(0, -1);
  const out = [];
  let p = '';
  for (const s of segs) {
    p = p ? `${p}/${s}` : s;
    out.push(p);
  }
  return out;
}

/* ---------- navigation ---------- */

async function openFile(path, hash) {
  activePath = path;
  localStorage.setItem(lastFileKey(), path);
  markActive(path);
  if (readMode === 'tab') {
    updateNavButtons();
    await openInReaderTab(path, hash);
    return;
  }
  try {
    await viewer.open(path, { hash });
    updateNavButtons();
  } catch (err) {
    els.content.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'edge-state';
    const p = document.createElement('p');
    p.textContent =
      err?.name === 'NotFoundError'
        ? `${path} is no longer in the folder. It may have been moved or deleted — refresh to update the file list.`
        : `Could not read ${path}: ${err?.message || err}`;
    box.appendChild(p);
    els.content.appendChild(box);
    els.status.textContent = `${path} · read failed`;
    updateNavButtons();
  }
}

function navigate(path, hash = '') {
  if (readMode === 'panel' && viewer.current && viewer.current.path !== path) {
    backStack.push(viewer.current.path);
    fwdStack.length = 0;
  }
  openFile(path, hash);
}

els.backBtn.addEventListener('click', () => {
  if (!backStack.length) return;
  if (viewer.current) fwdStack.push(viewer.current.path);
  openFile(backStack.pop());
});

els.fwdBtn.addEventListener('click', () => {
  if (!fwdStack.length) return;
  if (viewer.current) backStack.push(viewer.current.path);
  openFile(fwdStack.pop());
});

els.tabBtn.addEventListener('click', () => {
  if (activePath) openInReaderTab(activePath);
});

els.refreshBtn.addEventListener('click', async () => {
  try {
    tree = await source.tree();
    renderTree();
    if (activePath && !treeHasPath(tree, activePath)) {
      activePath = null;
      await openDefaultFile();
    } else if (readMode === 'panel' && viewer.current) {
      await viewer.refresh();
    }
  } catch (err) {
    onFolderGone(err);
  }
});

els.folderBtn.addEventListener('click', () => {
  if (!IS_MOCK) pickFolder();
});

/* ---------- folder lifecycle ---------- */

async function pickFolder() {
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'md-reader', mode: 'read' });
  } catch (err) {
    if (err?.name === 'AbortError') return;
    throw err;
  }
  await idbSet('root', handle);
  backStack.length = 0;
  fwdStack.length = 0;
  await connect(handle);
}

function onFolderGone(err) {
  console.warn('folder unavailable', err);
  showEdge(
    `<h2>Folder unavailable</h2>
     <p>${source ? `“${source.name}”` : 'The folder'} could not be read. It may have been moved, deleted, or is on a disconnected drive.</p>`,
    [{ label: 'Choose folder…', onClick: pickFolder }]
  );
}

async function connect(handle) {
  source = createRealSource(handle);
  viewer.setSource(source);
  setFolderName(handle.name);
  await loadFolder();
}

async function loadFolder() {
  expanded.set = loadExpanded();
  try {
    tree = await source.tree();
  } catch (err) {
    onFolderGone(err);
    return;
  }
  if (mdCount(tree) === 0) {
    showEdge(
      `<h2>No markdown files</h2>
       <p>“${source.name}” has no .md or .markdown files (searched all subfolders except .git and node_modules).</p>`,
      [{ label: 'Choose another folder…', onClick: pickFolder }]
    );
    return;
  }
  showReady();
  renderTree();
  await openDefaultFile();
}

async function openDefaultFile() {
  const last = localStorage.getItem(lastFileKey());
  const readme = tree.files.find((f) => /^readme\.(md|markdown)$/i.test(f.name));
  const pick = (last && treeHasPath(tree, last) && last) || (readme || tree.files[0] || firstFileIn(tree))?.path;
  if (!pick) return;
  if (readMode === 'tab') {
    // Don't spawn a tab just because the panel opened — preselect only.
    activePath = pick;
    markActive(pick);
    updateNavButtons();
    return;
  }
  return openFile(pick);
}

function firstFileIn(node) {
  if (node.files[0]) return node.files[0];
  for (const d of node.dirs) {
    const f = firstFileIn(d);
    if (f) return f;
  }
  return null;
}

/* ---------- boot ---------- */

async function boot() {
  applyReadMode();
  if (IS_MOCK) {
    els.mockBadge.hidden = false;
    source = await createMockSource();
    viewer.setSource(source);
    setFolderName(source.name);
    els.folderBtn.title = 'Mock data — folder switching disabled';
    await loadFolder();
    return;
  }

  const handle = await idbGet('root');
  if (!handle) {
    els.folderBtn.hidden = false;
    els.folderBtn.textContent = 'md-reader';
    els.folderBtn.classList.add('wordmark');
    els.folderBtn.title = 'md-reader';
    showEdge(
      `<svg class="blank-icon" viewBox="0 0 208 128" width="48" height="30" aria-hidden="true"><rect x="4" y="4" width="200" height="120" rx="12" fill="none" stroke="currentColor" stroke-width="10"/><path fill="currentColor" d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39Z"/><path fill="currentColor" d="m155 98-27-30h18V30h18v38h18Z"/></svg>
       <h2>md-reader</h2>
       <p>Browse a local folder’s Markdown files, rendered GitHub-style. Files are read directly from disk — nothing leaves this machine.</p>`,
      [{ label: 'Choose folder…', onClick: pickFolder }]
    );
    return;
  }

  const perm = await handle.queryPermission({ mode: 'read' });
  if (perm === 'granted') {
    await connect(handle);
    return;
  }

  setFolderName(handle.name);
  showEdge(
    `<h2>Reconnect “${handle.name}”</h2>
     <p>Chrome needs a click to re-allow access after a restart. Choose “Allow on every visit” in the prompt to skip this next time.</p>`,
    [
      {
        label: `Reconnect ${handle.name}`,
        onClick: async () => {
          const p = await handle.requestPermission({ mode: 'read' });
          if (p === 'granted') await connect(handle);
        },
      },
      { label: 'Choose another folder…', onClick: pickFolder, secondary: true },
    ]
  );
}

boot();
