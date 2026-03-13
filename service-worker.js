/* ═══════════════════════════════════════════════════════════════════════════
   RoyalRayZone Unified PWA — Root Service Worker
   Version: rrz-unified-v2.08-ceph-fixes

   What changed vs v2.06:
   • CACHE_VERSION bumped → v2.08 to force full refresh on all clients
   • ceph.html — four cephalometric calculation fixes (all cumulative):
       1. Cant of Occlusal Plane: replaced dot-product calculateAngle() with
          atan2 slope-difference formula; removed from normalizeAngleToMean
          (was 0.6°, now correctly ~4.6°)
       2. Facial Angle (Downs): FH vector direction corrected to Or→Po;
          removed from normalizeAngleToMean
          (was 85°, now correctly ~95.5°)
       3. Angle of Convexity: sign now auto-detects face orientation from
          Or/Po landmarks (Or always anterior to Po) — works correctly for
          both face-left and face-right images
          (was hardcoded face-left which flipped sign on face-right images)
       4. Wits Appraisal: mean updated −0.3→0.1, SD updated 2.7→1.9
   • sw.js version-bust updated to v2.08
   • All CDN libs, font caching, SWR strategy — unchanged from v2.06
   • Blob worker bypass, binary payload bypass — unchanged from v2.06
   • SKIP_WAITING message handler retained
   ═══════════════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'rrz-unified-v2.08-ceph-fixes';

// ── Cross-origin CDN / font hosts that we are allowed to cache ─────────────
const CROSS_ORIGIN_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

// ── CDN libraries pre-fetched during install (segmentation.html + SurgicalGuide.html deps) ───────
const CROSS_ORIGIN_LIBS = [
  // Three.js core r128
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/three@0.128.0/build/three.min.js',

  // Three.js examples used by SurgicalGuide.html
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/TransformControls.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/exporters/STLExporter.js',

  // Tailwind CDN runtime used by SurgicalGuide.html
  'https://cdn.tailwindcss.com',

  // JSZip 3.10.1
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://unpkg.com/jszip@3.10.1/dist/jszip.min.js',

  // daikon 1.2.42
  'https://cdnjs.cloudflare.com/ajax/libs/daikon/1.2.42/daikon.min.js',
  'https://unpkg.com/daikon@1.2.42/release/current/daikon-min.js',

  // jsPDF 2.5.1
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',

  // html2canvas used by SurgicalGuide surgical PDF export
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',

  // Font Awesome icons used by SurgicalGuide.html
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',

  // Google Fonts
  'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&display=swap',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
];

// ── Core app files — cached during install ──────────────────────────────────
// Every file is cached defensively (silent fail per file).
// Missing assets never break install / activation.
const CORE = [
  // ── Root app shell ──────────────────────────────────────────────────────
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
  'sw.js',                      // segmentation SW v9
  'service-worker.js',          // this file
  'sw_rrz.js',
  'icons/icon-192.png',
  'icons/icon-512.png',

  // ── Root images / branding ──────────────────────────────────────────────
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

  // ── Root app pages ──────────────────────────────────────────────────────
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

  // ── Root vendor libs (for non-segmentation pages that import directly) ──
  'jszip.min.js',
  'daikon.min.js',

  // ── Shared modules ──────────────────────────────────────────────────────
  'shared/aiClient.js',
  'shared/tablet.css',
  'shared/tablet-input.js',

  // ── Panorama sub-app ────────────────────────────────────────────────────
  'panorama/style.css',
  'panorama/app.js',

  // ── /cbct sub-folder (legacy deployment) ────────────────────────────────
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

  // ── Segmentation module — legacy folder build ────────────────────────────
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

  // ── Segmentation — current single-file build (root) ─────────────────────
  // sidebar toggle + full PWA responsive layout + cm³ volume units
  'segmentation.html',
  'vendor/jszip.min.js',
  'vendor/daikon.min.js',
  'vendor/jspdf.min.js',        // required by segmentation.html
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

/** Skip caching for large binary uploads/downloads — DICOM ZIPs, STL files */
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

/** Never cache Netlify Functions/API traffic */
function isNetlifyFunction(url) {
  return url.pathname.startsWith('/.netlify/functions/');
}

// ════════════════════════════════════════════════════════════════════════════
// INSTALL — pre-cache CORE assets + CDN libs for segmentation
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);

    // 1) Core app files — silent fail per file so install always succeeds
    await Promise.all(
      CORE.map((url) => cache.add(url).catch(() => null))
    );

    // 2) CDN libs for segmentation — CORS fetch, store in same cache
    //    Fire-and-forget so CDN hiccups never block install.
    Promise.all(
      CROSS_ORIGIN_LIBS.map(async (url) => {
        try {
          const req = new Request(url, { mode: 'cors', credentials: 'omit' });
          const res = await fetch(req);
          if (res && (res.ok || res.type === 'opaque')) {
            await cache.put(req, res.clone());
          }
        } catch (_) {
          // Unreachable at install time — cached on first online visit
        }
      })
    ).catch(() => null);

    await self.skipWaiting();
  })());
});

// ════════════════════════════════════════════════════════════════════════════
// ACTIVATE — purge stale caches
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
// FETCH — routing table
//
//  blob:            → pass-through  (inline Web Workers from segmentation)
//  binary payload   → pass-through  (DICOM ZIPs, STL downloads)
//  CDN / fonts      → Stale-While-Revalidate  (instant after first visit)
//  HTML navigation  → Network-first → cache fallback
//  same-origin      → Cache-first   → network  → offline response
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // ── Netlify Functions/API — always network, never cache ───────────────
  if (isNetlifyFunction(url)) return;

  // ── Blob worker URLs — never intercept (segmentation inline workers) ────
  if (isBlobURL(url)) return;

  // ── Binary payloads — bypass completely ────────────────────────────────
  if (isBinaryPayload(req)) return;

  // ── CDN / Google Fonts: Stale-While-Revalidate ─────────────────────────
  // Return cached copy immediately; silently refresh cache in background.
  if (isCrossOriginLib(url)) {
    event.respondWith((async () => {
      const cache  = await caches.open(CACHE_VERSION);
      const cached = await cache.match(req);

      // Background network refresh — fire and forget
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

      if (cached) return cached;          // instant cache hit

      // First visit / install miss — wait for network
      try {
        const fresh = await networkFetch;
        if (fresh) return fresh;
      } catch (_) {}

      return new Response('CDN resource unavailable offline', { status: 503 });
    })());
    return;
  }

  // ── HTML navigation: Network-first → cache fallback ─────────────────────
  // Prioritises fresh UI; gracefully degrades when offline.
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
        // Attempt well-known fallbacks in priority order
        return (
          (await caches.match('segmentation.html')) ||
          (await caches.match('index.html')) ||
          new Response('Offline — open while connected first.', { status: 503 })
        );
      }
    })());
    return;
  }

  // ── Same-origin static assets: Cache-first → network ────────────────────
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

// ════════════════════════════════════════════════════════════════════════════
// MESSAGE — page triggers immediate SW swap after update detection
// Usage: navigator.serviceWorker.controller.postMessage('SKIP_WAITING')
// ════════════════════════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
