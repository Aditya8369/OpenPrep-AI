// Service Worker for OpenPrep AI - Precaching static assets and caching GET API responses for offline access

const CACHE_NAME = 'openprep-cache-v1';
const API_CACHE_NAME = 'openprep-api-cache-v1';

// Static assets to precache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg',
  '/manifest.webmanifest',
];

// Import Web Push handlers if present
try {
  importScripts('/push-sw.js');
} catch (e) {
  console.warn('Push service worker script import skipped:', e);
}

// ── Install Event ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache addAll encountered minor issue:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activate Event ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== API_CACHE_NAME) {
            return caches.delete(name);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch Event (Network-First for API GET requests, Cache-First for static assets) ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (POST/PUT/DELETE handled by app queue)
  if (request.method !== 'GET') {
    return;
  }

  // API Requests: Network-First with Cache Fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({
                success: false,
                offline: true,
                error: 'Network connection unavailable. Operating in offline mode.',
              }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          });
        })
    );
    return;
  }

  // Static Assets / Navigation: Stale-While-Revalidate or Cache-First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch background update for cache refresh
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {/* offline */});
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If HTML navigation fails, fallback to index.html
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// ── Background Sync Event ──
self.addEventListener('sync', (event) => {
  if (
    event.tag === 'openprep-background-sync' ||
    event.tag === 'openprep-sync-queue' ||
    event.tag === 'sync-mutations'
  ) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_SYNC', tag: event.tag });
        });
      })
    );
  }
});

