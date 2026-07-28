// Minimal IndexedDB key-value store for FileSystemDirectoryHandle persistence.
// Handles are structured-cloneable into IndexedDB; chrome.storage cannot hold them.
const DB_NAME = 'md-reader';
const STORE = 'handles';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function idbGet(key) {
  const db = await openDb();
  try {
    return await tx(db, 'readonly', (s) => s.get(key));
  } finally {
    db.close();
  }
}

export async function idbSet(key, value) {
  const db = await openDb();
  try {
    await tx(db, 'readwrite', (s) => s.put(value, key));
  } finally {
    db.close();
  }
}

export async function idbDel(key) {
  const db = await openDb();
  try {
    await tx(db, 'readwrite', (s) => s.delete(key));
  } finally {
    db.close();
  }
}
