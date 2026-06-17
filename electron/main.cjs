const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const FFMPEG_TIMEOUT_MS = 30_000;

// Map of active transcoding processes: jobId -> child process
const activeJobs = new Map();

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

ipcMain.handle("ffmpeg:get-capabilities", async () => getFFmpegCapabilities());

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

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
