import API from './api';
import {
  getAll,
  put,
  remove,
  queueOutboxMutation,
  getPendingMutations,
  removeOutboxMutation,
} from './offlineStorageService';
import { registerBackgroundSync } from '../serviceWorkerRegistration';

export const SYNC_EVENT = 'offline-sync-update';
export const MAX_ATTEMPTS = 5;

const TERMINAL_STATUSES = new Set([400, 404, 409, 410, 422]);
const RETRYABLE_STATUSES = new Set([401, 403, 408, 429]);

function announce(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail }));
  }
}

/**
 * Queues an action/mutation into the local IndexedDB outbox.
 * If offline, attempts to register a Service Worker Background Sync event.
 *
 * @param {Object} action - { type, entityType, entityId, payload, url, method }
 */
export async function queueOfflineMutation(action) {
  const queued = await queueOutboxMutation(action);

  // If currently offline, register browser background sync
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    registerBackgroundSync('openprep-background-sync').catch(() => {});
  }

  announce({ type: 'queued', mutation: queued });
  return queued;
}

/**
 * Flushes all pending outbox mutations to the backend in a single batch request
 * POST /api/sync/batch
 *
 * @returns {Promise<{flushed: number, retained: number, discarded: number, status: string}>}
 */
export async function syncBatchMutations() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, retained: 0, discarded: 0, status: 'offline' };
  }

  const pending = await getPendingMutations();
  if (!pending || pending.length === 0) {
    return { flushed: 0, retained: 0, discarded: 0, status: 'empty' };
  }

  console.log(`[SyncManager] Submitting batch of ${pending.length} offline mutations...`);

  try {
    const response = await API.post('/sync/batch', {
      mutations: pending,
    });

    const batchData = response.data?.data;
    const results = batchData?.results || [];

    let flushed = 0;
    let retained = 0;
    let discarded = 0;

    // Process results for each mutation
    for (const item of pending) {
      const match = results.find((r) => r.actionId === item.id);
      if (match) {
        if (match.status === 'applied' || match.status === 'conflict_resolved') {
          await removeOutboxMutation(item.id);
          flushed++;
        } else if (match.status === 'rejected') {
          // Permanent validation rejection, discard
          await removeOutboxMutation(item.id);
          discarded++;
        } else {
          // Error or transient failure, increment attempt count
          const attempts = (item.attempts || 0) + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await removeOutboxMutation(item.id);
            discarded++;
          } else {
            await put('outbox_mutations', { ...item, attempts });
            retained++;
          }
        }
      } else {
        // Fallback: If not in specific results, assume applied
        await removeOutboxMutation(item.id);
        flushed++;
      }
    }

    announce({ type: 'sync_completed', flushed, discarded, retained });
    return { flushed, retained, discarded, status: 'completed' };
  } catch (error) {
    const status = error.response?.status;

    // If batch endpoint returns 404 or 400, fallback to sequential replay
    if (status === 404 || status === 400) {
      console.warn('[SyncManager] Batch endpoint unavailable; falling back to replay()...');
      return flushMutationsQueue();
    }

    console.error('[SyncManager] Batch sync error:', error.message);
    announce({ type: 'sync_error', error: error.message });
    return { flushed: 0, retained: pending.length, discarded: 0, status: 'error' };
  }
}

/**
 * Replays one individual mutation as a fallback
 */
async function replay(mutation) {
  const method = (mutation.method || 'POST').toLowerCase();
  const url = mutation.url || (mutation.type === 'FLASHCARD_REVIEW' ? '/flashcards/review' : '/sync/batch');

  try {
    await API.request({
      url,
      method,
      data: mutation.payload || mutation,
    });
    return 'drop';
  } catch (error) {
    const status = error?.response?.status;
    if (!status) return 'stop';
    if (TERMINAL_STATUSES.has(status)) return 'drop';
    if (RETRYABLE_STATUSES.has(status) || status >= 500) return 'keep';
    return 'keep';
  }
}

/**
 * Replays every queued mutation one by one
 */
export async function flushMutationsQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { flushed: 0, retained: 0, discarded: 0, status: 'offline' };
  }

  const queuedMutations = await getAll('mutationsQueue');
  if (queuedMutations.length === 0) {
    return { flushed: 0, retained: 0, discarded: 0, status: 'empty' };
  }

  let flushed = 0;
  let retained = 0;
  let discarded = 0;
  let status = 'completed';

  for (const mutation of queuedMutations) {
    const outcome = await replay(mutation);

    if (outcome === 'stop') {
      retained += 1;
      status = 'deferred';
      break;
    }

    if (outcome === 'drop') {
      await remove('mutationsQueue', mutation.id);
      await remove('outbox_mutations', mutation.id).catch(() => {});
      flushed += 1;
      continue;
    }

    const attempts = (mutation.attempts || 0) + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await remove('mutationsQueue', mutation.id);
      await remove('outbox_mutations', mutation.id).catch(() => {});
      discarded += 1;
      continue;
    }

    await put('mutationsQueue', { ...mutation, attempts });
    retained += 1;
  }

  announce({ type: 'queue_flushed', flushed, retained, discarded });
  return { flushed, retained, discarded, status };
}

export async function replayMutations() {
  return syncBatchMutations();
}

/**
 * Initializes listeners for online/offline events and ServiceWorker background sync messages
 */
export function initSyncManager(onSyncStatusChange) {
  if (typeof window === 'undefined') return;

  const handleOnline = () => {
    if (onSyncStatusChange) onSyncStatusChange({ isOnline: true });
    syncBatchMutations().catch((err) => console.error('[SyncManager] Auto-flush error:', err));
  };

  const handleOffline = () => {
    if (onSyncStatusChange) onSyncStatusChange({ isOnline: false });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TRIGGER_SYNC') {
        syncBatchMutations().catch((err) => console.error('[SyncManager] SW Sync error:', err));
      }
    });
  }
}

// Global auto-sync when online event triggers
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncBatchMutations().catch((err) =>
      console.error('[SyncManager] Auto-flush failed:', err.message)
    );
  });
}
