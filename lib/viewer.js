// Shared document viewer used by both the side panel and the full-tab
// reader: renders a file into a container, resolves relative links/images
// through the source, and keeps the freshness line honest.
import { resolvePath, isMarkdown } from './fs.js';

export const LARGE_FILE_BYTES = 1024 * 1024;

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAgo(ms) {
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function createViewer({ renderer, contentEl, statusEl, onNavigate, onExternal }) {
  let source = null;
  let current = null;
  let blobUrls = [];
  let agoTimer = null;

  function revokeBlobUrls() {
    for (const url of blobUrls) URL.revokeObjectURL(url);
    blobUrls = [];
  }

  function updateStatus() {
    if (!current || !statusEl) return;
    const name = current.path.split('/').pop();
    const d = new Date(current.mtime);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const modified =
      d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
      }) +
      ' ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const ago = formatAgo(Date.now() - current.readAt);
    statusEl.textContent = `${name} · ${formatBytes(current.size)} · mod ${modified} · read ${ago}`;
    statusEl.title = `${current.path} — modified ${d.toLocaleString()}`;
  }

  async function resolveImages(basePath) {
    for (const img of contentEl.querySelectorAll('img')) {
      const raw = img.getAttribute('src') || '';
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(raw)) continue; // absolute/external
      const path = resolvePath(basePath, raw);
      if (!path) continue;
      try {
        const blob = await source.blob(path);
        const url = URL.createObjectURL(blob);
        blobUrls.push(url);
        img.src = url;
      } catch {
        img.alt = `${img.alt || raw} (not found)`;
        img.title = `${raw} — not found in folder`;
      }
    }
  }

  function scrollToHash(hash) {
    const id = decodeURIComponent(hash);
    const el =
      contentEl.querySelector(`[id="${CSS.escape(`user-content-${id}`)}"]`) ||
      contentEl.querySelector(`[id="${CSS.escape(id)}"]`);
    if (el) el.scrollIntoView();
  }

  async function inject(text, path, hash) {
    revokeBlobUrls();
    contentEl.innerHTML = renderer.render(text);
    contentEl.classList.remove('doc-enter');
    void contentEl.offsetWidth; // restart the enter animation
    contentEl.classList.add('doc-enter');
    await resolveImages(path);
    if (hash) scrollToHash(hash);
    else contentEl.parentElement.scrollTop = 0;
  }

  async function open(path, { hash = '', force = false } = {}) {
    const file = await source.read(path);
    if (file.size > LARGE_FILE_BYTES && !force) {
      current = null;
      revokeBlobUrls();
      contentEl.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'edge-state';
      box.innerHTML = `<p><strong>${path.split('/').pop()}</strong> is ${formatBytes(file.size)} (over 1 MB).</p>`;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Render anyway';
      btn.addEventListener('click', () => open(path, { hash, force: true }));
      box.appendChild(btn);
      contentEl.appendChild(box);
      if (statusEl) {
        statusEl.textContent = `${path.split('/').pop()} · ${formatBytes(file.size)} · not rendered`;
      }
      return { path, size: file.size, rendered: false };
    }
    current = { path, size: file.size, mtime: file.mtime, readAt: file.readAt };
    await inject(file.text, path, hash);
    updateStatus();
    clearInterval(agoTimer);
    agoTimer = setInterval(updateStatus, 15000);
    return { path, size: file.size, rendered: true };
  }

  contentEl.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !contentEl.contains(a)) return;
    const href = a.getAttribute('href') || '';
    if (!href) return;
    if (href.startsWith('#')) {
      e.preventDefault();
      scrollToHash(href.slice(1));
      return;
    }
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
      e.preventDefault();
      (onExternal || ((url) => window.open(url, '_blank')))(href);
      return;
    }
    e.preventDefault();
    if (!current) return;
    const [relPath, hash = ''] = href.split('#');
    const path = resolvePath(current.path, relPath);
    if (!path) return;
    if (isMarkdown(path)) {
      onNavigate(path, hash);
    } else {
      // Non-markdown relative file: open its blob in a new tab.
      source
        .blob(path)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          blobUrls.push(url);
          window.open(url, '_blank');
        })
        .catch(() => {});
    }
  });

  return {
    open,
    setSource(s) {
      source = s;
      current = null;
    },
    get current() {
      return current;
    },
    async refresh() {
      if (current) return open(current.path);
      return null;
    },
  };
}
