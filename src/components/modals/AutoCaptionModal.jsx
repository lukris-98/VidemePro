import React, { useState } from "react";
import { Captions, X } from "lucide-react";
import { useMediaStore } from "../../store/mediaStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { generateCaptions } from "../../utils/captionGenerator.js";
import { ModernSelect } from "../ui/ModernSelect.jsx";

export function AutoCaptionModal() {
  const open = useUiStore((state) => state.autoCaptionOpen);
  const close = useUiStore((state) => state.closeAutoCaption);
  const tracks = useProjectStore((state) => state.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const addCaptionClips = useProjectStore((state) => state.addCaptionClips);
  const mediaItems = useMediaStore((state) => state.items);
  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);
  const media = mediaItems.find((item) => item.id === selectedClip?.mediaId) ?? mediaItems.find((item) => item.type === "video" || item.type === "audio");
  const [language, setLanguage] = useState("auto");
  const [style, setStyle] = useState("subtitle");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);

  if (!open) return null;

  const start = async () => {
    setStatus("loading");
    setProgress(0);
    try {
      const captions = await generateCaptions({
        media,
        clip: selectedClip,
        apiKey: apiKey.trim(),
        language,
        style,
        onProgress: (value, message) => {
          setProgress(value);
          if (message) setStatus(message);
        }
      });
      addCaptionClips(captions);
      setProgress(1);
      setStatus(`${captions.length} caption dibuat`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Auto caption gagal");
    }
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[520px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Captions size={17} />
            Auto Caption
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm">
          <div className="rounded-md border border-[var(--border)] bg-[#151515] p-3">
            <div className="truncate text-white">{media?.name ?? "Belum ada media audio/video"}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">Tanpa API key, aplikasi membuat caption draft lokal yang bisa diedit manual.</div>
          </div>
          <Select label="Bahasa" value={language} onChange={setLanguage} options={["auto", "indonesia", "english", "japanese", "korean", "spanish"]} />
          <Select label="Style" value={style} onChange={setStyle} options={["subtitle", "word", "karaoke"]} />
          <label className="grid gap-2 text-xs">
            <span className="text-[var(--text-muted)]">OpenAI API key opsional</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder="sk-..."
              className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-white"
            />
          </label>
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
          <button type="button" onClick={start} disabled={status === "loading" || !media} className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#07111f] disabled:opacity-50">
            Generate Caption
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return <ModernSelect label={label} value={value} options={options} onChange={onChange} />;
}
