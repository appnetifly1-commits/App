# RoyalRayZone App_V8 — HARA + FMEA + Code/Function Map

> **Update (CDS):** See `RRZ_V8_CDS_SAFETY_PACK.md` for an expanded CDS-oriented HARA/FMEA suitable for Radiologists + General Dentists.

**Scope:** App_V8 (PWA) — Dashboard + Ceph + Pano + CBCT + Airway + Voice Report + Photo Workflows.

**Policy (patch-safe):** أي تغيير مقصود هنا هو لمنع الأعطال (Crash/Errors)، تحسين التوافق على الموبايل، وضمان تحديث الـPWA. لا تغيير في الوظائف/النتائج/التقارير.

---

## 1) Code/Function Map (خريطة وظائف مختصرة)

### 1.1 App shell
- **index.html**: بوابة الدخول.
- **dashboard.html**: صفحة التشغيل الرئيسية وروابط جميع الموديولات.
- **manifest.json**: إعداد PWA (standalone + orientation).
- **service-worker.js** و **sw.js**: Service Worker موحدان لنفس الاستراتيجية (network-first للـ HTML، cache-first للباقي).

### 1.2 Imaging modules
- **ceph.html**: Cephalometric analysis.
- **pano.html** + **panorama/**: Panoramic workflows + AI report integration (via shared/aiClient.js).
- **cbct.html**: CBCT viewer (ZIP unzipping + DICOM parsing) يعتمد على **jszip.min.js** و **daikon.min.js**.
- **Airway.html**: Airway module (CBCT panels + polygon ROI + volume + snapshots + report) ويعتمد كذلك على jszip/daikon.
- **voice-report.html**: Voice to report workflows.
- **workflow*.html** و **photo.html**: Photo workflows.

### 1.3 Reports
- **Airway/CBCT reports**: Snapshots → Show Report → (PDF export إن وُجد داخل الصفحة).

---

## 2) HARA (Hazard Analysis & Risk Assessment) — مختصر

> ملاحظة: لأن التطبيق ليس جهازًا طبيًا مُعتمدًا، استخدمنا منهجية HARA مُبسطة: hazard → causes → effects → controls → residual risk.

### H1 — نتائج قياس غير صحيحة (Area/Volume)
- **Causes:** mapping خاطئ من screen→image، استخدام CSS scaling في الحساب، تجاهل PixelSpacing.
- **Effects:** تقرير مضلل.
- **Controls:** الحسابات يجب أن تكون في image-space ثم تحويل بوحدات DICOM؛ تثبيت pointer mapping (touch/pointer)؛ إظهار تنبيه أن النتائج للمساعدة.
- **Residual risk:** متوسط (يتطلب مراجعة الطبيب).

### H2 — فشل فتح ZIP/DICOM
- **Causes:** ZIP بلا DICOM، ملفات corrupt، missing metadata.
- **Effects:** توقف workflow.
- **Controls:** تحقق مبكر برسالة واضحة؛ fallback parsing؛ عدم إيقاف الصفحة (no uncaught exceptions).
- **Residual risk:** منخفض.

### H3 — Crash/Freeze على الموبايل
- **Causes:** memory pressure من صور/arrays كبيرة؛ تسريب URLs؛ Canvas re-render متكرر.
- **Effects:** خروج المتصفح.
- **Controls:** release resources عند new case؛ avoid caching blobs؛ defensive guards.
- **Residual risk:** منخفض إلى متوسط حسب حجم البيانات.

### H4 — PWA يقدم نسخة قديمة (Stale cache)
- **Causes:** cache-first للـ HTML أو version ثابت.
- **Effects:** المستخدم يرى Bugs تم إصلاحها.
- **Controls:** network-first للـ HTML + bump CACHE_VERSION.
- **Residual risk:** منخفض.

### H5 — تعارض Service Workers
- **Causes:** تسجيل sw.js و service-worker.js مع اختلاف محتوى.
- **Effects:** سلوك offline غير متوقع.
- **Controls:** توحيد المحتوى والنسخة بينهما.
- **Residual risk:** منخفض.

---

## 3) FMEA (Failure Modes & Effects Analysis) — مختصر

| Failure mode | Effect | Likely cause | Detection | Mitigation |
|---|---|---|---|---|
| ZIP load fails | لا تظهر السلايس | ZIP بلا DICOM / parsing fail | toast/alert + console | رسائل واضحة + guards |
| Null DOM ref | crash | element id missing / timing | console error | guard + early return |
| Touch not working | عدم وضع نقاط polygon | اعتماد على mouse only | user report | pointer/touch mapping |
| Snapshot 3D black | تقرير ناقص | WebGL buffer not preserved | snapshot = blank | preserveDrawingBuffer + overlay |
| PWA stale UI | bug يظهر رغم إصلاحه | cache version ثابت | user report | bump cache + network-first HTML |

---

## 4) Hardening checklist (تشغيل بدون كراش)

1) **Service Worker**: نسخة واحدة من الاستراتيجية + bump version عند أي تحديث UI/JS.
2) **Core libs cached**: jszip.min.js + daikon.min.js ضمن CORE.
3) **Guards**: أي `getElementById` يجب أن يُفحص قبل الاستخدام.
4) **Mobile pointer**: استخدام Pointer Events أو bridge touch→mouse.
5) **Memory**: عند New Case يجب تحرير arrays والـ object URLs.

