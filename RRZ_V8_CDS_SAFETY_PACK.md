# RoyalRayZone App_V8 — CDS Safety Pack (HARA + FMEA + Code/Function Map)

**Date:** 2026-02-03  
**Product:** RoyalRayZone (RRZ) App_V8 — PWA (Dashboard + Ceph + Pano + CBCT + Airway + Voice Report + Photo Workflows)  
**Intended Users:** Radiologists + General Dentists (all dentists)  
**Clinical Role:** **Clinical Decision Support (CDS)** — *Final clinical decision remains with the clinician.*

> **Patch-safe rule:** This document proposes controls/mitigations. Any code edits performed in App_V8 are **hardening-only** (crash prevention, compatibility, caching correctness) and **do not change clinical outputs** intentionally.

---

## 0) Intended Use & Claims Boundary

### 0.1 Intended use (allowed scope)
RRZ assists clinicians by:
- Viewing dental images (2D/CBCT),
- Performing measurements (angles, areas, volumes where implemented),
- Generating structured reports and snapshots,
- Surfacing AI-generated *assistive* text that clinicians review and edit.

### 0.2 What RRZ must NOT claim
- Autonomous diagnosis or treatment decisions,
- Guarantee of accuracy on all devices / all imaging protocols,
- Replacement of clinician judgment.

### 0.3 User-facing wording (recommended)
- “For clinical support only. Verify findings and measurements clinically and radiographically.”
- “AI outputs are suggestions; clinician remains responsible.”

---

## 1) System Overview (Technical)

### 1.1 App shell & distribution
- **PWA**: `manifest.json` (standalone, orientation), Service Worker (`service-worker.js` and `sw.js`)
- **Caching strategy**: HTML network-first; static assets cache-first; versioned cache key.

### 1.2 Imaging modules (high level)
- **Ceph**: landmark placement + ceph metrics + report.
- **Pano**: panoramic workflows + AI report integration.
- **CBCT**: ZIP upload → unzip (JSZip) → parse DICOM (Daikon) → multi-panel viewer + tools.
- **Airway**: CBCT panels + polygon ROI + volume + 3D view + snapshots + report.
- **Voice Report / Photo workflows**: capture + annotate + summarize.

### 1.3 Data types
- DICOM slices (CBCT), images (JPG/PNG), user annotations (points, polygons), derived metrics (mm/deg/mm²/cm³), report snapshots.

---

## 2) HARA (Hazard Analysis & Risk Assessment) — CDS-oriented

### 2.1 Scales
**Severity (S)**  
1=negligible, 2=minor, 3=moderate, 4=serious, 5=critical

**Exposure/Occurrence (O)**  
1=rare, 2=uncommon, 3=possible, 4=likely, 5=frequent

**Detectability (D)** (lower is better)  
1=very detectable, 2=detectable, 3=moderate, 4=hard, 5=very hard

**Risk Priority Number:** RPN = S × O × D  
Guidance: RPN ≥ 40 = prioritize controls; RPN ≥ 60 = immediate controls.

### 2.2 Hazard register (core)

| ID | Hazard | Example clinical impact | Primary causes | Existing controls | Recommended controls (process/UX/tech) | S | O | D | RPN |
|---|---|---|---|---|---|---:|---:|---:|---:|
| H-01 | **Incorrect measurement** (area/volume/angles) | Wrong assessment of airway constriction / ortho plan | wrong mapping screen→image; wrong pixel spacing; slice thickness misuse | image-space calculations; DICOM spacing use where available | show spacing source; warn on missing spacing; calibration/QA dataset; unit tests for mapping | 4 | 3 | 3 | 36 |
| H-02 | **Wrong patient/case mix-up** (report snapshots) | Report attached to wrong patient | multi-tab use; stale state; snapshots not cleared | “New Case” clears state | enforce case header (ID/date) in report; confirm before exporting PDF | 4 | 2 | 4 | 32 |
| H-03 | **AI hallucination / wrong narrative** | Misleading text in report | LLM output without verification | clinician final decision | label AI as assistive; require clinician review checkbox (process); keep raw findings visible | 4 | 3 | 3 | 36 |
| H-04 | **Failure to open/parse DICOM ZIP** | Delayed workflow, missed time | corrupted ZIP; unsupported DICOM; missing tags | error messages + guards | provide clear “why” + troubleshooting; detect non-DICOM early; telemetry (optional) | 2 | 4 | 2 | 16 |
| H-05 | **Crash/Freeze on mobile** | Lost work, delayed reporting | memory pressure (large CBCT); repeated canvas renders | reset/new case; resource release (partial) | progressive loading; cap max slices; warn on huge cases; perf budget + monitoring | 2 | 4 | 3 | 24 |
| H-06 | **Stale PWA cache** (user sees old code) | Reappearing bugs, inconsistent results | cache version not bumped; SW conflict | versioned cache | bump version each release; unify SW scripts; add “build stamp” in UI (optional) | 3 | 3 | 4 | 36 |
| H-07 | **Touch/pointer mismatch** (wrong ROI points) | Wrong ROI leading to wrong volume | touch events not mapped correctly | pointer/touch bridge | use Pointer Events everywhere; add “magnifier” on mobile for точность | 3 | 3 | 3 | 27 |
| H-08 | **Security/privacy leak** | Patient data exposure | insecure hosting; logs; third-party endpoints | none guaranteed by app | data minimization; avoid storing PHI in logs; HTTPS only; documented retention & consent | 5 | 2 | 4 | 40 |
| H-09 | **Clinical over-reliance** | Clinician follows tool blindly | unclear labeling | none | “CDS only” labeling; training; onboarding; include limitations section in report | 4 | 2 | 4 | 32 |

**Top priorities (RPN≥40):** H-08 (privacy/security).  
**Medium priorities (RPN≈36):** H-01/H-03/H-06 (measurement + AI narrative + stale cache).

---

## 3) FMEA (Failure Modes & Effects Analysis) — engineering-oriented

### 3.1 FMEA scoring
- **Severity (S)**: impact to workflow/clinical decision support
- **Occurrence (O)**: likelihood in real-world use
- **Detection (D)**: likelihood to detect before user impact
- **RPN = S×O×D**

### 3.2 FMEA table (selected high-value)

| Subsystem | Failure mode | Effect | Cause | Detection | Current control | Recommended action | S | O | D | RPN |
|---|---|---|---|---|---|---|---:|---:|---:|---:|
| PWA/SW | HTML served from cache (stale) | user sees old bugs | cache-first HTML; version not bumped | user report | network-first HTML; version bump | enforce release bump; unify SW; add update prompt | 3 | 3 | 4 | 36 |
| Assets | Case icon missing (Airway) | broken UI | filename case mismatch | visual | partial caching | normalize filenames in CORE cache | 1 | 3 | 1 | 3 |
| ZIP Loader | no DICOM found | cannot start case | ZIP structure; non-DICOM | runtime toast | early checks | improved message + sample ZIP guide | 2 | 4 | 2 | 16 |
| DICOM | missing PixelSpacing | wrong units | missing tags | unit anomaly | fallback defaults (if any) | warn + disable “cm³” claim unless spacing known | 4 | 2 | 4 | 32 |
| Canvas | null element access | crash | DOM timing | console error | guards in many spots | add guards to every query; fail soft | 2 | 3 | 2 | 12 |
| Touch | polygon placement fails | ROI impossible | mouse-only handlers | user sees | touch bridge | migrate to Pointer Events; test matrix | 3 | 3 | 3 | 27 |
| WebGL | 3D snapshot black | report missing | preserveDrawingBuffer false | snapshot blank | preserveDrawingBuffer | add fallback readPixels if needed | 1 | 3 | 2 | 6 |
| Memory | mobile crash on huge CBCT | work loss | large arrays; leaks | app closes | new case reset | revoke objectURLs; free arrays; downsample preview | 2 | 3 | 4 | 24 |
| AI | upstream key missing | AI features fail | env misconfig | response error | error surface | preflight endpoint + actionable error | 2 | 3 | 1 | 6 |
| Reporting | PDF export fails | report not saved | library missing | user click | download fallback | ensure libs cached; offer image zip export | 2 | 2 | 2 | 8 |

---

## 4) Code/Function Map (V8 snapshot)

> This is a **map for auditing** and regression testing. It does not describe every line; it highlights the functional “spines”.

### 4.1 Airway.html — key function clusters
**Case lifecycle**
- `handleDicomUpload()` → `processDicomData()` → `setupViewports()` → `enterViewerMode()`
- `newCase()` / `hardResetCase()` → clears arrays, masks, snapshots, UI.

**Rendering**
- `renderSlice()` + `generateAxialSlices()` / `generateSagittalSlices()` / `generateCoronalSlices()`
- `initThreeJS()` / `resizeThreeJS()` / `animate()` (3D)

**ROI / Volume**
- `setupCanvasInteractions()` + `getDataCoord()` (screen→image mapping)
- `drawPolygons()` + `fillPolygonInSlice()` + `calculatePolygonArea()`
- `calculateVolume()` + `createAirwayMask()` + `connectSlicesWithWalls()` (3D bulk)

**Mobile support**
- `bridgeTouchToMouse()` / `enableTouch()` + `tryLandscapeLock()` + `setRotateOverlayVisible()`

**Snapshots / Reporting**
- `takeSnapshot()` (per panel)  
- `showReport()` / `delReport()` / `downloadPDF()`

### 4.2 cbct.html — key function clusters
- ZIP: `doLoadZip()`  
- Viewer: `init()` / `renderAll()` / `render()`  
- Mapping: `evtToLocal()` / `scrToImg()` / `imgToScr()`  
- ROI/Volume: `polygonArea()` / `calculateTotalVolume()`  
- Mobile: `tryLandscapeLock()` / `setRotateOverlayVisible()`

### 4.3 Ceph / Voice / Dashboard
- `ceph.html` contains many measurement utilities; auditing focus should be: input landmark capture → compute metrics → report generator.
- `voice-report.html` focus: media capture → transcription → templating → export.

---

## 5) Release & Validation Checklist (for commercial rollout)

### 5.1 Device matrix (minimum)
- Android: Chrome + installed PWA (2-3 devices)
- iOS: Safari + Home Screen web app (if targeted)
- Laptop: Chrome/Edge

### 5.2 Functional smoke tests (must pass)
1) Load each module from dashboard
2) ZIP DICOM load (at least 2 real cases, different vendors)
3) Basic pan/zoom + crosshair sync (CBCT/Airway)
4) Polygon ROI + volume calc + 3D snapshot + report export (Airway)
5) Service worker update: deploy new build → client updates (no stale UI)
6) Offline test: open last module without network (assets served)

### 5.3 Safety/Clinical QA
- Compare measurements against reference software on a small validated set (n≥20) with acceptance bands.
- Document limitations: missing spacing, image artifacts, operator variability.

---

## 6) Notes for regulatory readiness (optional)
If you later pursue formal compliance, align documentation with:
- ISO 14971 (risk management)
- IEC 62304 (software lifecycle)
- IEC 82304-1 (health software product safety)
- FDA CDS guidance / EU MDR classification (depends on claims)

This pack is a **pragmatic CDS baseline**.

