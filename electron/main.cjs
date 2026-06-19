const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const FFMPEG_TIMEOUT_MS = 30_000;
const PEXELS_API_BASE = "https://api.pexels.com/v1";
const PIXABAY_API_BASE = "https://pixabay.com/api";

// Map of active transcoding processes: jobId -> child process
const activeJobs = new Map();

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  return fs.readFile(envPath, "utf8")
    .then((text) => {
      text.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]]) return;
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      });
    })
    .catch(() => {});
}

function runBinary(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGKILL");
        }, options.timeoutMs)
      : null;
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr, error: error.message });
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    if (options.jobId) {
      activeJobs.set(options.jobId, child);
      child.on("close", () => activeJobs.delete(options.jobId));
    }
  });
}

function parseListOutput(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function runDetection(flag) {
  const result = await runBinary("ffmpeg", ["-hide_banner", flag], { timeoutMs: FFMPEG_TIMEOUT_MS });
  return result.stdout || result.stderr || "";
}

async function getFFmpegCapabilities() {
  const version = await runBinary("ffmpeg", ["-version"], { timeoutMs: FFMPEG_TIMEOUT_MS });
  if (!version.ok) {
    const ffprobeCheck = await runBinary("ffprobe", ["-version"], { timeoutMs: FFMPEG_TIMEOUT_MS });
    return {
      available: false,
      ffprobeAvailable: ffprobeCheck.ok,
      error: version.error || version.stderr || "FFmpeg native tidak ditemukan. Silakan install FFmpeg dan pastikan ada di PATH.",
      installHint: "Download dari https://ffmpeg.org/download.html lalu tambahkan ke PATH sistem."
    };
  }

  const buildconf = await runBinary("ffmpeg", ["-hide_banner", "-buildconf"], { timeoutMs: FFMPEG_TIMEOUT_MS });
  const [
    encodersText, decodersText, hwaccelsText, filtersText, formatsText,
    muxersText, demuxersText, codecsText, protocolsText, bsfsText,
    pixFmtsText, sampleFmtsText, layoutsText
  ] = await Promise.all([
    runDetection("-encoders"),
    runDetection("-decoders"),
    runDetection("-hwaccels"),
    runDetection("-filters"),
    runDetection("-formats"),
    runDetection("-muxers"),
    runDetection("-demuxers"),
    runDetection("-codecs"),
    runDetection("-protocols"),
    runDetection("-bsfs"),
    runDetection("-pix_fmts"),
    runDetection("-sample_fmts"),
    runDetection("-layouts")
  ]);

  const ffprobeCheck = await runBinary("ffprobe", ["-version"], { timeoutMs: FFMPEG_TIMEOUT_MS });

  return {
    available: true,
    version: version.stdout.split(/\r?\n/)[0] || "ffmpeg",
    buildconf: buildconf.stdout || buildconf.stderr || "",
    ffprobeAvailable: ffprobeCheck.ok,
    ffprobeVersion: ffprobeCheck.ok ? (ffprobeCheck.stdout.split(/\r?\n/)[0] || "ffprobe") : null,
    encodersText,
    decodersText,
    hwaccelsText,
    filtersText,
    formatsText,
    muxersText,
    demuxersText,
    codecsText,
    protocolsText,
    bsfsText,
    pixFmtsText,
    sampleFmtsText,
    layoutsText,
    encoders: parseListOutput(encodersText),
    decoders: parseListOutput(decodersText),
    hwaccels: parseListOutput(hwaccelsText),
    gpu: {
      nvidia: encodersText.includes("h264_nvenc") || encodersText.includes("hevc_nvenc"),
      intel: encodersText.includes("h264_qsv") || encodersText.includes("hevc_qsv"),
      amd: encodersText.includes("h264_amf") || encodersText.includes("hevc_amf")
    }
  };
}

function sanitizeExtension(extension, fallback) {
  const value = String(extension || fallback).replace(/[^a-z0-9]/gi, "").toLowerCase();
  return value || fallback;
}

function sanitizeFilename(name, fallback = "asset") {
  const clean = String(name || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim();
  return clean || fallback;
}

function guessExtensionFromUrl(url, fallback) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).replace(".", "");
    return sanitizeExtension(ext, fallback);
  } catch {
    return fallback;
  }
}

function guessExtensionFromName(name) {
  const ext = path.extname(String(name || "")).replace(".", "");
  return ext ? sanitizeExtension(ext, "") : "";
}

async function downloadRemoteAsset(payload = {}) {
  const url = String(payload.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "URL asset tidak valid." };
  const provider = sanitizeFilename(payload.provider || "remote").toLowerCase();
  const type = payload.type === "video" ? "videos" : "images";
  const fallbackExt = payload.type === "video" ? "mp4" : "jpg";
  const nameExt = guessExtensionFromName(payload.name);
  const ext = guessExtensionFromUrl(url, nameExt || fallbackExt);
  const baseName = sanitizeFilename(payload.name || `${provider}-${Date.now()}.${ext}`);
  const fileName = guessExtensionFromName(baseName) ? baseName : `${baseName}.${ext}`;
  const targetDir = path.join(app.getPath("userData"), "cache", "media", provider, type);
  await fs.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, fileName);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Download gagal (${response.status}). ${text}`.trim() };
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(targetPath, buffer);
  return {
    ok: true,
    path: targetPath,
    url: pathToFileURL(targetPath).href,
    size: buffer.byteLength,
    name: fileName
  };
}

function normalizePexelsVideo(video) {
  const mp4Files = Array.isArray(video.video_files)
    ? video.video_files.filter((file) => file.file_type === "video/mp4" && file.link && file.quality !== "hls")
    : [];
  const preferred = pickBestPexelsVideoFile(mp4Files);
  const previewUrl = video.video_pictures?.[0]?.picture || video.image || "";
  return {
    id: String(video.id),
    type: "video",
    name: `Pexels Video ${video.id}.mp4`,
    url: preferred?.link || video.url,
    downloadUrl: preferred?.link || video.url,
    previewUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: Number(video.duration) || 5,
    width: preferred?.width || video.width || 0,
    height: preferred?.height || video.height || 0,
    size: 0,
    pexelsUrl: video.url,
    photographer: video.user?.name || "Pexels",
    photographerUrl: video.user?.url || "https://www.pexels.com"
  };
}

function normalizePexelsPhoto(photo) {
  const previewUrl = photo.src?.small || photo.src?.tiny || photo.src?.medium || "";
  const webformatUrl = photo.src?.medium || photo.src?.large || previewUrl;
  const downloadUrl = photo.src?.original || photo.src?.large2x || photo.src?.large || webformatUrl || photo.url;
  return {
    id: String(photo.id),
    type: "image",
    name: `Pexels Photo ${photo.id}.jpg`,
    url: downloadUrl,
    downloadUrl,
    previewUrl,
    webformatUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: 3,
    width: photo.width || 0,
    height: photo.height || 0,
    size: 0,
    alt: photo.alt || "",
    avgColor: photo.avg_color || null,
    pexelsUrl: photo.url,
    photographer: photo.photographer || "Pexels",
    photographerUrl: photo.photographer_url || "https://www.pexels.com"
  };
}

function pickBestPexelsVideoFile(files) {
  return files
    .slice()
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0];
}

function pexelsOrientation(orientation) {
  if (orientation === "horizontal") return "landscape";
  if (orientation === "vertical") return "portrait";
  return "";
}

async function searchPexels(payload = {}) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return { ok: false, error: "PEXELS_API_KEY belum diatur di .env.local." };

  const kind = payload.kind === "video" ? "video" : "photo";
  const query = String(payload.query || "").trim();
  if (!query) return { ok: false, error: "Kata kunci Pexels masih kosong." };

  const page = Math.max(1, Math.min(Number(payload.page) || 1, 1000));
  const perPage = Math.max(1, Math.min(Number(payload.perPage) || 12, 40));
  const endpoint = kind === "video" ? `${PEXELS_API_BASE}/videos/search` : `${PEXELS_API_BASE}/search`;
  const url = new URL(endpoint);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  const orientation = pexelsOrientation(payload.orientation);
  if (orientation) url.searchParams.set("orientation", orientation);

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Pexels gagal (${response.status}). ${text}`.trim() };
  }
  const data = await response.json();
  const items = kind === "video"
    ? (data.videos || []).map(normalizePexelsVideo).filter((item) => item.url)
    : (data.photos || []).map(normalizePexelsPhoto).filter((item) => item.url);

  return {
    ok: true,
    kind,
    page: data.page || page,
    perPage: data.per_page || perPage,
    totalResults: data.total_results || 0,
    hasNext: Boolean(data.next_page),
    items
  };
}

function pixabayUserUrl(item) {
  if (!item.user || !item.user_id) return "https://pixabay.com";
  return `https://pixabay.com/users/${encodeURIComponent(item.user)}-${item.user_id}/`;
}

function normalizePixabayImage(item) {
  const previewUrl = item.previewURL || item.webformatURL || "";
  const webformatUrl = item.webformatURL || item.previewURL || "";
  const download = pickPixabayImageDownload(item);
  return {
    id: String(item.id),
    type: "image",
    name: `Pixabay ${download.kind} ${item.id}.${download.extension}`,
    url: download.url,
    downloadUrl: download.url,
    previewUrl,
    webformatUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: 3,
    width: item.imageWidth || item.webformatWidth || 0,
    height: item.imageHeight || item.webformatHeight || 0,
    size: item.imageSize || 0,
    alt: item.tags || "",
    pixabayUrl: item.pageURL,
    creator: item.user || "Pixabay",
    creatorUrl: pixabayUserUrl(item)
  };
}

function pickPixabayImageDownload(item) {
  if (item.vectorURL) {
    return { url: item.vectorURL, kind: "Vector", extension: "svg" };
  }
  return {
    url: item.imageURL || item.fullHDURL || item.largeImageURL || item.webformatURL || item.previewURL || item.pageURL,
    kind: "Image",
    extension: "jpg"
  };
}

function normalizePixabayVideo(item) {
  const versions = item.videos || {};
  const preview = pickPixabayVideoVersion(versions, ["medium", "small", "large", "tiny"], "thumbnail");
  const preferred = pickPixabayVideoVersion(versions, ["large", "medium", "small", "tiny"], "url");
  return {
    id: String(item.id),
    type: "video",
    name: `Pixabay Video ${item.id}.mp4`,
    url: preferred?.url || item.pageURL,
    downloadUrl: preferred?.url || item.pageURL,
    previewUrl: preview?.thumbnail || preferred?.thumbnail || "",
    previewDownloadUrl: preview?.thumbnail || preferred?.thumbnail || "",
    thumbnailUrl: preview?.thumbnail || preferred?.thumbnail || "",
    duration: Number(item.duration) || 5,
    width: preferred?.width || 0,
    height: preferred?.height || 0,
    size: preferred?.size || 0,
    alt: item.tags || "",
    pixabayUrl: item.pageURL,
    creator: item.user || "Pixabay",
    creatorUrl: pixabayUserUrl(item)
  };
}

function pickPixabayVideoVersion(versions, order, field) {
  return order.map((key) => versions[key]).find((version) => version?.[field]);
}

async function searchPixabay(payload = {}) {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return { ok: false, error: "PIXABAY_API_KEY belum diatur di .env.local." };

  const kind = payload.kind === "video" ? "video" : "photo";
  const query = String(payload.query || "").trim();
  const page = Math.max(1, Math.min(Number(payload.page) || 1, 1000));
  const perPage = Math.max(3, Math.min(Number(payload.perPage) || 12, 200));
  const endpoint = kind === "video" ? `${PIXABAY_API_BASE}/videos/` : `${PIXABAY_API_BASE}/`;
  const url = new URL(endpoint);
  url.searchParams.set("key", apiKey);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("safesearch", payload.safeSearch === false ? "false" : "true");
  url.searchParams.set("order", payload.order === "latest" ? "latest" : "popular");
  if (payload.category && payload.category !== "all") url.searchParams.set("category", payload.category);
  if (payload.orientation && payload.orientation !== "all" && kind !== "video") url.searchParams.set("orientation", payload.orientation);
  if (kind === "photo") url.searchParams.set("image_type", "all");
  if (kind === "video") url.searchParams.set("video_type", "all");

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Pixabay gagal (${response.status}). ${text}`.trim() };
  }
  const data = await response.json();
  const items = kind === "video"
    ? (data.hits || []).map(normalizePixabayVideo).filter((item) => item.url)
    : (data.hits || []).map(normalizePixabayImage).filter((item) => item.url);

  return {
    ok: true,
    kind,
    page,
    perPage,
    totalResults: data.totalHits || data.total || 0,
    hasNext: page * perPage < (data.totalHits || 0),
    items
  };
}

ipcMain.handle("ffmpeg:get-capabilities", async () => getFFmpegCapabilities());

ipcMain.handle("pexels:search", async (_event, payload) => searchPexels(payload));
ipcMain.handle("pixabay:search", async (_event, payload) => searchPixabay(payload));
ipcMain.handle("asset:download", async (_event, payload) => downloadRemoteAsset(payload));

ipcMain.handle("ffmpeg:get-filter-help", async (_event, filterName) => {
  if (!filterName || typeof filterName !== "string" || !/^[a-z0-9_]+$/i.test(filterName)) {
    return { ok: false, error: "Nama filter tidak valid." };
  }
  const result = await runBinary("ffmpeg", ["-hide_banner", "-h", `filter=${filterName}`], { timeoutMs: FFMPEG_TIMEOUT_MS });
  return { ok: true, text: result.stdout || result.stderr || "" };
});

ipcMain.handle("ffmpeg:get-encoder-help", async (_event, encoderName) => {
  if (!encoderName || typeof encoderName !== "string" || !/^[a-z0-9_]+$/i.test(encoderName)) {
    return { ok: false, error: "Nama encoder tidak valid." };
  }
  const result = await runBinary("ffmpeg", ["-hide_banner", "-h", `encoder=${encoderName}`], { timeoutMs: FFMPEG_TIMEOUT_MS });
  return { ok: true, text: result.stdout || result.stderr || "" };
});

ipcMain.handle("ffmpeg:cancel-job", async (_event, jobId) => {
  const child = activeJobs.get(jobId);
  if (!child) return { ok: false, error: "Job tidak ditemukan." };
  try {
    child.kill("SIGKILL");
    activeJobs.delete(jobId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Gagal menghentikan proses." };
  }
});

ipcMain.handle("ffmpeg:transcode-buffer", async (event, payload) => {
  const inputExt = sanitizeExtension(payload?.inputExt, "bin");
  const outputExt = sanitizeExtension(payload?.outputExt, "mp4");
  const bytes = Buffer.from(payload?.bytes || []);
  const jobId = payload?.jobId || null;
  if (!bytes.length) return { ok: false, error: "Input kosong." };
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "videme-ffmpeg-"));
  const inputPath = path.join(workDir, `input.${inputExt}`);
  const outputPath = path.join(workDir, `output.${outputExt}`);
  try {
    await fs.writeFile(inputPath, bytes);
    const args = Array.isArray(payload?.args) && payload.args.length ? payload.args : ["-i", inputPath, outputPath];
    const safeArgs = args.map((arg) => (arg === "{input}" ? inputPath : arg === "{output}" ? outputPath : String(arg)));
    const result = await runBinaryWithProgress("ffmpeg", ["-y", "-progress", "pipe:2", ...safeArgs], {
      timeoutMs: 60 * 60 * 1000,
      jobId,
      onProgress: (data) => {
        if (jobId) event.sender.send(`ffmpeg:progress:${jobId}`, data);
      }
    });
    if (!result.ok) return { ok: false, stderr: result.stderr, stdout: result.stdout, error: result.error || result.stderr || "FFmpeg gagal." };
    const output = await fs.readFile(outputPath);
    return { ok: true, bytes: output, stdout: result.stdout, stderr: result.stderr };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
});

ipcMain.handle("ffmpeg:transcode-paths", async (event, payload) => {
  const jobId = payload?.jobId || null;
  const inputPath = payload?.inputPath;
  const outputPath = payload?.outputPath;
  if (!inputPath || !outputPath) return { ok: false, error: "Input/output path kosong." };
  const args = Array.isArray(payload?.args) && payload.args.length
    ? payload.args.map((arg) => (arg === "{input}" ? inputPath : arg === "{output}" ? outputPath : String(arg)))
    : ["-i", inputPath, outputPath];
  const result = await runBinaryWithProgress("ffmpeg", ["-y", "-progress", "pipe:2", ...args], {
    timeoutMs: 60 * 60 * 1000,
    jobId,
    onProgress: (data) => {
      if (jobId) event.sender.send(`ffmpeg:progress:${jobId}`, data);
    }
  });
  return result.ok
    ? { ok: true, stdout: result.stdout, stderr: result.stderr }
    : { ok: false, stderr: result.stderr, stdout: result.stdout, error: result.error || result.stderr || "FFmpeg gagal." };
});

ipcMain.handle("ffprobe:metadata", async (_event, payload) => {
  const filePath = payload?.filePath;
  if (!filePath) return { ok: false, error: "Path file kosong." };
  const result = await runBinary(
    "ffprobe",
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", filePath],
    { timeoutMs: FFMPEG_TIMEOUT_MS }
  );
  if (!result.ok && !result.stdout) return { ok: false, error: result.error || result.stderr || "ffprobe gagal." };
  try {
    const data = JSON.parse(result.stdout || result.stderr || "{}");
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Gagal parse output ffprobe.", raw: result.stdout };
  }
});

function runBinaryWithProgress(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => child.kill("SIGKILL"), options.timeoutMs)
      : null;

    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (options.onProgress) {
        const progress = parseFFmpegProgress(text);
        if (progress) options.onProgress(progress);
      }
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      resolve({ ok: false, code: null, stdout, stderr, error: error.message });
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    if (options.jobId) {
      activeJobs.set(options.jobId, child);
      child.on("close", () => activeJobs.delete(options.jobId));
    }
  });
}

function parseFFmpegProgress(text) {
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

function getCacheDir(subdir) {
  return path.join(app.getPath("userData"), "videme-cache", subdir);
}

async function ensureCacheDirs() {
  for (const sub of ["thumbnails", "waveform", "proxies", "preview-frames", "renders"]) {
    await fs.mkdir(getCacheDir(sub), { recursive: true }).catch(() => {});
  }
}

ipcMain.handle("cache:get-dir", async (_event, subdir) => {
  const sub = String(subdir || "").replace(/[^a-z0-9-]/gi, "") || "renders";
  const dir = getCacheDir(sub);
  await fs.mkdir(dir, { recursive: true }).catch(() => {});
  return dir;
});

ipcMain.handle("cache:clear", async (_event, subdir) => {
  try {
    const sub = String(subdir || "").replace(/[^a-z0-9-]/gi, "");
    const dir = sub ? getCacheDir(sub) : path.join(app.getPath("userData"), "videme-cache");
    await fs.rm(dir, { recursive: true, force: true });
    await ensureCacheDirs();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("cache:size", async () => {
  try {
    const baseDir = path.join(app.getPath("userData"), "videme-cache");
    let total = 0;
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(full);
        else { const stat = await fs.stat(full).catch(() => null); if (stat) total += stat.size; }
      }
    };
    await walk(baseDir);
    return { ok: true, bytes: total };
  } catch (err) {
    return { ok: false, error: err.message, bytes: 0 };
  }
});

ipcMain.handle("ffmpeg:make-proxy", async (event, payload) => {
  const { inputPath, height = 540, jobId } = payload || {};
  if (!inputPath) return { ok: false, error: "Input path kosong." };
  const cacheDir = getCacheDir("proxies");
  await fs.mkdir(cacheDir, { recursive: true }).catch(() => {});
  const name = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(cacheDir, `${name}_proxy${height}p.mp4`);
  const args = [
    "-i", inputPath,
    "-vf", `scale=-2:${height}`,
    "-c:v", "libx264", "-crf", "23", "-preset", "ultrafast",
    "-c:a", "aac", "-b:a", "96k",
    outputPath
  ];
  const result = await runBinaryWithProgress("ffmpeg", ["-y", "-progress", "pipe:2", ...args], {
    timeoutMs: 60 * 60 * 1000, jobId,
    onProgress: (data) => { if (jobId) event.sender.send(`ffmpeg:progress:${jobId}`, data); }
  });
  return result.ok ? { ok: true, outputPath } : { ok: false, error: result.stderr || "Proxy gagal." };
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1120,
    minHeight: 680,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(async () => {
  await loadLocalEnv();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
