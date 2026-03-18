// IndexedDB helper for temporarily storing audio blobs after failed transcriptions.
// Blobs are keyed by noteId and auto-expire after MAX_AGE_DAYS days.

const DB_NAME = 'noteflow-audio';
const STORE = 'recordings';
const MAX_AGE_DAYS = 7;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'noteId' });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudio(noteId, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ noteId, blob, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAudio(noteId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(noteId);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudio(noteId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(noteId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// Call once on app load — removes any blobs older than MAX_AGE_DAYS
export async function cleanupOldAudio() {
  try {
    const db = await openDB();
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const all = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const stale = all.filter(r => r.savedAt < cutoff);
    if (!stale.length) return;
    const tx = db.transaction(STORE, 'readwrite');
    stale.forEach(r => tx.objectStore(STORE).delete(r.noteId));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('audioStore cleanup error:', e);
  }
}
