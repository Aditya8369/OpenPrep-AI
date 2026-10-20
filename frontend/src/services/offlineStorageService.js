const DB_NAME = 'OpenPrepOfflineDB';
const DB_VERSION = 2;

let monotonicCounter = 0;

/**
 * Open or upgrade the local IndexedDB database.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Local store for flashcard decks
      if (!db.objectStoreNames.contains('decks')) {
        db.createObjectStore('decks', { keyPath: 'id' });
      }

      // Local store for individual flashcards
      if (!db.objectStoreNames.contains('flashcards')) {
        db.createObjectStore('flashcards', { keyPath: 'id' });
      }

      // Local store for user notes
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'id' });
      }

      // Local store for offline practice quiz results
      if (!db.objectStoreNames.contains('quizResults')) {
        db.createObjectStore('quizResults', { keyPath: 'id' });
      }

      // Primary outbox mutation queue for background sync
      if (!db.objectStoreNames.contains('outbox_mutations')) {
        db.createObjectStore('outbox_mutations', { keyPath: 'id', autoIncrement: true });
      }

      // Legacy queue alias for backward compatibility
      if (!db.objectStoreNames.contains('mutationsQueue')) {
        db.createObjectStore('mutationsQueue', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Fetch all items from a given object store.
 */
async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetch a single item by key from an object store.
 */
async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add or update an item in the object store.
 */
async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove an item by ID from the object store.
 */
async function remove(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all items from an object store.
 */
async function clear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Appends a mutation to the outbox queue with a monotonic timestamp
 * @param {Object} action - Action details { type, entityType, entityId, payload, ... }
 */
async function queueOutboxMutation(action) {
  monotonicCounter++;
  const mutation = {
    ...action,
    attempts: 0,
    timestamp: Date.now(),
    sequence: monotonicCounter,
    clientTimestamp: new Date().toISOString(),
  };

  const id = await put('outbox_mutations', mutation);
  const queued = { ...mutation, id };
  // Also keep mutationsQueue mirrored for existing listeners
  try {
    await put('mutationsQueue', queued);
  } catch (_) {}

  return queued;
}

/**
 * Retrieve all pending mutations in the outbox
 */
async function getPendingMutations() {
  const list = await getAll('outbox_mutations');
  return list.sort((a, b) => (a.sequence || a.timestamp) - (b.sequence || b.timestamp));
}

/**
 * Remove a processed mutation from the outbox queue
 */
async function removeOutboxMutation(id) {
  await remove('outbox_mutations', id);
  try {
    await remove('mutationsQueue', id);
  } catch (_) {}
}

/**
 * Clear all pending outbox mutations
 */
async function clearOutbox() {
  await clear('outbox_mutations');
  try {
    await clear('mutationsQueue');
  } catch (_) {}
}

export {
  openDB,
  getAll,
  getById,
  put,
  remove,
  clear,
  queueOutboxMutation,
  getPendingMutations,
  removeOutboxMutation,
  clearOutbox,
};
