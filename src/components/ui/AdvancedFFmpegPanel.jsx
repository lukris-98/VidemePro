import React, { useState, useEffect, useCallback } from "react";
import { Search, Terminal, X, ChevronRight, Save, Play, Loader2, Trash2, HardDrive } from "lucide-react";
import { getNativeFFmpegCapabilities } from "../../utils/ffmpegRuntime.js";
import { clearCache, getCacheSize, formatBytes } from "../../utils/cacheService.js";
import { HorizontalRail } from "./HorizontalRail.jsx";

const CAPABILITY_TABS = [
  { id: "filters", label: "Filters", flag: "-filters", textKey: "filtersText" },
  { id: "encoders", label: "Encoders", flag: "-encoders", textKey: "encodersText" },
  { id: "decoders", label: "Decoders", flag: "-decoders", textKey: "decodersText" },
  { id: "codecs", label: "Codecs", flag: "-codecs", textKey: "codecsText" },
  { id: "muxers", label: "Muxers", flag: "-muxers", textKey: "muxersText" },
  { id: "demuxers", label: "Demuxers", flag: "-demuxers", textKey: "demuxersText" },
  { id: "protocols", label: "Protocols", flag: "-protocols", textKey: "protocolsText" },
  { id: "bsfs", label: "BSFs", flag: "-bsfs", textKey: "bsfsText" },
  { id: "pix_fmts", label: "Pixel Fmts", flag: "-pix_fmts", textKey: "pixFmtsText" },
  { id: "hwaccels", label: "HWAccels", flag: "-hwaccels", textKey: "hwaccelsText" }
];

const VARIABLE_TEMPLATES = ["{input}", "{output}", "{start}", "{duration}", "{width}", "{height}", "{fps}"];

export function AdvancedFFmpegPanel({ clip, media, onRunCommand }) {
  const [caps, setCaps] = useState(null);
  const [capTab, setCapTab] = useState("filters");
  const [search, setSearch] = useState("");
  const [helpText, setHelpText] = useState("");
  const [helpName, setHelpName] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [customCmd, setCustomCmd] = useState("ffmpeg -i {input} -vf eq=brightness=0.1 {output}");
  const [dryRunArgs, setDryRunArgs] = useState([]);
  const [presets, setPresets] = useState([]);
  const [savedPresets, setSavedPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("videme-ffmpeg-presets") || "[]"); } catch { return []; }
  });
  const [cacheInfo, setCacheInfo] = useState(null);
  const [clearingCache, setClearingCache] = useState(null);

  useEffect(() => {
    getNativeFFmpegCapabilities().then(setCaps);
    getCacheSize().then((r) => { if (r?.ok) setCacheInfo(r); });
  }, []);

  const currentTabConfig = CAPABILITY_TABS.find((t) => t.id === capTab);
  const rawText = caps?.[currentTabConfig?.textKey] || "";
  const lines = rawText.split(/\r?\n/).filter(Boolean);
  const filtered = search
    ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  const loadHelp = useCallback(async (name, type) => {
    if (!window.videmeNative?.ffmpeg) return;
    setHelpName(name);
    setHelpLoading(true);
    setHelpText("");
    try {
      const fn = type === "encoder"
        ? window.videmeNative.ffmpeg.getEncoderHelp
        : window.videmeNative.ffmpeg.getFilterHelp;
      const result = await fn(name);
      setHelpText(result?.text || "Tidak ada help untuk item ini.");
    } catch {
      setHelpText("Gagal memuat help.");
    } finally {
      setHelpLoading(false);
    }
  }, []);

  const handleDryRun = () => {
    const variables = {
      input: media?.file?.path || media?.name || "input.mp4",
      output: "output.mp4",
      start: "0",
      duration: media?.duration ? String(media.duration.toFixed(2)) : "60",
      width: media?.width ? String(media.width) : "1920",
      height: media?.height ? String(media.height) : "1080",
      fps: "30"
    };
    const parts = customCmd.trim().split(/\s+/).map((part) =>
      part.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`)
    );
    setDryRunArgs(parts);
  };

  const handleRun = () => {
    if (dryRunArgs.length === 0) handleDryRun();
    const args = dryRunArgs.length ? dryRunArgs : customCmd.trim().split(/\s+/);
    onRunCommand?.({ type: "custom", args });
  };

  const handleSavePreset = () => {
    if (!customCmd.trim()) return;
    const name = `Preset ${savedPresets.length + 1}`;
    const next = [...savedPresets, { name, cmd: customCmd.trim(), id: crypto.randomUUID() }];
    setSavedPresets(next);
    localStorage.setItem("videme-ffmpeg-presets", JSON.stringify(next));
  };

  const handleRemovePreset = (id) => {
    const next = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(next);
    localStorage.setItem("videme-ffmpeg-presets", JSON.stringify(next));
  };

  if (!caps?.available) {
    return (
      <div className="space-y-3 p-1">
        <p className="text-[11px] text-[var(--text-muted)] leading-5">
          FFmpeg native tidak tersedia. Install FFmpeg dan jalankan sebagai aplikasi desktop untuk mengakses Advanced FFmpeg Command Browser.
        </p>
        {caps?.installHint && (
          <p className="text-[11px] text-yellow-400 leading-5">{caps.installHint}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Capability Browser */}
      <div className="rounded-md border border-[var(--border)] bg-[#141414] overflow-hidden">
        <div className="border-b border-[var(--border)] px-1 py-1">
          <HorizontalRail contentClassName="flex" buttonClassName="h-6">
          {CAPABILITY_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setCapTab(t.id); setSearch(""); setHelpText(""); }}
              className={`shrink-0 px-2.5 py-1.5 text-[10px] font-medium transition ${capTab === t.id ? "bg-[var(--accent)] text-[#07111f]" : "text-[var(--text-muted)] hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
          </HorizontalRail>
        </div>

        <div className="relative p-2">
          <Search size={11} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={`Cari ${currentTabConfig?.label}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-full rounded border border-[var(--border)] bg-[#0e0e0e] pl-6 pr-2 text-[11px] text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="max-h-36 overflow-y-auto px-2 pb-2">
          {filtered.slice(0, 200).map((line, i) => {
            const parts = line.trim().split(/\s+/);
            const name = parts[1] || parts[0] || "";
            return (
              <div
                key={i}
                className="group flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)] cursor-pointer"
                onClick={() => name && loadHelp(name, capTab === "encoders" || capTab === "decoders" ? "encoder" : "filter")}
              >
                <span className="font-mono text-[10px] text-[var(--text-secondary)] truncate flex-1">{line.trim()}</span>
                <ChevronRight size={10} className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--text-muted)]" />
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-center text-[10px] text-[var(--text-muted)] py-3">Tidak ada hasil.</p>}
          {filtered.length > 200 && <p className="text-center text-[10px] text-[var(--text-muted)] py-1">{filtered.length - 200} item lainnya...</p>}
        </div>

        {helpName && (
          <div className="border-t border-[var(--border)] p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-[var(--accent)]">Help: {helpName}</span>
              <button type="button" onClick={() => { setHelpText(""); setHelpName(""); }} className="text-[var(--text-muted)] hover:text-white">
                <X size={11} />
              </button>
            </div>
            {helpLoading
              ? <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-[var(--text-muted)]" /></div>
              : <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--text-secondary)]">{helpText}</pre>
            }
          </div>
        )}
      </div>

      {/* Custom Command */}
      <div className="rounded-md border border-[var(--border)] bg-[#141414] p-3 space-y-2">
        <h4 className="text-[10px] font-semibold uppercase text-white flex items-center gap-1.5">
          <Terminal size={11} />
          Custom Command
        </h4>
        <div className="flex flex-wrap gap-1">
          {VARIABLE_TEMPLATES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setCustomCmd((c) => c + " " + v)}
              className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] hover:text-white hover:border-[var(--accent)] transition"
            >
              {v}
            </button>
          ))}
        </div>
        <textarea
          value={customCmd}
          onChange={(e) => setCustomCmd(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-[var(--border)] bg-[#0e0e0e] p-2 font-mono text-[11px] text-white outline-none focus:border-[var(--accent)] resize-none"
        />

        {dryRunArgs.length > 0 && (
          <div className="rounded border border-[var(--border)] bg-[#0a0a0a] p-2">
            <p className="text-[9px] text-[var(--text-muted)] mb-1 uppercase">Dry-run args:</p>
            <p className="font-mono text-[10px] text-green-400 break-all">{dryRunArgs.join(" ")}</p>
          </div>
        )}

        <div className="flex gap-1.5">
          <button type="button" onClick={handleDryRun} className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded border border-[var(--border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
            <Terminal size={11} />
            Dry-run
          </button>
          <button type="button" onClick={handleSavePreset} className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded border border-[var(--border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
            <Save size={11} />
            Save Preset
          </button>
          <button type="button" onClick={handleRun} className="flex-1 h-7 flex items-center justify-center gap-1.5 rounded bg-[var(--accent)] text-[11px] font-semibold text-[#07111f] hover:bg-[var(--accent-strong)]">
            <Play size={11} />
            Run
          </button>
        </div>
      </div>

      {/* Saved Presets */}
      {savedPresets.length > 0 && (
        <div className="rounded-md border border-[var(--border)] bg-[#141414] p-3 space-y-2">
          <h4 className="text-[10px] font-semibold uppercase text-white">Preset Tersimpan</h4>
          {savedPresets.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded border border-[var(--border)] bg-[#0e0e0e] px-2 py-1.5">
              <span className="flex-1 truncate text-[11px] text-[var(--text-secondary)]">{p.name}</span>
              <button type="button" onClick={() => setCustomCmd(p.cmd)} className="text-[10px] text-[var(--accent)] hover:text-white">Pakai</button>
              <button type="button" onClick={() => handleRemovePreset(p.id)} className="text-[var(--text-muted)] hover:text-red-400"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Cache Management */}
      <div className="rounded-md border border-[var(--border)] bg-[#141414] p-3 space-y-2">
        <h4 className="text-[10px] font-semibold uppercase text-white flex items-center gap-1.5">
          <HardDrive size={11} />
          Cache
          {cacheInfo && <span className="font-normal text-[var(--text-muted)]">({formatBytes(cacheInfo.bytes)})</span>}
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {["thumbnails", "waveform", "proxies", "preview-frames", "renders"].map((sub) => (
            <button
              key={sub}
              type="button"
              disabled={clearingCache === sub}
              onClick={async () => {
                setClearingCache(sub);
                await clearCache(sub);
                const r = await getCacheSize();
                if (r?.ok) setCacheInfo(r);
                setClearingCache(null);
              }}
              className="flex h-7 items-center justify-center gap-1 rounded border border-[var(--border)] text-[10px] text-[var(--text-secondary)] hover:bg-red-900/30 hover:text-red-400 hover:border-red-800 disabled:opacity-40 transition"
            >
              {clearingCache === sub
                ? <Loader2 size={10} className="animate-spin" />
                : <Trash2 size={10} />
              }
              {sub}
            </button>
          ))}
          <button
            type="button"
            disabled={!!clearingCache}
            onClick={async () => {
              setClearingCache("all");
              await clearCache("");
              const r = await getCacheSize();
              if (r?.ok) setCacheInfo(r);
              setClearingCache(null);
            }}
            className="col-span-2 flex h-7 items-center justify-center gap-1 rounded border border-red-800/60 text-[10px] text-red-400 hover:bg-red-900/30 disabled:opacity-40 transition"
          >
            {clearingCache === "all" ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
            Hapus Semua Cache
          </button>
        </div>
      </div>
    </div>
  );
}
