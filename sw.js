/* RRZ SW shim (version-busted v2.10-case-fix)
   Purpose: keep ONE source of truth in /service-worker.js.
*/
try {
  self.importScripts('/service-worker.js?v=rrz-unified-v2.10-case-fix');
} catch (e) {
  self.importScripts('./service-worker.js?v=rrz-unified-v2.10-case-fix');
}
