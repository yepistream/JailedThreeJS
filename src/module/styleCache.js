// styleCache.js
//
// Shared stylesheet-derived cache versioning for selector/keyframe/asset lookups.

let globalStyleCacheVersion = 0;

export function getGlobalStyleCacheVersion() {
  return globalStyleCacheVersion;
}

export function markGlobalStyleCacheDirty() {
  globalStyleCacheVersion += 1;
  return globalStyleCacheVersion;
}
