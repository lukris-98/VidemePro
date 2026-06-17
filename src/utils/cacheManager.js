const CACHE_FOLDER_STRUCTURE = {
  thumbnails: "thumbnails",
  waveform: "waveform",
  proxies: "proxies",
  previewFrames: "preview-frames",
  renders: "renders"
};

let cacheStats = {
  thumbnails: 0,
  waveform: 0,
  proxies: 0,
  previewFrames: 0,
  renders: 0
};

export function getCacheStats() {
  return { ...cacheStats };
}

export async function makeProxy(mediaFile, { height = 540, onProgress } = {}) {
  if (!window.videmeNative?.ffmpeg) throw new Error("FFmpeg native tidak tersedia.");
  const bytes = new Uint8Array(await mediaFile.arrayBuffer());
  const ext = mediaFile.name.split(".").pop() || "mp4";
  const jobId = crypto.randomUUID();
  let unsubscribe = null;
  if (onProgress) {
    unsubscribe = window.videmeNative.ffmpeg.onProgress(jobId, onProgress);
  }
  try {
    const result = await window.videmeNative.ffmpeg.transcodeBuffer({
      bytes,
      inputExt: ext,
      outputExt: "mp4",
      jobId,
      args: [
        "-i", "{input}",
        "-vf", `scale=-2:${height}`,
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:a", "128k",
        "{output}"
      ]
    });
    if (!result?.ok) throw new Error(result?.error || "Gagal membuat proxy.");
    return new Blob([result.bytes], { type: "video/mp4" });
  } finally {
    unsubscribe?.();
  }
}

export async function makeAudioProxy(mediaFile) {
  if (!window.videmeNative?.ffmpeg) throw new Error("FFmpeg native tidak tersedia.");
  const bytes = new Uint8Array(await mediaFile.arrayBuffer());
  const ext = mediaFile.name.split(".").pop() || "mp4";
  const result = await window.videmeNative.ffmpeg.transcodeBuffer({
    bytes,
    inputExt: ext,
    outputExt: "wav",
    args: ["-i", "{input}", "-vn", "-c:a", "pcm_s16le", "-ar", "44100", "{output}"]
  });
  if (!result?.ok) throw new Error(result?.error || "Gagal membuat audio proxy.");
  return new Blob([result.bytes], { type: "audio/wav" });
}

export function computeRenderCacheKey(clip, mediaItem, settings) {
  const key = JSON.stringify({
    mediaId: mediaItem?.id,
    lastModified: mediaItem?.file?.lastModified,
    size: mediaItem?.file?.size,
    filters: clip?.filters,
    effects: clip?.effects,
    transform: clip?.transform,
    settings
  });
  return btoa(key).slice(0, 32);
}
