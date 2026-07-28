// A source provides the file tree and file contents. Real = File System
// Access handles; mock = extension-packaged fixtures (?mock=1), always
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
