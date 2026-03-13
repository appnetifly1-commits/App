/* ═══════════════════════════════════════════════════════════════════════════
   RoyalRayZone Unified PWA — Root Service Worker
   Version: rrz-unified-v2.09-pano-fixes

   What changed vs v2.08:
   • CACHE_VERSION bumped → v2.09 to force full refresh and fix Netlify CSS paths
   • All relative paths updated to explicitly use ./ for consistent offline/online rendering
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'rrz-unified-v2.09-pano-fixes';

// ── Cross-origin CDN / font hosts that we are allowed to cache ─────────────
const CROSS_ORIGIN_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

// ── CDN libraries pre-fetched during install ───────
const CROSS_ORIGIN_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/three@0.128.0/build/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/STLExporter.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/daikon/1.2.42/daikon.min.js',
  'https://unpkg.com/daikon@1.2.42/release/current/daikon-min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
];

// ── Core app files — cached during install ──────────────────────────────────
const CORE = [
  './',
  'index.html',
  'subscription.html',
  'agreement.html',
  'patient-registration.html',
  'dashboard.html',
  'dashboard_updated.html',
  'manifest.json',
  'manifest_rrz.webmanifest',
  'offline.html',
  'sw.js',
  'service-worker.js',
  'sw_rrz.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'logo.png',
  'cbct.png',
  'ceph.png',
  'panorama.png',
  'clinic photo.png',
  'voice to report.png',
  'Airway.png',
  'Ask ai.png',
  'referance image.png',
  'referance image2.png',
  'referance image3.png',
  'referance image4.png',
  'referance image5.png',
  'referance image6.png',
  'referance image7.png',
  'referance image8.png',
  'referance image9.png',
  'Surgical_Guide.html',
  'SurgicalGuide.html',
  'surgical_guide.html',
  'Surgical_Guide.png',
  'payment.html',
  'ceph.html',
  'README_FIRST.txt',
  'ROYAL_CEPH_INTEGRATION.md',
  'pano.html',
  'photo.html',
  'analysis.html',
  'cbct.html',
  'cbct_mpr.html',
  'cbct_mpr.png',
  'Airway.html',
  'voice-report.html',
  'ai-assistant.html',
  'workflow.html',
  'workflow2.html',
  'workflow3.html',
  'workflow4.html',
  'workflow5.html',
  'workflow6.html',
  'workflow7.html',
  'workflow8.html',
  'workflow9.html',
  'jszip.min.js',
  'daikon.min.js',
  'shared/aiClient.js',
  'shared/tablet.css',
  'shared/tablet-input.js',
  'panorama/style.css',
  'panorama/app.js',
  'cbct/dashboard.html',
  'cbct/ceph.html',
  'cbct/pano.html',
  'cbct/photo.html',
  'cbct/voice-report.html',
  'cbct/ai-assistant.html',
  'cbct/cbct.html',
  'cbct/cbct_mpr.html',
  'cbct/cbct_mpr.png',
  'cbct/Surgical_Guide.html',
  'cbct/SurgicalGuide.html',
  'cbct/Surgical_Guide.png',
  'cbct/agreement.html',
  'cbct/manifest.json',
  'cbct/jszip.min.js',
  'cbct/daikon.min.js',
  'cbct/icon-192.png',
  'cbct/icon-512.png',
  'cbct/logo.png',
  'cbct/ceph.png',
  'cbct/panorama.png',
  'cbct/cbct.png',
  'cbct/Ask ai.png',
  'cbct/clinic photo.png',
  'cbct/voice to report.png',
  'cbct/shared/tablet.css',
  'cbct/shared/tablet-input.js',
  'cbct/shared/aiClient.js',
  'manifest.cbct.json',
  'segmentation/segmentation.html',
  'segmentation/styles.css',
  'segmentation/app.js',
  'segmentation/worker_auto.js',
  'segmentation/worker_mesh.js',
  'segmentation/daikon.min.js',
  'segmentation/jszip.min.js',
  'segmentation/manifest.json',
  'segmentation/sw.js',
  'segmentation/icons/icon-192.png',
  'segmentation/icons/icon-512.png',
  'segmentation.html',
  'vendor/jszip.min.js',
  'vendor/daikon.min.js',
  'vendor/jspdf.min.js',
];

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function isNavigationRequest(req) {
  return (
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')
  );
}

function isCrossOriginLib(url) {
  return CROSS_ORIGIN_HOSTS.has(url.hostname);
}

function isBlobURL(url) {
  return url.protocol === 'blob:';
}

function isBinaryPayload(req) {
  const ct  = req.headers.get('content-type') || '';
  const url = req.url;
  return (
    ct.includes('octet-stream') ||
    ct.includes('zip') ||
    url.endsWith('.stl') ||
    url.endsWith('.zip') ||
    url.endsWith('.dcm')
  );
}

function isNetlifyFunction(url) {
  return url.pathname.startsWith('/.netlify/functions/');
}

// ════════════════════════════════════════════════════════════════════════════
// INSTALL
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    await Promise.all(
      CORE.map((url) => cache.add(url).catch(() => null))
    );

    Promise.all(
      CROSS_ORIGIN_LIBS.map(async (url) => {
        try {
          const req = new Request(url, { mode: 'cors', credentials: 'omit' });
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) {
            await cache.put(req, res.clone());
          }
        } catch (_) {}
      })
    ).catch(() => null);

    await self.skipWaiting();
  })());
});

// ════════════════════════════════════════════════════════════════════════════
// ACTIVATE
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k)))
    );
    await self.clients.claim();
  })());
});

// ════════════════════════════════════════════════════════════════════════════
// FETCH
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (isNetlifyFunction(url)) return;
  if (isBlobURL(url)) return;
  if (isBinaryPayload(req)) return;

  if (isCrossOriginLib(url)) {
    event.respondWith((async () => {
      const cache  = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);

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

      if (cached) return cached;

      try {
        const fresh = await networkFetch;
        if (fresh) return fresh;
      } catch (_) {}

      return new Response('CDN resource unavailable offline', { status: 503 });
    })());
    return;
  }

  if (isNavigationRequest(req)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone()).catch(() => null);
        return fresh;
      } catch (_) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return (
          (await caches.match('segmentation.html')) ||
          (await caches.match('index.html')) ||
          new Response('Offline — open while connected first.', { status: 503 })
        );
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const resp  = await fetch(req);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, resp.clone()).catch(() => null);
      return resp;
    } catch (_) {
      return new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
