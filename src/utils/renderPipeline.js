import { chooseBestH264Encoder } from "./ffmpegRuntime.js";

export const EXPORT_PRESETS = {
  "YouTube 1080p": { width: 1920, height: 1080, fps: 30, crf: 20, encoder: "libx264", preset: "veryfast", audioBitrate: "192k", format: "mp4" },
  "YouTube 4K": { width: 3840, height: 2160, fps: 30, crf: 18, encoder: "libx264", preset: "slow", audioBitrate: "320k", format: "mp4" },
  "TikTok/Reels 9:16": { width: 1080, height: 1920, fps: 30, crf: 22, encoder: "libx264", preset: "veryfast", audioBitrate: "192k", format: "mp4" },
  "Instagram Square": { width: 1080, height: 1080, fps: 30, crf: 22, encoder: "libx264", preset: "veryfast", audioBitrate: "192k", format: "mp4" },
  "WhatsApp Compressed": { width: 854, height: 480, fps: 30, crf: 28, encoder: "libx264", preset: "fast", audioBitrate: "128k", format: "mp4" },
  "Lossless Master": { width: null, height: null, fps: null, crf: 0, encoder: "libx264", preset: "ultrafast", audioBitrate: "320k", format: "mkv" },
  "Audio Only MP3": { width: null, height: null, fps: null, crf: null, encoder: null, audioBitrate: "320k", format: "mp3", audioOnly: true }
};

export const RENDER_QUEUE_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELED: "canceled"
};

export function buildFilterChainForClip(clip, mediaItem) {
  const filters = clip.filters || {};
  const effects = clip.effects || {};
  const transform = clip.transform || {};
  const chain = [];

  const hasVideoFilters = clip.type === "video" || clip.type === "image";
  if (!hasVideoFilters) return { videoFilters: [], audioFilters: buildAudioFilters(clip) };

  // Speed (setpts)
  if (clip.speed && clip.speed !== 1) {
    const rate = 1 / clip.speed;
    chain.push(`setpts=${rate.toFixed(4)}*PTS`);
  }

  // Crop
  if (transform.cropW && transform.cropH && (transform.cropW < 1 || transform.cropH < 1)) {
    const w = `iw*${transform.cropW.toFixed(4)}`;
    const h = `ih*${transform.cropH.toFixed(4)}`;
    const x = `iw*${(transform.cropX || 0).toFixed(4)}`;
    const y = `ih*${(transform.cropY || 0).toFixed(4)}`;
    chain.push(`crop=${w}:${h}:${x}:${y}`);
  }

  // Scale
  if (mediaItem?.width && mediaItem?.height) {
    chain.push(`scale=${mediaItem.width || -2}:${mediaItem.height || -2}`);
  }

  // Flip
  if (transform.flipH) chain.push("hflip");
  if (transform.flipV) chain.push("vflip");

  // Rotate
  if (transform.rotation && transform.rotation !== 0) {
    const rad = (transform.rotation * Math.PI) / 180;
    chain.push(`rotate=${rad.toFixed(6)}`);
  }

  // Color adjustments (eq filter)
  const brightness = (filters.brightness || 0) / 100;
  const contrast = 1 + (filters.contrast || 0) / 100;
  const saturation = 1 + (filters.saturation || 0) / 100;
  if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
    chain.push(`eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}`);
  }

  // Hue
  if (filters.hue && filters.hue !== 0) {
    chain.push(`hue=h=${filters.hue}`);
  }

  // Blur
  if (effects.blur && effects.blur > 0) {
    chain.push(`gblur=sigma=${effects.blur}`);
  }

  // Vignette
  if (filters.vignette && filters.vignette > 0) {
    const angle = Math.PI / 5 * (filters.vignette / 100);
    chain.push(`vignette=angle=${angle.toFixed(4)}`);
  }

  // Fade in/out
  if (clip.fadeIn && clip.fadeIn > 0) {
    chain.push(`fade=in:0:d=${clip.fadeIn.toFixed(3)}`);
  }
  if (clip.fadeOut && clip.fadeOut > 0) {
    const startFade = Math.max(0, (clip.end - clip.start - clip.fadeOut));
    chain.push(`fade=out:st=${startFade.toFixed(3)}:d=${clip.fadeOut.toFixed(3)}`);
  }

  return { videoFilters: chain, audioFilters: buildAudioFilters(clip) };
}

function buildAudioFilters(clip) {
  const chain = [];
  const volume = clip.volume ?? 1;
  if (volume !== 1) chain.push(`volume=${volume.toFixed(4)}`);
  if (clip.normalizeAudio) chain.push("loudnorm=I=-23:TP=-1.5:LRA=11");
  if (clip.fadeIn && clip.fadeIn > 0) chain.push(`afade=in:0:d=${clip.fadeIn.toFixed(3)}`);
  if (clip.fadeOut && clip.fadeOut > 0) {
    const startFade = Math.max(0, (clip.end - clip.start - clip.fadeOut));
    chain.push(`afade=out:st=${startFade.toFixed(3)}:d=${clip.fadeOut.toFixed(3)}`);
  }
  const audioFx = clip.audioFx || {};
  if (audioFx.gain) chain.push(`volume=${Math.pow(10, audioFx.gain / 20).toFixed(4)}`);
  if (audioFx.tempo && audioFx.tempo !== 1) chain.push(`atempo=${audioFx.tempo.toFixed(3)}`);
  return chain;
}

export function buildSimpleExportArgs({ inputPath, outputPath, settings, capabilities }) {
  const enc = chooseBestH264Encoder(capabilities);
  const {
    width, height, fps, crf = 23, encoder, preset = "veryfast",
    audioBitrate = "192k", format = "mp4", audioOnly = false
  } = settings;

  const args = ["-i", inputPath];

  if (audioOnly) {
    args.push("-vn", "-c:a", "libmp3lame", "-b:a", audioBitrate);
  } else {
    const chosenEncoder = encoder === "libx264" ? enc : (encoder || enc);
    args.push("-c:v", chosenEncoder);

    if (width && height) args.push("-vf", `scale=${width}:${height}`);
    if (fps) args.push("-r", String(fps));

    if (chosenEncoder.includes("nvenc")) {
      args.push("-cq:v", String(crf), "-preset", "p4");
    } else if (chosenEncoder.includes("qsv")) {
      args.push("-global_quality", String(crf));
    } else if (chosenEncoder.includes("amf")) {
      args.push("-qp_i", String(crf), "-qp_p", String(crf));
    } else {
      args.push("-crf", String(crf), "-preset", preset);
    }

    args.push("-c:a", "aac", "-b:a", audioBitrate);
    if (format === "mp4" || format === "mov") args.push("-movflags", "+faststart");
  }

  args.push(outputPath);
  return args;
}

export function buildSubtitleBurnArgs({ inputPath, subtitlePath, outputPath }) {
  const safeSub = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  return [
    "-i", inputPath,
    "-vf", `subtitles='${safeSub}'`,
    "-c:a", "copy",
    outputPath
  ];
}

export function buildWatermarkArgs({ inputPath, watermarkPath, outputPath, opacity = 0.8, position = "bottomright" }) {
  const posMap = {
    topleft: "10:10",
    topright: "main_w-overlay_w-10:10",
    bottomleft: "10:main_h-overlay_h-10",
    bottomright: "main_w-overlay_w-10:main_h-overlay_h-10",
    center: "(main_w-overlay_w)/2:(main_h-overlay_h)/2"
  };
  const xy = posMap[position] || posMap.bottomright;
  return [
    "-i", inputPath,
    "-i", watermarkPath,
    "-filter_complex", `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];[0:v][wm]overlay=${xy}`,
    "-c:a", "copy",
    outputPath
  ];
}

export function buildDrawTextArgs({ inputPath, outputPath, text, x = "(w-text_w)/2", y = "(h-text_h)/2", fontSize = 48, color = "white", fontFile = "", startTime = 0, endTime = null }) {
  const safeFontFile = fontFile ? `:fontfile='${fontFile.replace(/\\/g, "/").replace(/:/g, "\\:")}'` : "";
  const enableExpr = endTime != null ? `enable='between(t,${startTime},${endTime})'` : `enable='gte(t,${startTime})'`;
  const filter = `drawtext=text='${text.replace(/'/g, "\\'")}':x=${x}:y=${y}:fontsize=${fontSize}:fontcolor=${color}${safeFontFile}:${enableExpr}`;
  return [
    "-i", inputPath,
    "-vf", filter,
    "-c:a", "copy",
    outputPath
  ];
}

export function buildExportRangeArgs({ inputPath, outputPath, inPoint, outPoint, settings, capabilities }) {
  const args = ["-ss", String(inPoint ?? 0), "-t", String((outPoint ?? 0) - (inPoint ?? 0))];
  return [...args, ...buildSimpleExportArgs({ inputPath, outputPath, settings, capabilities }).slice(2)];
}

export function buildSnapshotArgs({ inputPath, outputPath, timestamp }) {
  return ["-ss", String(timestamp ?? 0), "-i", inputPath, "-frames:v", "1", "-q:v", "2", outputPath];
}

export function buildSubtitleAttachArgs({ inputPath, subtitlePath, outputPath }) {
  const ext = subtitlePath.split(".").pop()?.toLowerCase() || "srt";
  return [
    "-i", inputPath,
    "-i", subtitlePath,
    "-c", "copy",
    "-c:s", ext === "ass" ? "ass" : "srt",
    "-metadata:s:s:0", "language=ind",
    outputPath
  ];
}

export function buildExportSRTFromClips(clips) {
  return clips
    .filter((c) => c.type === "text" && c.text)
    .sort((a, b) => a.start - b.start)
    .map((c, i) => {
      const fmt = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.round((s % 1) * 1000);
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
      };
      return `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`;
    })
    .join("\n");
}

let renderQueue = [];
let renderQueueListeners = [];

export function getRenderQueue() {
  return [...renderQueue];
}

export function addToRenderQueue(job) {
  const entry = {
    id: crypto.randomUUID(),
    status: RENDER_QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: Date.now(),
    ...job
  };
  renderQueue = [...renderQueue, entry];
  notifyQueueListeners();
  return entry.id;
}

export function updateRenderQueueJob(id, patch) {
  renderQueue = renderQueue.map((j) => (j.id === id ? { ...j, ...patch } : j));
  notifyQueueListeners();
}

export function removeRenderQueueJob(id) {
  renderQueue = renderQueue.filter((j) => j.id !== id);
  notifyQueueListeners();
}

export function subscribeRenderQueue(listener) {
  renderQueueListeners.push(listener);
  return () => { renderQueueListeners = renderQueueListeners.filter((l) => l !== listener); };
}

function notifyQueueListeners() {
  renderQueueListeners.forEach((l) => l(renderQueue));
}
