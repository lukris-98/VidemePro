export const COMMANDS = [
  // ─── Import / Convert ──────────────────────────────────────────────────
  {
    id: "convert-mp4",
    label: "Convert to MP4",
    icon: "RefreshCw",
    category: "Convert",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { crf: 23, preset: "veryfast", encoder: "libx264" },
    paramSchema: [
      { key: "crf", label: "CRF", type: "number", min: 0, max: 51 },
      { key: "preset", label: "Preset", type: "select", options: ["ultrafast","veryfast","fast","medium","slow"] },
      { key: "encoder", label: "Encoder", type: "select", options: ["libx264","h264_nvenc","h264_qsv","h264_amf"] }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-c:v", params.encoder || "libx264",
      "-crf", String(params.crf ?? 23),
      "-preset", params.preset || "veryfast",
      "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "convert-webm",
    label: "Convert to WebM",
    icon: "RefreshCw",
    category: "Convert",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { crf: 33 },
    paramSchema: [{ key: "crf", label: "CRF", type: "number", min: 0, max: 63 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-c:v", "libvpx-vp9",
      "-crf", String(params.crf ?? 33),
      "-b:v", "0",
      "-c:a", "libopus",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "convert-gif",
    label: "Make GIF",
    icon: "RefreshCw",
    category: "Convert",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { fps: 15, width: 480 },
    paramSchema: [
      { key: "fps", label: "FPS", type: "number", min: 1, max: 30 },
      { key: "width", label: "Width", type: "number", min: 120, max: 1920 }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `fps=${params.fps ?? 15},scale=${params.width ?? 480}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Compress ──────────────────────────────────────────────────────────
  {
    id: "compress-h264",
    label: "Compress H.264",
    icon: "Archive",
    category: "Compress",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { crf: 28, preset: "medium" },
    paramSchema: [
      { key: "crf", label: "CRF", type: "number", min: 0, max: 51 },
      { key: "preset", label: "Preset", type: "select", options: ["ultrafast","fast","medium","slow"] }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-c:v", "libx264",
      "-crf", String(params.crf ?? 28),
      "-preset", params.preset || "medium",
      "-c:a", "copy",
      "-movflags", "+faststart",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "optimize-web",
    label: "Optimize for Web",
    icon: "Globe",
    category: "Compress",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { crf: 23 },
    paramSchema: [{ key: "crf", label: "CRF", type: "number", min: 0, max: 51 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-c:v", "libx264",
      "-crf", String(params.crf ?? 23),
      "-preset", "fast",
      "-profile:v", "baseline",
      "-level", "3.0",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Audio ─────────────────────────────────────────────────────────────
  {
    id: "extract-audio",
    label: "Extract Audio",
    icon: "Music",
    category: "Audio",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { format: "mp3", bitrate: "192k" },
    paramSchema: [
      { key: "format", label: "Format", type: "select", options: ["mp3","aac","wav"] },
      { key: "bitrate", label: "Bitrate", type: "select", options: ["128k","192k","256k","320k"] }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vn",
      "-c:a", params.format === "wav" ? "pcm_s16le" : params.format === "aac" ? "aac" : "libmp3lame",
      ...(params.format !== "wav" ? ["-b:a", params.bitrate || "192k"] : []),
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "normalize-audio",
    label: "Normalize Audio",
    icon: "AudioLines",
    category: "Audio",
    mediaTypes: ["video", "audio"],
    requiresNative: true,
    defaultParams: { lufs: -23 },
    paramSchema: [{ key: "lufs", label: "Target LUFS", type: "number", min: -70, max: -5 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-af", `loudnorm=I=${params.lufs ?? -23}:TP=-1.5:LRA=11`,
      "-c:v", "copy",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "convert-mp3",
    label: "Convert to MP3",
    icon: "Music",
    category: "Audio",
    mediaTypes: ["audio", "video"],
    requiresNative: true,
    defaultParams: { bitrate: "192k" },
    paramSchema: [{ key: "bitrate", label: "Bitrate", type: "select", options: ["128k","192k","256k","320k"] }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", params.bitrate || "192k",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "convert-wav",
    label: "Convert to WAV",
    icon: "Music",
    category: "Audio",
    mediaTypes: ["audio", "video"],
    requiresNative: true,
    defaultParams: {},
    paramSchema: [],
    ffmpegArgsBuilder: ({ input, output }) => [
      "-i", input,
      "-vn",
      "-c:a", "pcm_s16le",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "convert-aac",
    label: "Convert to AAC",
    icon: "Music",
    category: "Audio",
    mediaTypes: ["audio", "video"],
    requiresNative: true,
    defaultParams: { bitrate: "192k" },
    paramSchema: [{ key: "bitrate", label: "Bitrate", type: "select", options: ["128k","192k","256k","320k"] }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vn",
      "-c:a", "aac",
      "-b:a", params.bitrate || "192k",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "extract-waveform",
    label: "Extract Waveform",
    icon: "Waves",
    category: "Audio",
    mediaTypes: ["audio", "video"],
    requiresNative: true,
    defaultParams: { width: 1920, height: 240 },
    paramSchema: [
      { key: "width", label: "Width", type: "number", min: 320, max: 3840 },
      { key: "height", label: "Height", type: "number", min: 60, max: 720 }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-filter_complex", `showwavespic=s=${params.width ?? 1920}x${params.height ?? 240}:colors=0x00d4ff`,
      "-frames:v", "1",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Video Tools ────────────────────────────────────────────────────────
  {
    id: "snapshot",
    label: "Snapshot",
    icon: "Camera",
    category: "Video",
    mediaTypes: ["video", "image"],
    requiresNative: true,
    defaultParams: { time: 0 },
    paramSchema: [{ key: "time", label: "Time (s)", type: "number", min: 0 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-ss", String(params.time ?? 0),
      "-i", input,
      "-frames:v", "1",
      "-q:v", "2",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "make-proxy",
    label: "Make Proxy",
    icon: "Layers",
    category: "Video",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { height: 540 },
    paramSchema: [{ key: "height", label: "Height", type: "select", options: [360, 540, 720] }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `scale=-2:${params.height ?? 540}`,
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "ultrafast",
      "-c:a", "aac",
      "-b:a", "128k",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "crop-video",
    label: "Crop",
    icon: "Crop",
    category: "Video",
    mediaTypes: ["video", "image"],
    requiresNative: true,
    defaultParams: { w: 1280, h: 720, x: 0, y: 0 },
    paramSchema: [
      { key: "w", label: "Width", type: "number", min: 1, max: 7680 },
      { key: "h", label: "Height", type: "number", min: 1, max: 4320 },
      { key: "x", label: "X offset", type: "number", min: 0, max: 7680 },
      { key: "y", label: "Y offset", type: "number", min: 0, max: 4320 }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `crop=${params.w}:${params.h}:${params.x}:${params.y}`,
      "-c:a", "copy",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "rotate-video",
    label: "Rotate",
    icon: "RotateCw",
    category: "Video",
    mediaTypes: ["video", "image"],
    requiresNative: true,
    defaultParams: { angle: 90 },
    paramSchema: [{ key: "angle", label: "Angle", type: "select", options: [90, 180, 270] }],
    ffmpegArgsBuilder: ({ input, output, params }) => {
      const angle = params.angle ?? 90;
      const transposeMap = { 90: "1", 180: "2,transpose=2", 270: "2" };
      const filter = transposeMap[angle] ? `transpose=${transposeMap[angle]}` : `rotate=${angle}*PI/180`;
      return ["-i", input, "-vf", filter, "-c:a", "copy", output];
    },
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "rewrap",
    label: "Rewrap (no re-encode)",
    icon: "Package",
    category: "Convert",
    mediaTypes: ["video", "audio"],
    requiresNative: true,
    defaultParams: {},
    paramSchema: [],
    ffmpegArgsBuilder: ({ input, output }) => [
      "-i", input,
      "-c", "copy",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Image ──────────────────────────────────────────────────────────────
  {
    id: "image-resize",
    label: "Resize Image",
    icon: "Crop",
    category: "Image",
    mediaTypes: ["image"],
    requiresNative: true,
    defaultParams: { width: 1920, height: 1080 },
    paramSchema: [
      { key: "width", label: "Width", type: "number", min: 1, max: 7680 },
      { key: "height", label: "Height", type: "number", min: 1, max: 4320 }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input, "-vf", `scale=${params.width ?? 1920}:${params.height ?? 1080}`, output
    ],
    previewArgsBuilder: ({ input, output, params }) => [
      "-i", input, "-vf", `scale=${params.width ?? 1920}:${params.height ?? 1080}`, "-frames:v", "1", output
    ],
    statePatchBuilder: ({ params }) => ({ transform: { scaleX: 1, scaleY: 1 } })
  },
  {
    id: "image-convert-png",
    label: "Convert to PNG",
    icon: "Images",
    category: "Image",
    mediaTypes: ["image"],
    requiresNative: true,
    defaultParams: {},
    paramSchema: [],
    ffmpegArgsBuilder: ({ input, output }) => ["-i", input, output],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "image-convert-jpg",
    label: "Convert to JPG",
    icon: "Images",
    category: "Image",
    mediaTypes: ["image"],
    requiresNative: true,
    defaultParams: { quality: 92 },
    paramSchema: [{ key: "quality", label: "Quality", type: "number", min: 1, max: 100 }],
    ffmpegArgsBuilder: ({ input, output, params }) => ["-i", input, "-q:v", String(Math.round(31 - (params.quality ?? 92) * 0.31)), output],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "image-rotate",
    label: "Rotate Image",
    icon: "RotateCw",
    category: "Image",
    mediaTypes: ["image"],
    requiresNative: true,
    defaultParams: { angle: 90 },
    paramSchema: [{ key: "angle", label: "Angle", type: "select", options: [90, 180, 270] }],
    ffmpegArgsBuilder: ({ input, output, params }) => {
      const angle = params.angle ?? 90;
      const filter = angle === 180 ? "transpose=2,transpose=2" : angle === 270 ? "transpose=2" : "transpose=1";
      return ["-i", input, "-vf", filter, output];
    },
    previewArgsBuilder: ({ input, output, params }) => {
      const angle = params.angle ?? 90;
      const filter = angle === 180 ? "transpose=2,transpose=2" : angle === 270 ? "transpose=2" : "transpose=1";
      return ["-i", input, "-vf", filter, "-frames:v", "1", output];
    },
    statePatchBuilder: ({ params }) => ({ transform: { rotation: params.angle ?? 90 } })
  },
  // ─── Metadata ────────────────────────────────────────────────────────────
  {
    id: "strip-metadata",
    label: "Strip Metadata",
    icon: "Info",
    category: "Metadata",
    mediaTypes: ["video", "audio", "image"],
    requiresNative: true,
    defaultParams: {},
    paramSchema: [],
    ffmpegArgsBuilder: ({ input, output }) => ["-i", input, "-map_metadata", "-1", "-c", "copy", output],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "set-title-metadata",
    label: "Set Title Tag",
    icon: "Info",
    category: "Metadata",
    mediaTypes: ["video", "audio"],
    requiresNative: true,
    defaultParams: { title: "" },
    paramSchema: [{ key: "title", label: "Title", type: "text" }],
    ffmpegArgsBuilder: ({ input, output, params }) => ["-i", input, "-metadata", `title=${params.title || ""}`, "-c", "copy", output],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "generate-thumbnail",
    label: "Generate Thumbnail",
    icon: "Camera",
    category: "Metadata",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { time: 1 },
    paramSchema: [{ key: "time", label: "Time (s)", type: "number", min: 0 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-ss", String(params.time ?? 1), "-i", input, "-frames:v", "1", "-q:v", "2", output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Analysis ───────────────────────────────────────────────────────────
  {
    id: "detect-black-frames",
    label: "Detect Black Frames",
    icon: "ScanSearch",
    category: "Analysis",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { threshold: 0.1, duration: 0.05 },
    paramSchema: [
      { key: "threshold", label: "Threshold", type: "number", min: 0, max: 1 },
      { key: "duration", label: "Min Duration (s)", type: "number", min: 0.01 }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `blackdetect=d=${params.duration ?? 0.05}:pix_th=${params.threshold ?? 0.1}`,
      "-f", "null", output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "generate-thumbnails",
    label: "Generate Thumbnails",
    icon: "Images",
    category: "Analysis",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { fps: 1 },
    paramSchema: [{ key: "fps", label: "FPS (1 = 1 thumb/sec)", type: "number", min: 0.1, max: 5 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `fps=${params.fps ?? 1},scale=320:-1`,
      "-q:v", "5",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "detect-interlace",
    label: "Detect Interlacing",
    icon: "ScanSearch",
    category: "Analysis",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: {},
    paramSchema: [],
    ffmpegArgsBuilder: ({ input, output }) => [
      "-i", input,
      "-vf", "idet",
      "-f", "null", output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "extract-dominant-colors",
    label: "Extract Dominant Colors",
    icon: "Palette",
    category: "Analysis",
    mediaTypes: ["video", "image"],
    requiresNative: true,
    defaultParams: { time: 0 },
    paramSchema: [{ key: "time", label: "Time (s)", type: "number", min: 0 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-ss", String(params.time ?? 0),
      "-i", input,
      "-vf", "scale=100:100,palettegen=max_colors=8:reserve_transparent=0",
      "-frames:v", "1",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "analyze-metadata",
    label: "Analyze Metadata",
    icon: "Info",
    category: "Metadata",
    mediaTypes: ["video", "audio", "image"],
    requiresNative: false,
    defaultParams: {},
    paramSchema: [],
    ffmpegArgsBuilder: null,
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "detect-silence",
    label: "Detect Silence",
    icon: "VolumeX",
    category: "Audio",
    mediaTypes: ["video", "audio"],
    requiresNative: true,
    defaultParams: { threshold: -40, duration: 0.5 },
    paramSchema: [
      { key: "threshold", label: "Threshold (dB)", type: "number", min: -70, max: 0 },
      { key: "duration", label: "Min Duration (s)", type: "number", min: 0.1 }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-af", `silencedetect=n=${params.threshold ?? -40}dB:d=${params.duration ?? 0.5}`,
      "-f", "null",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "detect-scenes",
    label: "Detect Scene Changes",
    icon: "ScanSearch",
    category: "Analysis",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { threshold: 0.3 },
    paramSchema: [{ key: "threshold", label: "Threshold", type: "number", min: 0, max: 1 }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `select='gt(scene,${params.threshold ?? 0.3})',showinfo`,
      "-f", "null",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Subtitle ───────────────────────────────────────────────────────────
  {
    id: "burn-subtitle",
    label: "Burn Subtitle",
    icon: "Captions",
    category: "Subtitle",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { subtitlePath: "" },
    paramSchema: [{ key: "subtitlePath", label: "Subtitle Path (.srt/.ass)", type: "text" }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `subtitles='${(params.subtitlePath || "").replace(/\\/g, "/").replace(/:/g, "\\:")}'`,
      "-c:a", "copy",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  // ─── Export ─────────────────────────────────────────────────────────────
  {
    id: "export-audio-only",
    label: "Render Audio Only",
    icon: "Headphones",
    category: "Export",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { format: "mp3" },
    paramSchema: [{ key: "format", label: "Format", type: "select", options: ["mp3","wav","aac"] }],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vn",
      "-c:a", params.format === "wav" ? "pcm_s16le" : params.format === "aac" ? "aac" : "libmp3lame",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  },
  {
    id: "extract-image-sequence",
    label: "Extract Image Sequence",
    icon: "Images",
    category: "Export",
    mediaTypes: ["video"],
    requiresNative: true,
    defaultParams: { fps: 1, format: "jpg" },
    paramSchema: [
      { key: "fps", label: "FPS", type: "number", min: 0.1, max: 60 },
      { key: "format", label: "Format", type: "select", options: ["jpg","png"] }
    ],
    ffmpegArgsBuilder: ({ input, output, params }) => [
      "-i", input,
      "-vf", `fps=${params.fps ?? 1}`,
      "-q:v", "2",
      output
    ],
    previewArgsBuilder: null,
    statePatchBuilder: null
  }
];

export function getCommandsByCategory() {
  const map = {};
  for (const cmd of COMMANDS) {
    if (!map[cmd.category]) map[cmd.category] = [];
    map[cmd.category].push(cmd);
  }
  return map;
}

export function getCommandById(id) {
  return COMMANDS.find((cmd) => cmd.id === id) ?? null;
}

export function getCommandsForMedia(mediaType) {
  if (!mediaType) return COMMANDS;
  return COMMANDS.filter((cmd) => cmd.mediaTypes.includes(mediaType));
}

export function buildCommandArgs(cmd, { input = "{input}", output = "{output}", params = {} } = {}) {
  if (!cmd?.ffmpegArgsBuilder) return [];
  return cmd.ffmpegArgsBuilder({ input, output, params: { ...cmd.defaultParams, ...params } });
}

export function buildPreviewArgs(cmd, { input = "{input}", output = "{output}", params = {} } = {}) {
  if (!cmd?.previewArgsBuilder) return null;
  return cmd.previewArgsBuilder({ input, output, params: { ...cmd.defaultParams, ...params } });
}

export function applyStatePatch(cmd, { clip, params = {} } = {}) {
  if (!cmd?.statePatchBuilder) return null;
  return cmd.statePatchBuilder({ clip, params: { ...cmd.defaultParams, ...params } });
}

export const ICON_MAP = {
  RefreshCw: "RefreshCw",
  Archive: "Archive",
  Music: "Music",
  Camera: "Camera",
  Info: "Info",
  ScanSearch: "ScanSearch",
  Crop: "Crop",
  RotateCw: "RotateCw",
  FlipHorizontal: "FlipHorizontal",
  Sun: "Sun",
  Captions: "Captions",
  Badge: "Badge",
  AudioLines: "AudioLines",
  Waves: "Waves",
  Download: "Download",
  Terminal: "Terminal",
  Globe: "Globe",
  Layers: "Layers",
  Package: "Package",
  VolumeX: "VolumeX",
  Headphones: "Headphones",
  Images: "Images",
  Palette: "Palette"
};
