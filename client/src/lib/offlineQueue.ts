/**
 * IndexedDB-backed offline queue for form submissions.
 * When the device is offline, submissions are stored locally
 * and automatically synced when connectivity returns.
 */

const DB_NAME = "ecs-connect-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending-submissions";

interface QueuedSubmission {
  id: string;
  submissionId: string; // Server-side form_submission ID
  responseData: Record<string, unknown>;
  gps?: { latitude: string; longitude: string; accuracy: string };
  deviceInfo?: Record<string, unknown>;
  queuedAt: number; // timestamp
  retryCount: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add a form submission to the offline queue.
 */
export async function enqueue(submission: Omit<QueuedSubmission, "id" | "queuedAt" | "retryCount">): Promise<string> {
  const db = await openDB();
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const entry: QueuedSubmission = {
    ...submission,
    id,
    queuedAt: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(entry);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all pending submissions from the queue.
 */
export async function getAll(): Promise<QueuedSubmission[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a submission from the queue after successful sync.
 */
export async function remove(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Increment retry count for a failed sync attempt.
 */
export async function incrementRetry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const entry = getRequest.result as QueuedSubmission;
      if (entry) {
        entry.retryCount++;
        store.put(entry);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get count of pending submissions.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Drain the queue by submitting all pending items to the server.
 * Called automatically when connectivity is restored.
 */
export async function drainQueue(): Promise<{ synced: number; failed: number }> {
  const pending = await getAll();
  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      const response = await fetch(`/api/form-submissions/${entry.submissionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          responseData: entry.responseData,
          gps: entry.gps,
          deviceInfo: entry.deviceInfo,
          offline: true,
        }),
      });

      if (response.ok) {
        await remove(entry.id);
        synced++;
      } else {
        await incrementRetry(entry.id);
        failed++;
      }
    } catch {
      await incrementRetry(entry.id);
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Set up automatic queue draining when connectivity is restored.
 */
export function setupAutoSync(): void {
  // Drain on connectivity restored
  window.addEventListener("online", () => {
    console.log("[OfflineQueue] Online - draining queue");
    drainQueue().then(({ synced, failed }) => {
      if (synced > 0 || failed > 0) {
        console.log(`[OfflineQueue] Synced: ${synced}, Failed: ${failed}`);
      }
    });
  });

  // Drain on app open/focus (catches cases where online event was missed)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      drainQueue();
    }
  });

  // Initial drain if online
  if (navigator.onLine) {
    drainQueue();
  }
}
