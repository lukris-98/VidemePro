export async function getCacheDir(subdir) {
  if (window.videmeNative?.cache?.getDir) return window.videmeNative.cache.getDir(subdir);
  return null;
}

export async function clearCache(subdir) {
  if (window.videmeNative?.cache?.clear) return window.videmeNative.cache.clear(subdir);
  return { ok: false, error: "Cache tidak tersedia di mode browser." };
}

export async function getCacheSize() {
  if (window.videmeNative?.cache?.size) return window.videmeNative.cache.size();
  return { ok: false, bytes: 0 };
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export async function makeProxy(inputPath, height = 540, jobId) {
  if (!window.videmeNative?.proxy?.make) return { ok: false, error: "Proxy tidak tersedia di mode browser." };
  return window.videmeNative.proxy.make({ inputPath, height, jobId });
}

export async function makeProxy720(inputPath, jobId) {
  return makeProxy(inputPath, 720, jobId);
}

export function buildCacheInvalidationKey(media, filterHash, renderSettingsHash) {
  const path = media?.file?.path || media?.filePath || media?.id || "";
  const size = media?.size || 0;
  const mtime = media?.lastModified || media?.file?.lastModified || 0;
  return `${path}:${size}:${mtime}:${filterHash || ""}:${renderSettingsHash || ""}`;
}
