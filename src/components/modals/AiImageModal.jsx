import React, { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useMediaStore } from "../../store/mediaStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { generateAiImage } from "../../utils/aiImageGenerator.js";

export function AiImageModal() {
  const open = useUiStore((state) => state.aiImageOpen);
  const close = useUiStore((state) => state.closeAiImage);
  const addMediaItem = useMediaStore((state) => state.addMediaItem);
  const [prompt, setPrompt] = useState("portrait cinematic untuk opening video produk");
  const [style, setStyle] = useState("cinematic");
  const [aspect, setAspect] = useState("16:9");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);

  if (!open) return null;

  const start = async () => {
    setStatus("loading");
    setProgress(0);
    try {
      const image = await generateAiImage({
        prompt,
        style,
        aspect,
        apiKey,
        onProgress: (value, message) => {
          setProgress(value);
          if (message) setStatus(message);
        }
      });
      addMediaItem({
        id: crypto.randomUUID(),
        name: image.file.name,
        type: "image",
        file: image.file,
        url: image.url,
        thumbnailUrl: image.url,
        duration: 3,
        width: image.width,
        height: image.height,
        size: image.file.size,
        addedToTimeline: false,
        generated: true
      });
      setStatus("Image masuk ke media library");
      setProgress(1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Generate image gagal");
    }
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[540px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ImagePlus size={17} />
            AI Image Generator
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm">
          <label className="grid gap-2">
            <span className="text-xs text-[var(--text-muted)]">Prompt</span>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="min-h-24 rounded-md border border-[var(--border)] bg-[#151515] p-3 text-white" />
          </label>
          <Select label="Style" value={style} onChange={setStyle} options={["cinematic", "anime", "product", "neon", "natural"]} />
          <Select label="Aspect" value={aspect} onChange={setAspect} options={["16:9", "9:16", "1:1", "4:5"]} />
          <label className="grid gap-2 text-xs">
            <span className="text-[var(--text-muted)]">Anthropic API key opsional</span>
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder="sk-ant-..." className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-white" />
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
          <button type="button" onClick={start} disabled={status === "loading" || !prompt.trim()} className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#07111f] disabled:opacity-50">
            Generate
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-white">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
