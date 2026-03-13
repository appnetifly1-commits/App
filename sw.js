/* RRZ SW shim (version-busted v2.08-ceph-fixes)
   Purpose: keep ONE source of truth in /service-worker.js.
*/
try {
  self.importScripts('/service-worker.js?v=rrz-unified-v2.08-ceph-fixes');
} catch (e) {
  self.importScripts('./service-worker.js?v=rrz-unified-v2.08-ceph-fixes');
}
