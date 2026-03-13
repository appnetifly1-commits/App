// ═══════════════════════════════════════════════════════════════════════════
// Royal CBCT Segmentation — Service Worker v9
// Aligned with segmentation.html (sidebar toggle + PWA responsive + cm³ units)
//
// What changed vs v8:
//   • Cache version bumped to v9  →  old caches purged on activate
//   • segmentation.html re-listed (forces refresh for sidebar-toggle build)
//   • Sidebar toggle: no SW change needed — purely DOM/CSS in-page
//   • PWA meta tags + inline manifest blob now embedded in segmentation.html;
//     external sw.js (this file) takes precedence — inline blob SW skipped
//     when window.location.protocol is not 'blob:' (external SW wins)
//   • Volume unit updated to cm³ in-page — no SW impact
//   • Responsive / mobile layout: purely CSS — no SW impact
//   • Google Fonts CSS + gstatic font files cached (offline typography) — unchanged
//   • Stale-While-Revalidate kept for all CDN libs — unchanged
//   • Blob worker URLs, DICOM ZIPs, and STL binary downloads always bypass — unchanged
//   • Message SKIP_WAITING handler retained for update-on-reload UX — unchanged
// ═══════════════════════════════════════════════════════════════════════════

const CACHE = 'rrz-cbct-seg-v9';

// ── Local assets (origin-relative) ─────────────────────────────────────────
// Inline blob workers are NOT listed — they are never intercepted.
// Note: segmentation.html now embeds a blob-SW registration as fallback;
// this external sw.js takes full precedence when properly deployed.
const LOCAL_ASSETS = [
  './',
  './segmentation.html',      // sidebar toggle + PWA responsive + cm³ units
  './sw.js',
  './manifest.json',

  // Vendor libs — ship alongside HTML for true offline use.
  // If any vendor file is absent the install still succeeds (silent fail).
  './vendor/jszip.min.js',
  './vendor/daikon.min.js',
  './vendor/jspdf.min.js',    // optional local copy of jsPDF 2.5.1

  // PWA icons
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── CDN libs — cached on first fetch, served cache-first thereafter ─────────
// Both preferred URL and unpkg fallback are listed so either gets cached
// whichever the browser fetches first.
const CDN_LIBS = [
  // Three.js r128
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/three@0.128.0/build/three.min.js',

  // JSZip 3.10.1
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',

  // daikon 1.2.42
  'https://cdnjs.cloudflare.com/ajax/libs/daikon/1.2.42/daikon.min.js',
  'https://unpkg.com/daikon@1.2.42/release/current/daikon-min.js',

  // jsPDF 2.5.1
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
];

// ── Google Fonts — cached for offline typography ────────────────────────────
// The CSS import in segmentation.html uses Space Mono + DM Sans.
// We attempt to pre-cache both; failures are silently ignored.
const FONT_CSS = [
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap',
];

// ── Hosts whose responses we are allowed to cache ──────────────────────────
const CDN_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

// ════════════════════════════════════════════════════════════════════════════
// INSTALL — pre-cache local assets + CDN libs + fonts
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);

    // 1) Local assets — silent fail per-file (missing icon ≠ broken install)
    await Promise.all(
      LOCAL_ASSETS.map((url) => cache.add(url).catch(() => null))
    );

    // 2) CDN libs — fetch with CORS, store clone
    await Promise.all(
      CDN_LIBS.map(async (url) => {
        try {
          const req = new Request(url, { mode: 'cors', credentials: 'omit' });
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) {
            await cache.put(req, res.clone());
          }
        } catch (_) {
          // CDN unreachable at install time — will be cached on first online use
        }
      })
    );

    // 3) Google Fonts CSS — fire-and-forget (non-blocking)
    Promise.all(
      FONT_CSS.map(async (url) => {
        try {
          const req = new Request(url, { mode: 'cors', credentials: 'omit' });
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) {
            await cache.put(req, res.clone());
          }
        } catch (_) {}
      })
    ).catch(() => null);

    self.skipWaiting();
  })());
});

// ════════════════════════════════════════════════════════════════════════════
// ACTIVATE — delete all old caches
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k === CACHE ? null : caches.delete(k)))
    );
    self.clients.claim();
  })());
});

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/** True for HTML navigation requests */
function isNavigate(req) {
  return (
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')
  );
}

/** True for known CDN / font hosts */
function isCDN(url) {
  return CDN_HOSTS.has(url.hostname);
}

/** Blob worker URLs — never intercept */
function isBlob(url) {
  return url.protocol === 'blob:';
}

/**
 * Large binary payloads (DICOM ZIP uploads, STL downloads, ArrayBuffers).
 * These are never cached — they would bloat the cache instantly.
 */
function isBinaryPayload(req) {
  const ct = req.headers.get('content-type') || '';
  const url = req.url;
  return (
    ct.includes('octet-stream') ||
    ct.includes('zip') ||
    url.endsWith('.stl') ||
    url.endsWith('.zip') ||
    url.endsWith('.dcm')
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FETCH — routing table
//
//  blob:          → pass-through (inline workers)
//  binary upload  → pass-through (DICOM / STL)
//  CDN / fonts    → Stale-While-Revalidate  (instant after first visit)
//  HTML navigate  → Network-first → cache fallback  (always fresh when online)
//  same-origin    → Cache-first → network  (fast static assets)
//  other origin   → pass-through
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ── blob: worker URLs — never intercept ────────────────────────────────
  if (isBlob(url)) return;

  // ── Large binary payloads — bypass SW ──────────────────────────────────
  if (isBinaryPayload(req)) return;

  // ── CDN libs + Google Fonts: Stale-While-Revalidate ────────────────────
  // Return cached copy immediately; refresh cache in background.
  if (isCDN(url)) {
    e.respondWith((async () => {
      const cache  = await caches.open(CACHE);
      const cached = await cache.match(req);

      // Background revalidation — fire and forget
      const networkFetch = fetch(
        new Request(req.url, { mode: 'cors', credentials: 'omit' })
      )
        .then((fresh) => {
          if (fresh && (fresh.ok || fresh.type === 'opaque')) {
            cache.put(req, fresh.clone()).catch(() => null);
          }
          return fresh;
        })
        .catch(() => null);

      if (cached) return cached;          // cache hit: instant response

      // Cache miss (first visit / install fail): wait for network
      try {
        const fresh = await networkFetch;
        if (fresh) return fresh;
      } catch (_) {}

      return new Response('CDN resource unavailable offline', { status: 503 });
    })());
    return;
  }

  // ── Same-origin HTML navigation: Network-first → cache fallback ─────────
  // Ensures users always receive the latest segmentation.html when online,
  // while still loading correctly when offline.
  if (isNavigate(req)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      } catch (_) {
        return (
          (await cache.match(req)) ||
          (await cache.match('./segmentation.html')) ||
          new Response('Offline — open while connected first.', { status: 503 })
        );
      }
    })());
    return;
  }

  // ── Unknown cross-origin: pass-through ──────────────────────────────────
  if (url.origin !== self.location.origin) return;

  // ── Same-origin static assets: Cache-first → network ────────────────────
  e.respondWith((async () => {
    const cache  = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) cache.put(req, fresh.clone()).catch(() => null);
      return fresh;
    } catch (_) {
      return new Response('Offline', { status: 503 });
    }
  })());
});

// ════════════════════════════════════════════════════════════════════════════
// MESSAGE — page triggers immediate SW swap after update
// Usage: navigator.serviceWorker.controller.postMessage('SKIP_WAITING')
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
