const frameCache = new Map();
const MAX_CACHE_SIZE = 50;

function makeCacheKey(mediaId, timestamp, filterHash) {
  return `${mediaId}:${timestamp.toFixed(3)}:${filterHash}`;
}

function hashFilters(filters) {
  return JSON.stringify(filters || {});
}

function evictIfNeeded() {
  if (frameCache.size <= MAX_CACHE_SIZE) return;
  const oldest = frameCache.keys().next().value;
  const entry = frameCache.get(oldest);
  if (entry?.url) URL.revokeObjectURL(entry.url);
  frameCache.delete(oldest);
}

export async function extractFrameCanvas(videoElement, timestamp) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      videoElement.removeEventListener("seeked", onSeeked);
      const canvas = document.createElement("canvas");
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoElement, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(URL.createObjectURL(blob));
        else reject(new Error("Gagal membuat blob dari canvas"));
      }, "image/jpeg", 0.92);
    };
    videoElement.addEventListener("seeked", onSeeked, { once: true });
    videoElement.currentTime = timestamp;
  });
}

export async function getFFmpegAccurateFrame(mediaId, mediaFile, timestamp, filters) {
  const filterHash = hashFilters(filters);
  const cacheKey = makeCacheKey(mediaId, timestamp, filterHash);

  if (frameCache.has(cacheKey)) {
    return frameCache.get(cacheKey).url;
  }

  if (!window.videmeNative?.ffmpeg) return null;

  try {
    const bytes = new Uint8Array(await mediaFile.arrayBuffer());
    const ext = mediaFile.name.split(".").pop() || "mp4";
    const filterArgs = buildPreviewFilterArgs(filters);
    const args = [
      "-ss", String(timestamp),
      "-i", "{input}",
      ...filterArgs,
      "-frames:v", "1",
      "-q:v", "2",
      "{output}"
    ];
    const result = await window.videmeNative.ffmpeg.transcodeBuffer({
      bytes,
      inputExt: ext,
      outputExt: "jpg",
      args
    });
    if (!result?.ok) return null;
    const blob = new Blob([result.bytes], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    evictIfNeeded();
    frameCache.set(cacheKey, { url, blob });
    return url;
  } catch {
    return null;
  }
}

function buildPreviewFilterArgs(filters, effects) {
  if (!filters && !effects) return [];
  const chain = [];
  if (filters) {
    const brightness = (filters.brightness || 0) / 100;
    const contrast = 1 + (filters.contrast || 0) / 100;
    const saturation = 1 + (filters.saturation || 0) / 100;
    if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
      chain.push(`eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);
    }
    if (filters.hue && filters.hue !== 0) chain.push(`hue=h=${filters.hue}`);
    if (filters.vignette && filters.vignette > 0) {
      const angle = (Math.PI / 5) * (filters.vignette / 100);
      chain.push(`vignette=angle=${angle.toFixed(4)}`);
    }
  }
  if (effects?.blur && effects.blur > 0) chain.push(`gblur=sigma=${effects.blur}`);
  if (chain.length === 0) return [];
  return ["-vf", chain.join(",")];
}

export async function getFFmpegAccurateFrameWithFilters(mediaId, mediaFile, timestamp, filters, effects) {
  const filterHash = hashFilters({ ...filters, ...effects });
  const cacheKey = makeCacheKey(mediaId, timestamp, filterHash);
  if (frameCache.has(cacheKey)) return frameCache.get(cacheKey).url;
  if (!window.videmeNative?.ffmpeg) return null;
  try {
    const bytes = new Uint8Array(await mediaFile.arrayBuffer());
    const ext = mediaFile.name.split(".").pop() || "mp4";
    const filterArgs = buildPreviewFilterArgs(filters, effects);
    const args = ["-ss", String(timestamp), "-i", "{input}", ...filterArgs, "-frames:v", "1", "-q:v", "2", "{output}"];
    const result = await window.videmeNative.ffmpeg.transcodeBuffer({ bytes, inputExt: ext, outputExt: "jpg", args });
    if (!result?.ok) return null;
    const blob = new Blob([result.bytes], { type: "image/jpeg" });
    const url = URL.createObjectURL(blob);
    evictIfNeeded();
    frameCache.set(cacheKey, { url, blob });
    return url;
  } catch {
    return null;
  }
}

export async function drawFFmpegFrameToCanvas(canvas, mediaId, mediaFile, timestamp, filters, effects) {
  const url = await getFFmpegAccurateFrameWithFilters(mediaId, mediaFile, timestamp, filters, effects);
  if (!url) return false;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(true);
    };
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function clearFrameCache() {
  for (const entry of frameCache.values()) {
    if (entry?.url) URL.revokeObjectURL(entry.url);
  }
  frameCache.clear();
}
