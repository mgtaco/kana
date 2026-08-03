/*
 * A service worker written out rather than generated.
 *
 * The app has three runtime dependencies and no build step of its own beyond
 * Vite, so pulling in Workbox to cache four kinds of request would be the
 * largest thing in the repo by some way. There are only three rules here and
 * each one is a different answer to the same question — what happens when this
 * is stale?
 *
 *   the page shell   network first. A deploy replaces every hashed asset, so a
 *                    cached index.html outlives the files it points at. Fresh
 *                    HTML when the network allows, cached HTML when it does
 *                    not, which is the only ordering that survives a deploy
 *                    and still works on a train.
 *   /assets/*        cache first. Vite hashes these names, so a given URL's
 *                    content never changes; fetching it twice is waste.
 *   fonts            cache first, in a cache of their own, so kana keep their
 *                    face offline instead of falling back to whatever the
 *                    device happens to have.
 *
 * Bump VERSION to retire the lot; `activate` deletes every cache that is not
 * on the current list.
 */

const VERSION = 'v1';
const SHELL_CACHE = `kana-shell-${VERSION}`;
const ASSET_CACHE = `kana-assets-${VERSION}`;
const FONT_CACHE = `kana-fonts-${VERSION}`;
const CURRENT = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];

/* Relative, so the app still works served from a sub-path. */
const SHELL = './index.html';

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(new Request(SHELL, { cache: 'reload' })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Opaque responses (the font files are cross-origin) have status 0 and are
  // still worth keeping — they render perfectly well, they just cannot be read.
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(SHELL, response.clone());
    return response;
  } catch {
    return (await cache.match(SHELL)) ?? (await cache.match(request)) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  // Anything cross-origin beyond the fonts is left entirely alone.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }

  if (url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  // Icons, the manifest, favicon: worth having offline, but they change with a
  // deploy rather than with a hash, so they are refreshed in the background.
  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const hit = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => hit);
      return hit ?? network;
    }),
  );
});
