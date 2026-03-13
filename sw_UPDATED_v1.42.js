/* RRZ SW shim (version-busted)
   Purpose: keep ONE source of truth in /service-worker.js.
*/
try {
  self.importScripts('/service-worker.js?v=rrz-unified-v2.05-hardened');
} catch (e) {
  self.importScripts('./service-worker.js?v=rrz-unified-v2.05-hardened');
}
