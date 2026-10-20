import { describe, it, expect, beforeEach, vi } from 'vitest';

// Clean in-memory IndexedDB mock for unit testing
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

import {
  openDB,
  put,
  getById,
  getAll,
  remove,
  clear,
  queueOutboxMutation,
  getPendingMutations,
  removeOutboxMutation,
  clearOutbox,
} from './offlineStorageService';

describe('offlineStorageService', () => {
  beforeEach(async () => {
    await clearOutbox();
    await clear('flashcards');
    await clear('decks');
  });

  it('initializes IndexedDB database with all required stores', async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains('decks')).toBe(true);
    expect(db.objectStoreNames.contains('flashcards')).toBe(true);
    expect(db.objectStoreNames.contains('notes')).toBe(true);
    expect(db.objectStoreNames.contains('quizResults')).toBe(true);
    expect(db.objectStoreNames.contains('outbox_mutations')).toBe(true);
  });

  it('puts, gets, and removes entities in stores', async () => {
    const card = { id: 'card-101', front: 'What is $F=ma$?', back: 'Newton 2nd Law' };
    await put('flashcards', card);

    const retrieved = await getById('flashcards', 'card-101');
    expect(retrieved).toEqual(card);

    const allCards = await getAll('flashcards');
    expect(allCards).toHaveLength(1);

    await remove('flashcards', 'card-101');
    const afterDelete = await getById('flashcards', 'card-101');
    expect(afterDelete).toBeNull();
  });

  it('queues outbox mutation with monotonic sequence and retrieves pending', async () => {
    const mut1 = await queueOutboxMutation({
      type: 'FLASHCARD_REVIEW',
      payload: { cardId: 'card-1', score: 4 },
    });
    const mut2 = await queueOutboxMutation({
      type: 'FLASHCARD_REVIEW',
      payload: { cardId: 'card-2', score: 5 },
    });

    expect(mut1.id).toBeDefined();
    expect(mut2.id).toBeDefined();
    expect(mut2.sequence).toBeGreaterThan(mut1.sequence);

    const pending = await getPendingMutations();
    expect(pending).toHaveLength(2);
    expect(pending[0].payload.cardId).toBe('card-1');
    expect(pending[1].payload.cardId).toBe('card-2');

    await removeOutboxMutation(mut1.id);
    const remaining = await getPendingMutations();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].payload.cardId).toBe('card-2');
  });

  it('clears all outbox mutations', async () => {
    await queueOutboxMutation({ type: 'TEST_ACTION', payload: {} });
    expect(await getPendingMutations()).toHaveLength(1);

    await clearOutbox();
    expect(await getPendingMutations()).toHaveLength(0);
  });
});
