import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Clean in-memory IndexedDB mock
function createMockIndexedDB() {
  const stores = new Map();
  const storeSchemas = new Set();

  return {
    open: (name, version) => {
      const req = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null,
      };

      setTimeout(() => {
        const db = {
          objectStoreNames: {
            contains: (storeName) => storeSchemas.has(storeName),
          },
          createObjectStore: (storeName) => {
            storeSchemas.add(storeName);
            if (!stores.has(storeName)) stores.set(storeName, new Map());
          },
          transaction: (storeNames, mode) => {
            const storeName = Array.isArray(storeNames) ? storeNames[0] : storeNames;
            if (!stores.has(storeName)) stores.set(storeName, new Map());
            const map = stores.get(storeName);

            return {
              objectStore: () => ({
                put: (val) => {
                  const r = { onsuccess: null, onerror: null, result: null };
                  setTimeout(() => {
                    const key = val.id !== undefined ? val.id : map.size + 1;
                    map.set(key, { ...val, id: key });
                    r.result = key;
                    if (r.onsuccess) r.onsuccess();
                  }, 0);
                  return r;
                },
                get: (id) => {
                  const r = { onsuccess: null, onerror: null, result: null };
                  setTimeout(() => {
                    r.result = map.get(id) || null;
                    if (r.onsuccess) r.onsuccess();
                  }, 0);
                  return r;
                },
                getAll: () => {
                  const r = { onsuccess: null, onerror: null, result: null };
                  setTimeout(() => {
                    r.result = Array.from(map.values());
                    if (r.onsuccess) r.onsuccess();
                  }, 0);
                  return r;
                },
                delete: (id) => {
                  const r = { onsuccess: null, onerror: null };
                  setTimeout(() => {
                    map.delete(id);
                    if (r.onsuccess) r.onsuccess();
                  }, 0);
                  return r;
                },
                clear: () => {
                  const r = { onsuccess: null, onerror: null };
                  setTimeout(() => {
                    map.clear();
                    if (r.onsuccess) r.onsuccess();
                  }, 0);
                  return r;
                },
              }),
            };
          },
        };

        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: { result: db } });
        }
        req.result = db;
        if (req.onsuccess) {
          req.onsuccess({ target: { result: db } });
        }
      }, 0);

      return req;
    },
  };
}

globalThis.indexedDB = createMockIndexedDB();

import API from './api';
import {
  queueOfflineMutation,
  syncBatchMutations,
  initSyncManager,
  SYNC_EVENT,
} from './syncManager';
import { clearOutbox, getPendingMutations } from './offlineStorageService';

describe('syncManager', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearOutbox();
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(async () => {
    await clearOutbox();
  });

  it('returns empty status when no mutations are in outbox', async () => {
    const result = await syncBatchMutations();
    expect(result).toEqual({ flushed: 0, retained: 0, discarded: 0, status: 'empty' });
  });

  it('returns offline status when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true,
      writable: true,
    });

    await queueOfflineMutation({
      type: 'FLASHCARD_REVIEW',
      payload: { cardId: 'c1', score: 4 },
    });

    const result = await syncBatchMutations();
    expect(result.status).toBe('offline');
  });

  it('flushes pending mutations to /api/sync/batch and removes them from outbox', async () => {
    const mut1 = await queueOfflineMutation({
      type: 'FLASHCARD_REVIEW',
      payload: { cardId: 'c1', score: 5 },
    });

    vi.spyOn(API, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          processed: 1,
          results: [{ actionId: mut1.id, status: 'applied' }],
        },
      },
    });

    const syncResult = await syncBatchMutations();
    expect(API.post).toHaveBeenCalledWith('/sync/batch', expect.any(Object));
    expect(syncResult.flushed).toBe(1);
    expect(syncResult.status).toBe('completed');

    const remaining = await getPendingMutations();
    expect(remaining).toHaveLength(0);
  });

  it('notifies listeners via window custom event on queue and sync', async () => {
    const eventSpy = vi.fn();
    window.addEventListener(SYNC_EVENT, eventSpy);

    await queueOfflineMutation({
      type: 'NOTE_UPDATE',
      payload: { noteId: 'n1', title: 'New Title' },
    });

    expect(eventSpy).toHaveBeenCalled();
    window.removeEventListener(SYNC_EVENT, eventSpy);
  });

  it('initializes online and offline network listeners', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const onStatusChange = vi.fn();

    initSyncManager(onStatusChange);

    expect(addListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});
