/* eslint-disable no-restricted-globals */
/**
 * ProduktívPro service worker.
 * Stratégia (1. szakasz):
 *   - App shell precache (kezdőlap + ikonok + manifest), hogy a PWA telepíthető
 *     és offline is megnyithat legyen.
 *   - Navigation requests:    network-first, fallback shell.
 *   - Statikus assetek (Vite hash-elt fájljai, /assets/*): stale-while-revalidate.
 *   - Egyéb GET:              network-first, cache-fallback.
 *
 * A 2. szakaszban (Supabase integráció után) kerül ide IndexedDB alapú
 * mutation queue és Background Sync — most még nincs mit szinkronizálni,
 * mert minden adat localStorage-ban él.
 */

// A verziót a regisztrációs URL ?v= paramétere adja (index.html →
// /sw.js?v=VERZIÓ). Minden kiadásnál más → új cache-nevek → az activate
// törli a régi (elavult) gyorsítótárakat. Ha nincs ?v=, fix fallback.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'pp-dev';
const APP_SHELL_CACHE = `pp-${VERSION}-shell`;
const RUNTIME_CACHE = `pp-${VERSION}-runtime`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) =>
        // addAll fails atomically; use Promise.allSettled to be tolerant
        // (pl. dev szerveren nincs minden fájl)
        Promise.allSettled(APP_SHELL_URLS.map((u) => cache.add(u))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first → fallback to cached app shell (offline support)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(APP_SHELL_CACHE);
          const cached = (await cache.match('/index.html')) || (await cache.match('/'));
          return (
            cached ||
            new Response(
              '<h1>Nincs hálózat</h1><p>Az alkalmazás offline indítása nem sikerült.</p>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            )
          );
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((resp) => {
            if (resp.ok) cache.put(request, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || (await networkPromise);
      })(),
    );
    return;
  }

  // Other GET: network-first, cache fallback
  event.respondWith(
    (async () => {
      try {
        const resp = await fetch(request);
        if (resp.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, resp.clone());
        }
        return resp;
      } catch {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error('Offline és nincs cache.');
      }
    })(),
  );
});

// Lehetővé teszi a kliensből küldött SKIP_WAITING üzenetet (pl. új verzió)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
