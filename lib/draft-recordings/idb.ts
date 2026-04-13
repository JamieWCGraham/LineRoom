const DB_NAME = "lineroom_draft_audio_v1";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function idbPutRecording(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.objectStore(STORE).put(blob, id);
    });
  } finally {
    db.close();
  }
}

export async function idbGetRecording(id: string): Promise<Blob | null> {
  const db = await openDb();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB read failed"));
      const r = tx.objectStore(STORE).get(id);
      r.onsuccess = () => resolve((r.result as Blob | undefined) ?? null);
    });
  } finally {
    db.close();
  }
}

export async function idbDeleteRecording(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.objectStore(STORE).delete(id);
    });
  } finally {
    db.close();
  }
}
