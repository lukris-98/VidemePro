import React, { useState } from "react";
import { Download, X } from "lucide-react";
import { useMediaStore } from "../../store/mediaStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { exportProject } from "../../utils/exportProject.js";
import { downloadTextFile, exportSRT, exportVTT, getCaptionClips } from "../../utils/subtitleExport.js";

export function ExportModal() {
  const open = useUiStore((state) => state.exportOpen);
  const close = useUiStore((state) => state.closeExport);
  const projectName = useProjectStore((state) => state.projectName);
  const tracks = useProjectStore((state) => state.tracks);
  const mediaItems = useMediaStore((state) => state.items);
  const [options, setOptions] = useState({
    resolution: "720p",
    format: "webm",
    fps: "30",
    quality: 80,
    audio: "aac"
  });
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("idle");

  if (!open) return null;

  const update = (key, value) => setOptions((state) => ({ ...state, [key]: value }));
  const captions = getCaptionClips(tracks);
  const startExport = async () => {
    setStatus("loading");
    setProgress(0);
    try {
      await exportProject({ projectName, tracks, mediaItems, options, onProgress: setProgress });
      setStatus("done");
      setProgress(1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export gagal");
    }
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[520px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Download size={17} />
            Export Video
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm">
          <Select label="Resolusi" value={options.resolution} onChange={(value) => update("resolution", value)} options={["480p", "720p", "1080p", "4K"]} />
          <Select label="Format" value={options.format} onChange={(value) => update("format", value)} options={["webm", "mp4"]} />
          <Select label="FPS" value={options.fps} onChange={(value) => update("fps", value)} options={["24", "30", "60"]} />
          <Select label="Audio" value={options.audio} onChange={(value) => update("audio", value)} options={["aac", "mp3", "tanpa audio"]} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!captions.length} onClick={() => downloadTextFile(`${projectName}.srt`, exportSRT(captions), "text/srt")} className="h-9 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)] disabled:opacity-45">
              Export SRT
            </button>
            <button type="button" disabled={!captions.length} onClick={() => downloadTextFile(`${projectName}.vtt`, exportVTT(captions), "text/vtt")} className="h-9 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)] disabled:opacity-45">
              Export VTT
            </button>
          </div>
          <label className="grid gap-2">
            <span className="text-[var(--text-secondary)]">Quality: {options.quality}</span>
            <input
              type="range"
              min="1"
              max="100"
              value={options.quality}
              onChange={(event) => update("quality", Number(event.target.value))}
              className="accent-[var(--accent)]"
            />
          </label>
          {status === "loading" || status === "done" ? (
            <div className="rounded-md border border-[var(--border)] bg-[#151515] p-3">
              <div className="mb-2 flex justify-between text-xs text-[var(--text-muted)]">
                <span>{status === "done" ? "Selesai" : "Memproses export"}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-[#252525]">
                <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          ) : null}
          {status !== "idle" && status !== "loading" && status !== "done" ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{status}</div>
          ) : null}
          <p className="text-xs leading-5 text-[var(--text-muted)]">Export browser untuk video panjang bisa lambat. MP4 otomatis mencoba FFmpeg native/GPU, lalu fallback ke FFmpeg.wasm.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button type="button" onClick={close} className="h-9 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--bg-hover)]">
            Tutup
          </button>
          <button
            type="button"
            disabled={status === "loading"}
            onClick={startExport}
            className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            Ekspor
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
