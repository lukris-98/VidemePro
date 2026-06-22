import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";

const DEFAULT_VIDME_ROOT_DIR = "C:\\Vidme Pro";
const SETTINGS_DIR = path.join(process.env.APPDATA || DEFAULT_VIDME_ROOT_DIR, "Vidme Pro");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");
let vidmeRootDir = DEFAULT_VIDME_ROOT_DIR;

const apiKeyDir = () => path.join(vidmeRootDir, "API KEY");
const apiKeyFile = () => path.join(apiKeyDir(), "API KEY.txt");
const oldApiKeyFile = () => path.join(vidmeRootDir, "API KEY.txt");
const autoFillDir = () => path.join(vidmeRootDir, "AUTO FILL");
const autoFillFile = () => path.join(autoFillDir(), "AUTO FILL.txt");
const oldAutoFillFile = () => path.join(vidmeRootDir, "AUTO FILL.txt");

function normalizeKeys(keys = []) {
  return [...new Set(keys.map((key) => String(key || "").trim()).filter(Boolean))];
}

function sanitizeName(name, fallback = "file") {
  const clean = String(name || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").trim();
  return clean || fallback;
}

function providerFolderName(provider) {
  const clean = sanitizeName(provider, "Remote").toLowerCase();
  if (clean === "pexels") return "Pexels";
  if (clean === "pixabay") return "Pixabay";
  if (clean === "giphy") return "Giphy";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function mediaTypeFolderName(type) {
  return String(type || "").toLowerCase() === "video" ? "Video" : "Gambar";
}

function mediaMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function readRequestBuffer(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function normalizeRootDir(dir) {
  const value = String(dir || "").trim().replace(/^["']|["']$/g, "");
  return value ? path.resolve(value) : DEFAULT_VIDME_ROOT_DIR;
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
  const mediaRoot = path.join(vidmeRootDir, "Media");
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
  const from = normalizeRootDir(fromRoot);
  const to = normalizeRootDir(toRoot);
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
    const parsed = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
    vidmeRootDir = normalizeRootDir(parsed?.rootDir || DEFAULT_VIDME_ROOT_DIR);
  } catch {
    vidmeRootDir = DEFAULT_VIDME_ROOT_DIR;
  }
  return { rootDir: vidmeRootDir, defaultRootDir: DEFAULT_VIDME_ROOT_DIR, settingsFile: SETTINGS_FILE };
}

async function saveVidmeSettings(rootDir) {
  const previous = (await loadVidmeSettings()).rootDir;
  const next = normalizeRootDir(rootDir);
  const move = await moveVidmeRoot(previous, next);
  vidmeRootDir = next;
  await fs.mkdir(SETTINGS_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify({ rootDir: vidmeRootDir }, null, 2), "utf8");
  await migrateAutoFillFile();
  return { ok: true, rootDir: vidmeRootDir, defaultRootDir: DEFAULT_VIDME_ROOT_DIR, settingsFile: SETTINGS_FILE, moved: move.moved };
}

function pickFolderWithPowerShell() {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Pilih folder root Vidme Pro'",
    "$dialog.ShowNewFolderButton = $true",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }"
  ].join("; ");
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-STA", "-Command", script], { windowsHide: true }, (_error, stdout) => {
      resolve(String(stdout || "").trim());
    });
  });
}

async function saveBinaryToVidme(folderParts, filename, buffer) {
  await loadVidmeSettings();
  if (String(folderParts[0] || "").toLowerCase() === "media") await normalizeMediaFolders();
  const safeParts = folderParts.map((part) => sanitizeName(part, "MEDIA"));
  const targetDir = path.join(vidmeRootDir, ...safeParts);
  await fs.mkdir(targetDir, { recursive: true });
  const parsed = path.parse(sanitizeName(filename, `asset-${Date.now()}`));
  let targetPath = path.join(targetDir, `${parsed.name}${parsed.ext}`);
  let counter = 1;
  while (true) {
    try {
      await fs.access(targetPath);
      targetPath = path.join(targetDir, `${parsed.name}-${counter}${parsed.ext}`);
      counter += 1;
    } catch {
      break;
    }
  }
  await fs.writeFile(targetPath, buffer);
  return { path: targetPath, url: `file:///${targetPath.replace(/\\/g, "/")}`, name: path.basename(targetPath), size: buffer.byteLength, folder: targetDir };
}

async function listDownloadedAssets(providerValue) {
  await loadVidmeSettings();
  await normalizeMediaFolders();
  const provider = providerFolderName(providerValue || "remote");
  const providerDir = path.join(vidmeRootDir, "Media", provider);
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
        url: `file:///${filePath.replace(/\\/g, "/")}`,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      });
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { ok: true, provider, items };
}

async function downloadUrlToVidme(folderParts, filename, sourceUrl) {
  if (!/^https?:\/\//i.test(String(sourceUrl || ""))) throw new Error("URL media tidak valid.");
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Download gagal (${response.status}).`);
  return saveBinaryToVidme(folderParts, filename, Buffer.from(await response.arrayBuffer()));
}

function parseApiKeyFile(text = "") {
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
  return { apiframe: normalizeKeys(result.apiframe), openrouter: normalizeKeys(result.openrouter) };
}

function formatApiKeyFile({ apiframe = [], openrouter = [] } = {}) {
  return [
    "# Vidme Pro API KEY.txt",
    "# Auto-updated by Vidme Pro. One API key per line.",
    `# Location: ${apiKeyFile()}`,
    "",
    "[MUSIC AI CREATOR - APIFRAME]",
    ...normalizeKeys(apiframe),
    "",
    "[AI AUTO FILL - OPENROUTER]",
    ...normalizeKeys(openrouter),
    ""
  ].join("\r\n");
}

async function readApiKeyFile() {
  await loadVidmeSettings();
  let current = { apiframe: [], openrouter: [] };
  try {
    current = parseApiKeyFile(await fs.readFile(apiKeyFile(), "utf8"));
  } catch {}
  try {
    const old = parseApiKeyFile(await fs.readFile(oldApiKeyFile(), "utf8"));
    return { apiframe: normalizeKeys([...current.apiframe, ...old.apiframe]), openrouter: normalizeKeys([...current.openrouter, ...old.openrouter]) };
  } catch {
    return current;
  }
}

async function writeApiKeyFile(payload = {}) {
  const current = await readApiKeyFile();
  const next = {
    apiframe: normalizeKeys(payload.apiframe ?? current.apiframe),
    openrouter: normalizeKeys(payload.openrouter ?? current.openrouter)
  };
  await fs.mkdir(apiKeyDir(), { recursive: true });
  await fs.writeFile(apiKeyFile(), formatApiKeyFile(next), "utf8");
  return next;
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

async function readAutoFillFile() {
  await loadVidmeSettings();
  try {
    const parsed = JSON.parse(await fs.readFile(autoFillFile(), "utf8"));
    const current = normalizeAutoFillItems(parsed?.items || parsed);
    try {
      const oldParsed = JSON.parse(await fs.readFile(oldAutoFillFile(), "utf8"));
      return normalizeAutoFillItems([...current, ...(oldParsed?.items || oldParsed)]);
    } catch {
      return current;
    }
  } catch {
    try {
      const oldParsed = JSON.parse(await fs.readFile(oldAutoFillFile(), "utf8"));
      return normalizeAutoFillItems(oldParsed?.items || oldParsed);
    } catch {
      return [];
    }
  }
}

async function writeAutoFillFile(items = []) {
  await loadVidmeSettings();
  const normalized = normalizeAutoFillItems(items).sort((a, b) => b.createdAt - a.createdAt).slice(0, 300);
  await fs.mkdir(autoFillDir(), { recursive: true });
  await fs.writeFile(autoFillFile(), JSON.stringify({ items: normalized }, null, 2), "utf8");
  return normalized;
}

async function migrateAutoFillFile() {
  const oldPath = oldAutoFillFile();
  const nextPath = autoFillFile();
  if (!(await pathExists(oldPath))) return;
  const items = await readAutoFillFile();
  await fs.mkdir(autoFillDir(), { recursive: true });
  await fs.writeFile(nextPath, JSON.stringify({ items }, null, 2), "utf8");
  await fs.rm(oldPath, { force: true }).catch(() => {});
}

function vidmeFileBridgePlugin() {
  return {
    name: "vidme-file-bridge",
    configureServer(server) {
      server.middlewares.use("/vidme-settings/get", async (_req, res) => {
        const settings = await loadVidmeSettings();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, ...settings }));
      });
      server.middlewares.use("/vidme-settings/save", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const settings = await saveVidmeSettings(parsed.rootDir);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(settings));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Gagal menyimpan seting." }));
          }
        });
      });
      server.middlewares.use("/vidme-settings/browse", async (_req, res) => {
        try {
          const selected = await pickFolderWithPowerShell();
          if (!selected) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, cancelled: true }));
            return;
          }
          const settings = await saveVidmeSettings(selected);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(settings));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Gagal memilih folder." }));
        }
      });
      server.middlewares.use("/vidme-api-key/list", async (_req, res) => {
        const data = await readApiKeyFile();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, path: apiKeyFile(), ...data }));
      });
      server.middlewares.use("/vidme-api-key/save", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", async () => {
          try {
            const data = await writeApiKeyFile(JSON.parse(body || "{}"));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, path: apiKeyFile(), ...data }));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed to save API KEY.txt" }));
          }
        });
      });
      server.middlewares.use("/vidme-api-key/open", async (_req, res) => {
        await writeApiKeyFile(await readApiKeyFile());
        spawn("explorer.exe", ["/select,", apiKeyFile()], { detached: true, stdio: "ignore", windowsHide: true }).unref();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, path: apiKeyFile() }));
      });
      server.middlewares.use("/vidme-auto-fill/list", async (_req, res) => {
        await migrateAutoFillFile();
        const items = await readAutoFillFile();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, path: autoFillFile(), items }));
      });
      server.middlewares.use("/vidme-auto-fill/save", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk.toString(); });
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const items = await writeAutoFillFile(parsed.items || []);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, path: autoFillFile(), items }));
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed to save AUTO FILL.txt" }));
          }
        });
      });
      server.middlewares.use("/vidme-auto-fill/open", async (_req, res) => {
        await writeAutoFillFile(await readAutoFillFile());
        spawn("explorer.exe", ["/select,", autoFillFile()], { detached: true, stdio: "ignore", windowsHide: true }).unref();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, path: autoFillFile() }));
      });
      server.middlewares.use("/vidme-generated/save", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const url = new URL(req.url || "", "http://localhost");
          const rawKind = String(url.searchParams.get("kind") || "").toLowerCase();
          const kindParts = rawKind === "music" ? ["MUSIC"] : rawKind === "voice-clone" ? ["VOICE", "Clone"] : ["VOICE", "General"];
          const filename = url.searchParams.get("filename") || `${kindParts.join("-").toLowerCase()}-${Date.now()}.mp3`;
          const saved = await saveBinaryToVidme(kindParts, filename, await readRequestBuffer(req));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, ...saved }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed to save generated asset" }));
        }
      });
      server.middlewares.use("/vidme-asset/save", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const url = new URL(req.url || "", "http://localhost");
          const provider = providerFolderName(url.searchParams.get("provider") || "remote");
          const type = mediaTypeFolderName(url.searchParams.get("type"));
          const filename = url.searchParams.get("filename") || `${provider}-${Date.now()}`;
          const saved = await saveBinaryToVidme(["Media", provider, type], filename, await readRequestBuffer(req));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, ...saved }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed to save media asset" }));
        }
      });
      server.middlewares.use("/vidme-asset/download-url", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method not allowed");
          return;
        }
        try {
          const url = new URL(req.url || "", "http://localhost");
          const provider = providerFolderName(url.searchParams.get("provider") || "remote");
          const type = mediaTypeFolderName(url.searchParams.get("type"));
          const filename = url.searchParams.get("filename") || `${provider}-${Date.now()}`;
          const sourceUrl = url.searchParams.get("url") || "";
          const saved = await downloadUrlToVidme(["Media", provider, type], filename, sourceUrl);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, ...saved }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed to download media asset" }));
        }
      });
      server.middlewares.use("/vidme-asset/list", async (req, res) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const result = await listDownloadedAssets(url.searchParams.get("provider"));
          result.items = result.items.map((item) => ({
            ...item,
            url: `/vidme-asset/file?path=${encodeURIComponent(item.path)}`
          }));
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Failed to list media assets" }));
        }
      });
      server.middlewares.use("/vidme-asset/file", async (req, res) => {
        try {
          const url = new URL(req.url || "", "http://localhost");
          const filePath = path.resolve(url.searchParams.get("path") || "");
          const root = path.resolve(vidmeRootDir);
          if (!filePath.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) {
            res.statusCode = 403;
            res.end("Forbidden");
            return;
          }
          const buffer = await fs.readFile(filePath);
          res.setHeader("Content-Type", mediaMimeType(filePath));
          res.end(buffer);
        } catch {
          res.statusCode = 404;
          res.end("Not found");
        }
      });
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), vidmeFileBridgePlugin()],
  server: {
    host: "0.0.0.0",
    port: 5174,
    strictPort: true,
    proxy: {
      "/apiframe-proxy": {
        target: "https://api.apiframe.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/apiframe-proxy/, "")
      },
      "/openrouter-proxy": {
        target: "https://openrouter.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/openrouter-proxy/, "")
      }
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
    strictPort: true
  }
});
