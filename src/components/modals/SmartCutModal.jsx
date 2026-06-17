import React, { useState } from "react";
import { Scissors, X } from "lucide-react";
import { useMediaStore } from "../../store/mediaStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { analyzeSilence } from "../../utils/smartCut.js";

export function SmartCutModal() {
  const open = useUiStore((state) => state.smartCutOpen);
  const close = useUiStore((state) => state.closeSmartCut);
  const tracks = useProjectStore((state) => state.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const applySmartCut = useProjectStore((state) => state.applySmartCut);
  const mediaItems = useMediaStore((state) => state.items);
  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);
  const media = mediaItems.find((item) => item.id === selectedClip?.mediaId);
  const [thresholdDb, setThresholdDb] = useState(-40);
  const [minDuration, setMinDuration] = useState(0.5);
  const [padding, setPadding] = useState(0.08);
  const [previewFirst, setPreviewFirst] = useState(true);
  const [result, setResult] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);

  if (!open) return null;

  const analyze = async () => {
    setStatus("loading");
    setProgress(0);
    setExcluded([]);
    try {
      const data = await analyzeSilence(media.file, {
        thresholdDb,
        minDuration,
        padding,
        onProgress: (value, message) => {
          setProgress(value);
          if (message) setStatus(message);
        }
      });
      setResult(data);
      setStatus(`${data.ranges.length} area silence ditemukan`);
      setProgress(1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Smart Cut gagal");
    }
  };

  const apply = () => {
    const activeRanges = (result?.ranges ?? [])
      .filter((_, index) => !excluded.includes(index))
      .map((range) => ({ start: selectedClip.start + range.start, end: selectedClip.start + range.end }));
    applySmartCut(selectedClip.id, activeRanges);
    close();
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[620px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Scissors size={17} />
            Smart Cut
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm">
          <div className="rounded-md border border-[var(--border)] bg-[#151515] p-3">
            <div className="truncate text-white">{media?.name ?? "Pilih klip audio/video di timeline"}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">Smart Cut menghapus bagian yang lebih pelan dari threshold.</div>
          </div>
          <Range label={`Batas kebisingan ${thresholdDb} dB`} min="-60" max="-20" step="1" value={thresholdDb} onChange={setThresholdDb} />
          <Range label={`Minimum silence ${minDuration.toFixed(1)}s`} min="0.3" max="3" step="0.1" value={minDuration} onChange={setMinDuration} />
          <Range label={`Padding ${padding.toFixed(2)}s`} min="0" max="0.5" step="0.01" value={padding} onChange={setPadding} />
          <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <input type="checkbox" checked={previewFirst} onChange={(event) => setPreviewFirst(event.target.checked)} />
            Preview sebelum apply
          </label>
          {result ? (
            <div className="rounded-md border border-[var(--border)] bg-[#111] p-3">
              <Waveform waveform={result.waveform} ranges={result.ranges} duration={result.duration} excluded={excluded} toggle={(index) => setExcluded((state) => (state.includes(index) ? state.filter((item) => item !== index) : [...state, index]))} />
              <div className="mt-3 max-h-28 space-y-1 overflow-auto text-xs">
                {result.ranges.map((range, index) => (
                  <button
                    key={`${range.start}-${range.end}`}
                    type="button"
                    onClick={() => setExcluded((state) => (state.includes(index) ? state.filter((item) => item !== index) : [...state, index]))}
                    className={`flex h-7 w-full items-center justify-between rounded px-2 ${excluded.includes(index) ? "bg-[#252525] text-[var(--text-muted)]" : "bg-red-500/10 text-red-100"}`}
                  >
                    <span>{formatTime(range.start)} - {formatTime(range.end)}</span>
                    <span>{excluded.includes(index) ? "skip" : "hapus"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {status !== "idle" ? (
            <div className="rounded-md border border-[var(--border)] bg-[#151515] p-3">
              <div className="mb-2 flex justify-between text-xs text-[var(--text-muted)]">
                <span>{status}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-[#252525]">
                <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button type="button" onClick={close} className="h-9 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--bg-hover)]">
            Tutup
          </button>
          <button type="button" onClick={analyze} disabled={!media || status === "loading"} className="h-9 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--bg-hover)] disabled:opacity-50">
            Analisis
          </button>
          <button type="button" onClick={apply} disabled={!result || (previewFirst && !result.ranges.length)} className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#07111f] disabled:opacity-50">
            Apply Cut
          </button>
        </div>
      </div>
    </div>
  );
}

function Waveform({ waveform, ranges, duration, excluded, toggle }) {
  return (
    <div className="relative flex h-20 items-center gap-px overflow-hidden rounded bg-[#080808] px-2">
      {waveform.map((value, index) => (
        <span key={index} className="flex-1 rounded bg-[var(--accent)]/80" style={{ height: `${Math.max(3, value * 72)}px` }} />
      ))}
      {ranges.map((range, index) => (
        <button
          key={index}
          type="button"
          onClick={() => toggle(index)}
          className={`absolute top-0 h-full border-x border-red-200/30 ${excluded.includes(index) ? "bg-zinc-500/20" : "bg-red-500/35"}`}
          style={{ left: `${(range.start / duration) * 100}%`, width: `${((range.end - range.start) / duration) * 100}%` }}
          title="Klik untuk exclude/include"
        />
      ))}
    </div>
  );
}

function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="grid gap-2 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--accent)]" />
    </label>
  );
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
