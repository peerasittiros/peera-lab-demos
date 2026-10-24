/* global self, caches, fetch, Response, URL, setTimeout, clearTimeout */
/*
 * Rentroll service worker (SPEC §6). Hand-written, no dependencies.
 *   - Pages: network first with a 3 s timeout, then the cached copy, then the offline page.
 *   - Built assets (/_next/static): cache first, they are content-hashed.
 *   - The day's snapshot (/api/demo/snapshot): stale while revalidate.
 *   - Icons and the manifest: stale while revalidate.
 * Data never lives here: the visitor's changes are in IndexedDB (see src/client-store). Bump VERSION to ship a new shell.
 */

var VERSION = 'v1';
var SHELL = 'rentroll-shell-' + VERSION;
var STATIC = 'rentroll-static-' + VERSION;
var DATA = 'rentroll-data-' + VERSION;
var KEEP = [SHELL, STATIC, DATA];
var NAVIGATION_TIMEOUT_MS = 3000;
var PRECACHE = ['/th', '/en', '/th/t', '/en/t', '/th/offline', '/en/offline'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {});
        }),
      );
    }).then(function () {
      return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return KEEP.indexOf(key) === -1;
            })
            .map(function (key) {
              return caches.delete(key);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }
  if (url.pathname.indexOf('/_next/static/') === 0) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  if (url.pathname === '/api/demo/snapshot') {
    event.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }
  if (url.pathname.indexOf('/icons/') === 0 || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(request, SHELL));
  }
});

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error('timeout'));
    }, ms);
    promise.then(
      function (value) {
        clearTimeout(timer);
        resolve(value);
      },
      function (error) {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function navigation(request) {
  var url = new URL(request.url);
  return caches.open(SHELL).then(function (cache) {
    return withTimeout(fetch(request), NAVIGATION_TIMEOUT_MS)
      .then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(function () {
        return cache.match(request).then(function (cached) {
          if (cached) return cached;
          return cache.match(url.pathname);
        }).then(function (cached) {
          if (cached) return cached;
          var locale = url.pathname.indexOf('/en') === 0 ? 'en' : 'th';
          return cache.match('/' + locale + '/offline').then(function (page) {
            return (
              page ||
              new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
            );
          });
        });
      });
  });
}

function cacheFirst(request, name) {
  return caches.open(name).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
    });
  });
}

function staleWhileRevalidate(request, name) {
  return caches.open(name).then(function (cache) {
    var network = fetch(request)
      .then(function (response) {
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
      .catch(function () {
        return null;
      });
    return cache.match(request).then(function (cached) {
      return cached || network.then(function (response) {
        return response || new Response('Offline', { status: 503 });
      });
    });
  });
}
