// Directory walking and file access over the File System Access API.
// resolvePath and isMarkdown are pure (node-testable); the rest takes handles.

export const SKIP_DIRS = new Set(['.git', 'node_modules']);

export function isMarkdown(name) {
  return /\.(md|markdown)$/i.test(name);
}

// Resolve `rel` against the directory of `fromPath` (both '/'-separated,
// relative to the picked root). Returns the normalized path, or null if it
// escapes the root. Absolute-style '/x.md' resolves from the root.
export function resolvePath(fromPath, rel) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(rel)) return null; // has a scheme: not ours
  const base = rel.startsWith('/') ? [] : fromPath.split('/').slice(0, -1);
  const parts = [...base];
  for (const seg of rel.replace(/^\//, '').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

// Walk the tree under rootHandle. Returns
//   { name, path, dirs: [subtree...], files: [{name, path}] }
// pruned to directories that contain at least one markdown file, with
// dirs and files each sorted case-insensitively.
// onEntry(path) is called for every entry visited (progress reporting);
// if it returns a promise it is awaited, letting the caller yield to the UI.
export async function walk(rootHandle, path = '', onEntry = null) {
  const dirs = [];
  const files = [];
  for await (const entry of rootHandle.values()) {
    const childPath = path ? `${path}/${entry.name}` : entry.name;
    if (onEntry) {
      const r = onEntry(childPath);
      if (r) await r;
    }
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = await walk(entry, childPath, onEntry);
      if (sub.dirs.length || sub.files.length) dirs.push(sub);
    } else if (entry.kind === 'file' && isMarkdown(entry.name)) {
      files.push({ name: entry.name, path: childPath });
    }
  }
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  dirs.sort(byName);
  files.sort(byName);
  return { name: rootHandle.name, path, dirs, files };
}

export async function getFileHandleByPath(rootHandle, path) {
  const segs = path.split('/');
  let dir = rootHandle;
  for (const seg of segs.slice(0, -1)) {
    dir = await dir.getDirectoryHandle(seg);
  }
  return dir.getFileHandle(segs[segs.length - 1]);
}

export async function readFile(rootHandle, path) {
  const handle = await getFileHandleByPath(rootHandle, path);
  const file = await handle.getFile();
  return {
    text: await file.text(),
    size: file.size,
    mtime: file.lastModified,
    readAt: Date.now(),
  };
}

export async function readFileBlob(rootHandle, path) {
  const handle = await getFileHandleByPath(rootHandle, path);
  return handle.getFile();
}
