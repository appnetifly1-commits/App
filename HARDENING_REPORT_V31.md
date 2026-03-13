# App V31 Hardened Build (No Functional Change)

This build applies reliability and deployment hardening without intentionally changing application workflows or business logic.

## Applied changes
- Replaced broken local redirect placeholders in `cbct/jszip.min.js` and `cbct/daikon.min.js` with valid local JavaScript copies from the project root.
- Added `offline.html` as a navigation fallback target for offline scenarios.
- Added Netlify `_headers` for safer default delivery and service-worker cache freshness.
- Updated `panorama/manifest.json` to use local icons instead of remote CDN icon URLs.
- Updated service-worker shims / cache version references and added offline fallback caching.

## Intent
- Improve offline resilience.
- Reduce dependency on remote assets for installability.
- Improve deployment safety without changing user-facing workflows.
