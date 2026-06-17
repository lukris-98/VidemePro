let capabilityPromise = null;

export function hasNativeFFmpegBridge() {
  return Boolean(window.videmeNative?.ffmpeg);
}

export function hasNativeFFprobeBridge() {
  return Boolean(window.videmeNative?.ffprobe);
}

export async function getNativeFFmpegCapabilities() {
  if (!hasNativeFFmpegBridge()) {
    return {
      available: false,
      unavailable: true,
      error: "Native bridge tidak tersedia. Berjalan dalam mode browser.",
      installHint: "Jalankan aplikasi sebagai desktop Electron untuk menggunakan FFmpeg native."
    };
  }
  capabilityPromise ??= window.videmeNative.ffmpeg.getCapabilities().catch((error) => ({
    available: false,
    unavailable: true,
    error: error instanceof Error ? error.message : "Gagal membaca FFmpeg native.",
    installHint: "Pastikan FFmpeg sudah terinstall dan ada di PATH sistem."
  }));
  return capabilityPromise;
}

export function clearCapabilityCache() {
  capabilityPromise = null;
}

export function getFFmpegRuntime(capabilities) {
  if (!hasNativeFFmpegBridge()) return "browser";
  if (!capabilities?.available) return "unavailable";
  return "native";
}

export function chooseBestH264Encoder(capabilities) {
  const text = capabilities?.encodersText || "";
  if (text.includes("h264_nvenc")) return "h264_nvenc";
  if (text.includes("h264_qsv")) return "h264_qsv";
  if (text.includes("h264_amf")) return "h264_amf";
  if (text.includes("libx264")) return "libx264";
  return "default";
}

export function chooseBestH265Encoder(capabilities) {
  const text = capabilities?.encodersText || "";
  if (text.includes("hevc_nvenc")) return "hevc_nvenc";
  if (text.includes("hevc_qsv")) return "hevc_qsv";
  if (text.includes("hevc_amf")) return "hevc_amf";
  if (text.includes("libx265")) return "libx265";
  return null;
}

export function hasEncoder(capabilities, name) {
  return Boolean(capabilities?.encodersText?.includes(name));
}

export function hasDecoder(capabilities, name) {
  return Boolean(capabilities?.decodersText?.includes(name));
}

export function hasFilter(capabilities, name) {
  return Boolean(capabilities?.filtersText?.includes(name));
}

export function buildH264Args({ encoder, crf, input = "{input}", output = "{output}", extraArgs = [] }) {
  const quality = Math.max(1, Math.min(51, Number(crf) || 23));
  if (encoder === "h264_nvenc") {
    return ["-i", input, "-c:v", "h264_nvenc", "-preset", "p4", "-cq:v", String(quality), "-pix_fmt", "yuv420p", "-movflags", "+faststart", ...extraArgs, output];
  }
  if (encoder === "h264_qsv") {
    return ["-i", input, "-c:v", "h264_qsv", "-global_quality", String(quality), "-look_ahead", "1", "-pix_fmt", "nv12", "-movflags", "+faststart", ...extraArgs, output];
  }
  if (encoder === "h264_amf") {
    return ["-i", input, "-c:v", "h264_amf", "-quality", "balanced", "-qp_i", String(quality), "-qp_p", String(quality), "-movflags", "+faststart", ...extraArgs, output];
  }
  if (encoder === "libx264") {
    return ["-i", input, "-c:v", "libx264", "-crf", String(quality), "-preset", "veryfast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", ...extraArgs, output];
  }
  return ["-i", input, "-pix_fmt", "yuv420p", "-movflags", "+faststart", ...extraArgs, output];
}

export async function transcodeBlobNative(blob, { inputExt = "webm", outputExt = "mp4", args, jobId, onProgress }) {
  if (!hasNativeFFmpegBridge()) throw new Error("Native FFmpeg bridge tidak tersedia.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let unsubscribe = null;
  if (jobId && onProgress) {
    unsubscribe = window.videmeNative.ffmpeg.onProgress(jobId, onProgress);
  }
  try {
    const result = await window.videmeNative.ffmpeg.transcodeBuffer({ bytes, inputExt, outputExt, args, jobId });
    if (!result?.ok) throw new Error(result?.error || result?.stderr || "Transcode native gagal.");
    return new Blob([result.bytes], { type: outputExt === "mp4" ? "video/mp4" : "application/octet-stream" });
  } finally {
    unsubscribe?.();
  }
}

export async function cancelNativeJob(jobId) {
  if (!hasNativeFFmpegBridge() || !jobId) return false;
  try {
    const result = await window.videmeNative.ffmpeg.cancelJob(jobId);
    return result?.ok ?? false;
  } catch {
    return false;
  }
}

export async function cancelJob(jobId) {
  if (hasNativeFFmpegBridge()) return cancelNativeJob(jobId);
  try {
    const { cancelWasmJob } = await import("./ffmpegHelper.js");
    cancelWasmJob();
    return true;
  } catch {
    return false;
  }
}

export function parseFFmpegProgress(text) {
  const result = {};
  const timeMatch = text.match(/time=(\d+):(\d+):([\d.]+)/);
  if (timeMatch) {
    result.time = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
  }
  const speedMatch = text.match(/speed=\s*([\d.]+)x/);
  if (speedMatch) result.speed = parseFloat(speedMatch[1]);
  const frameMatch = text.match(/frame=\s*(\d+)/);
  if (frameMatch) result.frame = parseInt(frameMatch[1]);
  const bitrateMatch = text.match(/bitrate=\s*([\d.]+)kbits\/s/);
  if (bitrateMatch) result.bitrate = parseFloat(bitrateMatch[1]);
  return Object.keys(result).length ? result : null;
}

export function calcProgressPercent(progressData, totalDuration) {
  if (!progressData?.time || !totalDuration || totalDuration <= 0) return 0;
  return Math.min(100, Math.round((progressData.time / totalDuration) * 100));
}
