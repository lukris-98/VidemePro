const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const FFMPEG_TIMEOUT_MS = 30_000;
const PEXELS_API_BASE = "https://api.pexels.com/v1";
const PIXABAY_API_BASE = "https://pixabay.com/api";
const SPOTIFY_RAPIDAPI_HOST = "spotify23.p.rapidapi.com";
const APIFRAME_API_BASE = "https://api.apiframe.ai/v2";
const APIFRAME_KEYS_FILE = "apiframe-keys.json";
const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_KEYS_FILE = "openrouter-keys.json";
const DEFAULT_VIDME_ROOT_DIR = "C:\\Vidme Pro";
let vidmeRootDir = DEFAULT_VIDME_ROOT_DIR;

// Map of active transcoding processes: jobId -> child process
const activeJobs = new Map();
let runtimeApiframeKeys = [];
let runtimeOpenrouterKeys = [];

function normalizeVidmeRootDir(dir) {
  const value = String(dir || "").trim().replace(/^["']|["']$/g, "");
  return value ? path.resolve(value) : DEFAULT_VIDME_ROOT_DIR;
}

function getVidmeRootDir() {
  return vidmeRootDir;
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getUnifiedApiKeyDir() {
  return path.join(getVidmeRootDir(), "API KEY");
}

function getUnifiedApiKeyFile() {
  return path.join(getUnifiedApiKeyDir(), "API KEY.txt");
}

function getOldUnifiedApiKeyFile() {
  return path.join(getVidmeRootDir(), "API KEY.txt");
}

function getAutoFillDir() {
  return path.join(getVidmeRootDir(), "AUTO FILL");
}

function getAutoFillFile() {
  return path.join(getAutoFillDir(), "AUTO FILL.txt");
}

function getOldAutoFillFile() {
  return path.join(getVidmeRootDir(), "AUTO FILL.txt");
}

function maskApiKey(key) {
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 3)}...${key.slice(-3)}`;
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyMergeDirectory(from, to) {
  const entries = await fs.readdir(from, { withFileTypes: true }).catch(() => []);
  await fs.mkdir(to, { recursive: true });
  for (const entry of entries) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) await copyMergeDirectory(source, target);
    else if (!(await pathExists(target))) await fs.copyFile(source, target);
  }
}

async function mergeAndRemoveDirectory(from, to) {
  if (!(await pathExists(from))) return;
  await copyMergeDirectory(from, to);
  await fs.rm(from, { recursive: true, force: true });
}

async function renameDirectoryPretty(parent, fromName, toName) {
  const from = path.join(parent, fromName);
  const to = path.join(parent, toName);
  if (!(await pathExists(from))) return;
  if (from.toLowerCase() === to.toLowerCase()) {
    if (fromName === toName) return;
    const tmp = path.join(parent, `${toName}.__vidme_tmp__${Date.now()}`);
    await fs.rename(from, tmp);
    await fs.rename(tmp, to);
    return;
  }
  if (await pathExists(to)) await mergeAndRemoveDirectory(from, to);
  else await fs.rename(from, to);
}

async function normalizeMediaFolders() {
  const mediaRoot = path.join(getVidmeRootDir(), "Media");
  const mediaEntries = await fs.readdir(mediaRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of mediaEntries) {
    if (!entry.isDirectory()) continue;
    const prettyProvider = providerFolderName(entry.name);
    await renameDirectoryPretty(mediaRoot, entry.name, prettyProvider);
    const providerDir = path.join(mediaRoot, prettyProvider);
    const typeEntries = await fs.readdir(providerDir, { withFileTypes: true }).catch(() => []);
    for (const typeEntry of typeEntries) {
      if (!typeEntry.isDirectory()) continue;
      const lower = typeEntry.name.toLowerCase();
      if (["image", "images", "gambar", "photo", "photos"].includes(lower)) {
        await renameDirectoryPretty(providerDir, typeEntry.name, "Gambar");
      } else if (["video", "videos"].includes(lower)) {
        await renameDirectoryPretty(providerDir, typeEntry.name, "Video");
      }
    }
  }
}

async function moveVidmeRoot(fromRoot, toRoot) {
  const from = normalizeVidmeRootDir(fromRoot);
  const to = normalizeVidmeRootDir(toRoot);
  if (from.toLowerCase() === to.toLowerCase()) return { moved: false };
  if (to.toLowerCase().startsWith(`${from.toLowerCase()}\\`)) {
    throw new Error("Lokasi baru tidak boleh berada di dalam folder lama.");
  }
  if (!(await pathExists(from))) {
    await fs.mkdir(to, { recursive: true });
    return { moved: false };
  }
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
    return { moved: true };
  } catch {
    await copyMergeDirectory(from, to);
    await fs.rm(from, { recursive: true, force: true });
    return { moved: true };
  }
}

async function loadVidmeSettings() {
  try {
    const parsed = JSON.parse(await fs.readFile(getSettingsPath(), "utf8"));
    vidmeRootDir = normalizeVidmeRootDir(parsed?.rootDir || DEFAULT_VIDME_ROOT_DIR);
  } catch {
    vidmeRootDir = DEFAULT_VIDME_ROOT_DIR;
  }
  return { ok: true, rootDir: vidmeRootDir, defaultRootDir: DEFAULT_VIDME_ROOT_DIR, settingsFile: getSettingsPath() };
}

async function saveVidmeSettings(payload = {}) {
  const previous = (await loadVidmeSettings()).rootDir;
  const next = normalizeVidmeRootDir(payload.rootDir);
  const move = await moveVidmeRoot(previous, next);
  vidmeRootDir = next;
  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify({ rootDir: vidmeRootDir }, null, 2), "utf8");
  await migrateAutoFillHistory();
  return { ok: true, rootDir: vidmeRootDir, defaultRootDir: DEFAULT_VIDME_ROOT_DIR, settingsFile: getSettingsPath(), moved: move.moved };
}

async function browseVidmeRootFolder() {
  const current = (await loadVidmeSettings()).rootDir;
  const result = await dialog.showOpenDialog({
    title: "Pilih folder root Vidme Pro",
    defaultPath: current,
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, cancelled: true, rootDir: current };
  return saveVidmeSettings({ rootDir: result.filePaths[0] });
}

function getApiframeKeyPath() {
  return path.join(app.getPath("userData"), APIFRAME_KEYS_FILE);
}

function getOpenrouterKeyPath() {
  return path.join(app.getPath("userData"), OPENROUTER_KEYS_FILE);
}

function normalizeKeyList(keys = []) {
  return [...new Set(keys.map((key) => String(key || "").trim()).filter(Boolean))];
}

function parseUnifiedApiKeyText(text = "") {
  const result = { apiframe: [], openrouter: [] };
  let section = "";
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^\[.*\]$/.test(line)) {
      section = line.toLowerCase();
      continue;
    }
    if (section.includes("apiframe") || section.includes("music")) result.apiframe.push(line);
    if (section.includes("openrouter") || section.includes("auto")) result.openrouter.push(line);
  }
  return { apiframe: normalizeKeyList(result.apiframe), openrouter: normalizeKeyList(result.openrouter) };
}

function formatUnifiedApiKeyFile({ apiframe = [], openrouter = [] } = {}) {
  return [
    "# Vidme Pro API KEY.txt",
    "# Auto-updated by Vidme Pro. One API key per line.",
    `# Location: ${getUnifiedApiKeyFile()}`,
    "",
    "[MUSIC AI CREATOR - APIFRAME]",
    ...normalizeKeyList(apiframe),
    "",
    "[AI AUTO FILL - OPENROUTER]",
    ...normalizeKeyList(openrouter),
    ""
  ].join("\r\n");
}

async function readUnifiedApiKeys() {
  await loadVidmeSettings();
  let current = { apiframe: [], openrouter: [] };
  try {
    current = parseUnifiedApiKeyText(await fs.readFile(getUnifiedApiKeyFile(), "utf8"));
  } catch {}
  try {
    const old = parseUnifiedApiKeyText(await fs.readFile(getOldUnifiedApiKeyFile(), "utf8"));
    return { apiframe: normalizeKeyList([...current.apiframe, ...old.apiframe]), openrouter: normalizeKeyList([...current.openrouter, ...old.openrouter]) };
  } catch {
    return current;
  }
}

async function saveUnifiedApiKeyFile() {
  await loadVidmeSettings();
  await fs.mkdir(getUnifiedApiKeyDir(), { recursive: true });
  await fs.writeFile(getUnifiedApiKeyFile(), formatUnifiedApiKeyFile({ apiframe: runtimeApiframeKeys, openrouter: runtimeOpenrouterKeys }), "utf8");
  return { ok: true, path: getUnifiedApiKeyFile(), apiframe: runtimeApiframeKeys, openrouter: runtimeOpenrouterKeys };
}

function normalizeAutoFillItems(items = []) {
  return Array.isArray(items)
    ? items
        .filter(Boolean)
        .map((item) => ({
          id: String(item.id || `${Date.now()}-${Math.random()}`),
          type: item.type === "instrumental" ? "instrumental" : "vocal",
          title: String(item.title || "").slice(0, 80),
          lyrics: String(item.lyrics || "").slice(0, 5000),
          description: String(item.description || item.style || "").slice(0, 1000),
          idea: String(item.idea || "").slice(0, 1000),
          model: String(item.model || ""),
          createdAt: Number(item.createdAt) || Date.now()
        }))
    : [];
}

async function readAutoFillHistory() {
  await loadVidmeSettings();
  try {
    const parsed = JSON.parse(await fs.readFile(getAutoFillFile(), "utf8"));
    const current = normalizeAutoFillItems(parsed?.items || parsed);
    try {
      const oldParsed = JSON.parse(await fs.readFile(getOldAutoFillFile(), "utf8"));
      return normalizeAutoFillItems([...current, ...(oldParsed?.items || oldParsed)]);
    } catch {
      return current;
    }
  } catch {
    try {
      const oldParsed = JSON.parse(await fs.readFile(getOldAutoFillFile(), "utf8"));
      return normalizeAutoFillItems(oldParsed?.items || oldParsed);
    } catch {
      return [];
    }
  }
}

async function saveAutoFillHistory(payload = {}) {
  await loadVidmeSettings();
  const items = normalizeAutoFillItems(payload.items || []).sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
  await fs.mkdir(getAutoFillDir(), { recursive: true });
  await fs.writeFile(getAutoFillFile(), JSON.stringify({ items }, null, 2), "utf8");
  return { ok: true, path: getAutoFillFile(), items };
}

async function migrateAutoFillHistory() {
  const oldPath = getOldAutoFillFile();
  if (!(await pathExists(oldPath))) return;
  const items = await readAutoFillHistory();
  await fs.mkdir(getAutoFillDir(), { recursive: true });
  await fs.writeFile(getAutoFillFile(), JSON.stringify({ items }, null, 2), "utf8");
  await fs.rm(oldPath, { force: true }).catch(() => {});
}

async function loadStoredApiframeKeys() {
  try {
    const raw = await fs.readFile(getApiframeKeyPath(), "utf8");
    const parsed = JSON.parse(raw);
    runtimeApiframeKeys = Array.isArray(parsed?.keys) ? parsed.keys.filter((key) => typeof key === "string" && key.trim()) : [];
  } catch {
    runtimeApiframeKeys = [];
  }
  const unified = await readUnifiedApiKeys();
  runtimeApiframeKeys = normalizeKeyList([...runtimeApiframeKeys, ...unified.apiframe]);
}

async function saveStoredApiframeKeys() {
  await fs.writeFile(getApiframeKeyPath(), JSON.stringify({ keys: runtimeApiframeKeys }, null, 2), "utf8");
  await saveUnifiedApiKeyFile();
}

async function loadStoredOpenrouterKeys() {
  try {
    const raw = await fs.readFile(getOpenrouterKeyPath(), "utf8");
    const parsed = JSON.parse(raw);
    runtimeOpenrouterKeys = Array.isArray(parsed?.keys) ? parsed.keys.filter((key) => typeof key === "string" && key.trim()) : [];
  } catch {
    runtimeOpenrouterKeys = [];
  }
  const unified = await readUnifiedApiKeys();
  runtimeOpenrouterKeys = normalizeKeyList([...runtimeOpenrouterKeys, ...unified.openrouter]);
}

async function saveStoredOpenrouterKeys() {
  await fs.writeFile(getOpenrouterKeyPath(), JSON.stringify({ keys: runtimeOpenrouterKeys }, null, 2), "utf8");
  await saveUnifiedApiKeyFile();
}

function getAllApiframeKeys() {
  const envKey = process.env.APIFRAME_API_KEY || "";
  const keys = [...runtimeApiframeKeys];
  if (envKey && !keys.includes(envKey)) keys.unshift(envKey);
  return keys;
}

function getAllOpenrouterKeys() {
  const envKey = process.env.OPENROUTER_API_KEY || "";
  const keys = [...runtimeOpenrouterKeys];
  if (envKey && !keys.includes(envKey)) keys.unshift(envKey);
  return keys;
}

async function getApiframeUserInfo(apiKey) {
  try {
    const response = await fetch(`${APIFRAME_API_BASE}/me`, {
      method: "GET",
      headers: { "X-API-Key": apiKey }
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      return { ok: false, error: data?.error || text || `Apiframe gagal (${response.status}).` };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membaca info user Apiframe." };
  }
}

async function listApiframeKeys({ checkCredits = false } = {}) {
  const unified = await readUnifiedApiKeys();
  runtimeApiframeKeys = normalizeKeyList([...runtimeApiframeKeys, ...unified.apiframe]);
  const keys = getAllApiframeKeys();
  const entries = keys.map((key, index) => ({
    id: key,
    index: index + 1,
    masked: maskApiKey(key),
    credit: null,
    connected: false,
    source: key === process.env.APIFRAME_API_KEY ? "env" : "saved"
  }));
  if (!checkCredits) return entries;
  return Promise.all(entries.map(async (entry) => {
    const info = await getApiframeUserInfo(entry.id);
    if (!info.ok) return { ...entry, error: info.error };
    return {
      ...entry,
      connected: true,
      credit: Number(info.data?.team?.credits ?? 0),
      userEmail: info.data?.user?.email || "",
      teamName: info.data?.team?.name || "",
      plan: info.data?.team?.plan || "",
      apiKeyName: info.data?.apiKey?.name || ""
    };
  }));
}

function getActiveApiframeKey() {
  return runtimeApiframeKeys[0] || process.env.APIFRAME_API_KEY || "";
}

function getActiveOpenrouterKey() {
  return runtimeOpenrouterKeys[0] || process.env.OPENROUTER_API_KEY || "";
}

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

function providerFolderName(provider) {
  const clean = sanitizeFilename(provider, "Remote").toLowerCase();
  if (clean === "pexels") return "Pexels";
  if (clean === "pixabay") return "Pixabay";
  if (clean === "giphy") return "Giphy";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function mediaTypeFolderName(type) {
  return String(type || "").toLowerCase() === "video" || String(type || "").toLowerCase() === "videos" ? "Video" : "Gambar";
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
  await loadVidmeSettings();
  await normalizeMediaFolders();
  const url = String(payload.url || "").trim();
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "URL asset tidak valid." };
  const provider = providerFolderName(payload.provider || "remote");
  const type = payload.type === "video" ? "videos" : "images";
  const fallbackExt = payload.type === "video" ? "mp4" : "jpg";
  const nameExt = guessExtensionFromName(payload.name);
  const ext = guessExtensionFromUrl(url, nameExt || fallbackExt);
  const baseName = sanitizeFilename(payload.name || `${provider}-${Date.now()}.${ext}`);
  const fileName = guessExtensionFromName(baseName) ? baseName : `${baseName}.${ext}`;
  const targetDir = path.join(getVidmeRootDir(), "Media", provider, mediaTypeFolderName(type));
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

async function listDownloadedAssets(payload = {}) {
  await loadVidmeSettings();
  await normalizeMediaFolders();
  const provider = providerFolderName(payload.provider || "remote");
  const providerDir = path.join(getVidmeRootDir(), "Media", provider);
  const folders = [
    { dir: path.join(providerDir, "Gambar"), type: "image" },
    { dir: path.join(providerDir, "Video"), type: "video" }
  ];
  const items = [];
  for (const folder of folders) {
    const entries = await fs.readdir(folder.dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(folder.dir, entry.name);
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) continue;
      const parsed = path.parse(entry.name);
      items.push({
        id: `${provider.toLowerCase()}-${folder.type}-${parsed.name}`,
        type: folder.type,
        name: entry.name,
        path: filePath,
        url: pathToFileURL(filePath).href,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      });
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { ok: true, provider, items };
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

async function getSpotifyTrackLyrics(payload = {}) {
  const id = String(payload.id || "").trim();
  const apiKey = process.env.RAPIDAPI_KEY || "";
  if (!id) return { ok: false, error: "Track ID masih kosong." };
  if (!apiKey) return { ok: false, error: "RAPIDAPI_KEY belum dikonfigurasi di .env.local." };

  const url = new URL(`https://${SPOTIFY_RAPIDAPI_HOST}/track_lyrics/`);
  url.searchParams.set("id", id);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": SPOTIFY_RAPIDAPI_HOST
    }
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: `RapidAPI gagal (${response.status}). ${text}`.trim() };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: "Response RapidAPI bukan JSON valid." };
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    return { ok: response.ok, status: response.status, data, text };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      text: error instanceof Error && error.name === "AbortError" ? `Request timeout setelah ${Math.round(timeoutMs / 1000)} detik.` : error instanceof Error ? error.message : "Request gagal."
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function apiframeRequest(pathname, options = {}) {
  const apiKey = getActiveApiframeKey();
  if (!apiKey) return { ok: false, error: "Belum ada Apiframe API Key terhubung." };
  const result = await fetchJsonWithTimeout(`${APIFRAME_API_BASE}${pathname}`, {
    ...options,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  }, 35000);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.data?.error || result.text || "Apiframe request gagal.", details: result.data?.details || null };
  }
  return { ok: true, data: result.data };
}

async function generateApiframeMusic(payload = {}) {
  const prompt = String(payload.prompt || "").trim();
  const model = String(payload.model || "suno").trim();
  if (!prompt) return { ok: false, error: "Prompt music masih kosong." };
  const body = { prompt, model };
  if (payload.sunoParams) body.sunoParams = payload.sunoParams;
  if (payload.udioParams) body.udioParams = payload.udioParams;
  if (payload.murekaParams) body.murekaParams = payload.murekaParams;
  if (payload.lyriaParams) body.lyriaParams = payload.lyriaParams;
  if (payload.elevenlabsParams) body.elevenlabsParams = payload.elevenlabsParams;
  return apiframeRequest("/music/generate", { method: "POST", body: JSON.stringify(body) });
}

async function getApiframeJob(payload = {}) {
  const jobId = String(payload.jobId || "").trim();
  if (!jobId) return { ok: false, error: "Job ID kosong." };
  return apiframeRequest(`/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
}

async function getOpenrouterKeyInfo(apiKey) {
  try {
    const response = await fetch(`${OPENROUTER_API_BASE}/key`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      return { ok: false, error: data?.error?.message || data?.error || text || `OpenRouter gagal (${response.status}).` };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Gagal membaca info OpenRouter." };
  }
}

async function listOpenrouterKeys({ checkCredits = false } = {}) {
  const unified = await readUnifiedApiKeys();
  runtimeOpenrouterKeys = normalizeKeyList([...runtimeOpenrouterKeys, ...unified.openrouter]);
  const keys = getAllOpenrouterKeys();
  const entries = keys.map((key, index) => ({
    id: key,
    index: index + 1,
    masked: maskApiKey(key),
    credit: null,
    connected: false,
    source: key === process.env.OPENROUTER_API_KEY ? "env" : "saved"
  }));
  if (!checkCredits) return entries;
  return Promise.all(entries.map(async (entry) => {
    const info = await getOpenrouterKeyInfo(entry.id);
    if (!info.ok) return { ...entry, error: info.error };
    const data = info.data?.data || info.data || {};
    const limit = Number(data.limit ?? data.credit_limit ?? NaN);
    const usage = Number(data.usage ?? data.usage_total ?? 0);
    const credit = Number.isFinite(limit) ? Math.max(0, limit - usage) : null;
    return {
      ...entry,
      connected: true,
      credit,
      userEmail: data.label || data.name || "",
      limit: Number.isFinite(limit) ? limit : null,
      usage: Number.isFinite(usage) ? usage : null
    };
  }));
}

async function addApiframeKeys(payload = {}) {
  const keys = String(payload.keys || "")
    .split(/\r?\n/)
    .map((key) => key.trim())
    .filter(Boolean);
  if (!keys.length) return { ok: false, error: "API Key masih kosong." };
  runtimeApiframeKeys = [...new Set([...runtimeApiframeKeys, ...keys])];
  await saveStoredApiframeKeys();
  return { ok: true, keys: await listApiframeKeys({ checkCredits: true }) };
}

async function addOpenrouterKeys(payload = {}) {
  const keys = String(payload.keys || "")
    .split(/\r?\n/)
    .map((key) => key.trim())
    .filter(Boolean);
  if (!keys.length) return { ok: false, error: "OpenRouter API Key masih kosong." };
  runtimeOpenrouterKeys = [...new Set([...runtimeOpenrouterKeys, ...keys])];
  await saveStoredOpenrouterKeys();
  return { ok: true, keys: await listOpenrouterKeys({ checkCredits: true }) };
}

async function removeApiframeKey(payload = {}) {
  const id = String(payload.id || "");
  runtimeApiframeKeys = runtimeApiframeKeys.filter((key) => key !== id);
  await saveStoredApiframeKeys();
  return { ok: true, keys: await listApiframeKeys({ checkCredits: true }) };
}

async function removeOpenrouterKey(payload = {}) {
  const id = String(payload.id || "");
  runtimeOpenrouterKeys = runtimeOpenrouterKeys.filter((key) => key !== id);
  await saveStoredOpenrouterKeys();
  return { ok: true, keys: await listOpenrouterKeys({ checkCredits: true }) };
}

function sanitizeGeneratedName(name, fallback) {
  const cleaned = String(name || fallback || "generated-audio")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback || "generated-audio";
}

async function saveGeneratedAsset(payload = {}) {
  await loadVidmeSettings();
  const rawKind = String(payload.kind || "audio").toLowerCase();
  const kind = rawKind === "music" ? "music" : rawKind === "voice-clone" ? "voice-clone" : "voice";
  const bytes = payload.bytes;
  if (!bytes?.length) return { ok: false, error: "Data file kosong." };
  const filename = sanitizeGeneratedName(payload.filename, `${kind}-${Date.now()}.wav`);
  const folderParts = kind === "music" ? ["MUSIC"] : kind === "voice-clone" ? ["VOICE", "Clone"] : ["VOICE", "General"];
  const targetDir = path.join(getVidmeRootDir(), ...folderParts);
  await fs.mkdir(targetDir, { recursive: true });
  let targetPath = path.join(targetDir, filename);
  const parsed = path.parse(targetPath);
  let counter = 1;
  while (true) {
    try {
      await fs.access(targetPath);
      targetPath = path.join(parsed.dir, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } catch {
      break;
    }
  }
  const buffer = Buffer.from(bytes);
  await fs.writeFile(targetPath, buffer);
  return {
    ok: true,
    path: targetPath,
    url: pathToFileURL(targetPath).href,
    name: path.basename(targetPath),
    size: buffer.byteLength,
    folder: targetDir
  };
}

async function completeOpenrouterChat(payload = {}) {
  const apiKey = getActiveOpenrouterKey();
  if (!apiKey) return { ok: false, error: "Belum ada OpenRouter API Key terhubung." };
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.length) return { ok: false, error: "Prompt Auto Fill masih kosong." };
  const result = await fetchJsonWithTimeout(`${OPENROUTER_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://vidme.pro",
      "X-OpenRouter-Title": "Vidme Pro"
    },
    body: JSON.stringify({
      model: payload.model || "~openai/gpt-latest",
      messages,
      temperature: Number.isFinite(payload.temperature) ? payload.temperature : 0.7,
      response_format: { type: "json_object" }
    })
  }, Number(payload.timeoutMs) || 45000);
  if (!result.ok) return { ok: false, status: result.status, error: result.data?.error?.message || result.data?.error || result.text || "OpenRouter request gagal." };
  return { ok: true, data: result.data };
}

async function openExternalUrl(payload = {}) {
  const url = String(payload.url || "");
  if (!/^https:\/\/(apiframe\.ai|openrouter\.ai)(\/|$)/i.test(url)) return { ok: false, error: "URL tidak diizinkan." };
  await shell.openExternal(url);
  return { ok: true };
}

async function openUnifiedApiKeyFile() {
  await saveUnifiedApiKeyFile();
  shell.showItemInFolder(getUnifiedApiKeyFile());
  return { ok: true, path: getUnifiedApiKeyFile() };
}

async function openAutoFillFile() {
  await saveAutoFillHistory({ items: await readAutoFillHistory() });
  shell.showItemInFolder(getAutoFillFile());
  return { ok: true, path: getAutoFillFile() };
}

ipcMain.handle("ffmpeg:get-capabilities", async () => getFFmpegCapabilities());

ipcMain.handle("pexels:search", async (_event, payload) => searchPexels(payload));
ipcMain.handle("pixabay:search", async (_event, payload) => searchPixabay(payload));
ipcMain.handle("spotify:track-lyrics", async (_event, payload) => getSpotifyTrackLyrics(payload));
ipcMain.handle("asset:download", async (_event, payload) => downloadRemoteAsset(payload));
ipcMain.handle("asset:list-downloaded", async (_event, payload) => listDownloadedAssets(payload));
ipcMain.handle("apiframe:music-generate", async (_event, payload) => generateApiframeMusic(payload));
ipcMain.handle("apiframe:job", async (_event, payload) => getApiframeJob(payload));
ipcMain.handle("apiframe:keys-list", async (_event, payload = {}) => ({ ok: true, keys: await listApiframeKeys({ checkCredits: Boolean(payload.checkCredits) }) }));
ipcMain.handle("apiframe:keys-add", async (_event, payload) => addApiframeKeys(payload));
ipcMain.handle("apiframe:key-remove", async (_event, payload) => removeApiframeKey(payload));
ipcMain.handle("openrouter:keys-list", async (_event, payload = {}) => ({ ok: true, keys: await listOpenrouterKeys({ checkCredits: Boolean(payload.checkCredits) }) }));
ipcMain.handle("openrouter:keys-add", async (_event, payload) => addOpenrouterKeys(payload));
ipcMain.handle("openrouter:key-remove", async (_event, payload) => removeOpenrouterKey(payload));
ipcMain.handle("openrouter:chat-complete", async (_event, payload) => completeOpenrouterChat(payload));
ipcMain.handle("generated:save", async (_event, payload) => saveGeneratedAsset(payload));
ipcMain.handle("shell:open-external", async (_event, payload) => openExternalUrl(payload));
ipcMain.handle("api-key-file:open", async () => openUnifiedApiKeyFile());
ipcMain.handle("auto-fill-file:list", async () => ({ ok: true, path: getAutoFillFile(), items: await readAutoFillHistory() }));
ipcMain.handle("auto-fill-file:save", async (_event, payload) => saveAutoFillHistory(payload));
ipcMain.handle("auto-fill-file:open", async () => openAutoFillFile());
ipcMain.handle("settings:get", async () => loadVidmeSettings());
ipcMain.handle("settings:browse", async () => browseVidmeRootFolder());
ipcMain.handle("settings:save", async (_event, payload) => saveVidmeSettings(payload));

ipcMain.handle("file:exists", async (_event, payload) => {
  const filePath = payload?.filePath;
  if (!filePath) return { ok: false, exists: false };
  try {
    const stat = await fs.stat(filePath);
    return { ok: true, exists: stat.isFile(), size: stat.size, mtimeMs: stat.mtimeMs };
  } catch {
    return { ok: true, exists: false };
  }
});

ipcMain.handle("file:read-audio", async (_event, payload) => {
  const filePath = payload?.filePath;
  if (!filePath) return { ok: false, error: "Path file kosong." };
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".wav" ? "audio/wav" :
      ext === ".mp3" ? "audio/mpeg" :
      ext === ".ogg" ? "audio/ogg" :
      ext === ".m4a" ? "audio/mp4" :
      "audio/*";
    return { ok: true, name: path.basename(filePath), path: filePath, size: buffer.byteLength, mime, bytes: [...buffer] };
  } catch (error) {
    return { ok: false, error: error.message || "Gagal membaca file audio." };
  }
});

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
  await loadVidmeSettings();
  await migrateAutoFillHistory();
  await loadStoredApiframeKeys();
  await loadStoredOpenrouterKeys();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
