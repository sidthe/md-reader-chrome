// A source provides the file tree and file contents. Real = File System
// Access directory handle; files = an explicit set of file handles (picked
// individually, so each clears the per-file enterprise scan that a directory
// grant hangs on); mock = extension-packaged fixtures (?mock=1), always
// badged MOCK in the UI — mock data never renders unlabeled.
import { walk, readFile, readFileBlob, isMarkdown } from './fs.js';

export function createRealSource(rootHandle) {
  return {
    kind: 'real',
    name: rootHandle.name,
    tree: (onEntry) => walk(rootHandle, '', onEntry),
    read: (path) => readFile(rootHandle, path),
    blob: (path) => readFileBlob(rootHandle, path),
  };
}

// A flat source over individually-picked file handles. showOpenFilePicker
// handles carry only `.name` (no directory path), so the tree is one level;
// duplicate names get a " (2)" suffix to stay addressable.
export function createFilesSource(fileHandles) {
  const byPath = new Map();
  const files = [];
  const used = new Set();
  for (const h of fileHandles) {
    let path = h.name;
    if (used.has(path)) {
      const dot = h.name.lastIndexOf('.');
      const base = dot > 0 ? h.name.slice(0, dot) : h.name;
      const ext = dot > 0 ? h.name.slice(dot) : '';
      let i = 2;
      while (used.has(`${base} (${i})${ext}`)) i++;
      path = `${base} (${i})${ext}`;
    }
    used.add(path);
    byPath.set(path, h);
    files.push({ name: path, path });
  }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const get = (path) => {
    const h = byPath.get(path);
    if (!h) throw new DOMException(`${path} is not among the opened files`, 'NotFoundError');
    return h;
  };
  return {
    kind: 'files',
    name: `${files.length} file${files.length === 1 ? '' : 's'}`,
    tree: async () => ({ name: '', path: '', dirs: [], files }),
    read: async (path) => {
      const file = await get(path).getFile();
      return { text: await file.text(), size: file.size, mtime: file.lastModified, readAt: Date.now() };
    },
    blob: async (path) => get(path).getFile(),
  };
}

// Permission across a set of file handles: 'granted' only if all are granted.
export async function queryFilesPermission(handles) {
  for (const h of handles) {
    if ((await h.queryPermission({ mode: 'read' })) !== 'granted') return 'prompt';
  }
  return 'granted';
}

// Request read on each handle; returns the subset actually granted.
export async function requestFilesPermission(handles) {
  const granted = [];
  for (const h of handles) {
    let p = await h.queryPermission({ mode: 'read' });
    if (p !== 'granted') p = await h.requestPermission({ mode: 'read' });
    if (p === 'granted') granted.push(h);
  }
  return granted;
}

// Mock mtime is a fixed constant, not a fabricated "now" — the MOCK badge
// plus this stable date make the fake data unmistakable.
const MOCK_MTIME = Date.UTC(2026, 0, 1, 12, 0, 0);

export async function createMockSource() {
  const res = await fetch('fixtures/mock/manifest.json');
  const manifest = await res.json();

  function buildTree() {
    const root = { name: manifest.name, path: '', dirs: [], files: [] };
    const dirByPath = new Map([['', root]]);
    for (const file of manifest.files) {
      if (!isMarkdown(file)) continue; // like walk(): md-less dirs never appear
      const segs = file.split('/');
      let path = '';
      let node = root;
      for (const seg of segs.slice(0, -1)) {
        path = path ? `${path}/${seg}` : seg;
        if (!dirByPath.has(path)) {
          const dir = { name: seg, path, dirs: [], files: [] };
          node.dirs.push(dir);
          dirByPath.set(path, dir);
        }
        node = dirByPath.get(path);
      }
      node.files.push({ name: segs[segs.length - 1], path: file });
    }
    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    for (const dir of dirByPath.values()) {
      dir.dirs.sort(byName);
      dir.files.sort(byName);
    }
    return root;
  }

  return {
    kind: 'mock',
    name: manifest.name,
    tree: async () => buildTree(),
    read: async (path) => {
      const r = await fetch(`fixtures/mock/${path}`);
      if (!r.ok) throw new DOMException(path, 'NotFoundError');
      const blob = await r.blob();
      return { text: await blob.text(), size: blob.size, mtime: MOCK_MTIME, readAt: Date.now() };
    },
    blob: async (path) => {
      const r = await fetch(`fixtures/mock/${path}`);
      if (!r.ok) throw new DOMException(path, 'NotFoundError');
      return r.blob();
    },
  };
}
