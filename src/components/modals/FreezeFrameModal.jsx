import React, { useMemo, useState } from "react";
import { Snowflake, X } from "lucide-react";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { extractFrame } from "../../utils/ffmpegHelper.js";
import { generateImageThumbnail, readMediaMetadata } from "../../utils/thumbnailGen.js";

export function FreezeFrameModal() {
  const open = useUiStore((state) => state.freezeOpen);
  const close = useUiStore((state) => state.closeFreeze);
  const tracks = useProjectStore((state) => state.tracks);
  const freezeInsert = useProjectStore((state) => state.freezeInsert);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const mediaItems = useMediaStore((state) => state.items);
  const createMediaDraft = useMediaStore((state) => state.createMediaDraft);
  const addMediaItem = useMediaStore((state) => state.addMediaItem);
  const [duration, setDuration] = useState(3);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);

  const active = useMemo(() => {
    for (const track of tracks.filter((item) => item.type === "video")) {
      const clip = track.clips.find((item) => currentTime >= item.start && currentTime <= item.end);
      if (clip) return { track, clip, media: mediaItems.find((item) => item.id === clip.mediaId) };
    }
    return null;
  }, [currentTime, mediaItems, tracks]);

  if (!open) return null;

  const freeze = async () => {
    if (!active?.media?.file || active.media.type !== "video") {
      setStatus("Pilih posisi playhead di atas klip video.");
      return;
    }
    setStatus("loading");
    setProgress(0);
    try {
      const mediaTime = currentTime - active.clip.start + (active.clip.inPoint ?? 0);
      const file = await extractFrame(active.media.file, mediaTime, setProgress);
      const draft = createMediaDraft(file, { type: "image", duration });
      const metadata = await readMediaMetadata(file, draft.url);
      const thumbnailUrl = await generateImageThumbnail(draft.url);
      const item = { ...draft, ...metadata, duration, thumbnailUrl };
      addMediaItem(item);
      freezeInsert(active.track.id, {
        id: crypto.randomUUID(),
        trackId: active.track.id,
        mediaId: item.id,
        name: item.name,
        start: currentTime,
        end: currentTime + duration,
        inPoint: 0,
        outPoint: duration,
        mediaDuration: duration,
        offset: 0,
        color: "var(--clip-text)"
      });
      setStatus("done");
      setProgress(1);
      window.setTimeout(close, 500);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Freeze frame gagal");
    }
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[420px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Snowflake size={17} />
            Freeze Frame
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm">
          <label className="grid gap-2">
            <span className="text-[var(--text-secondary)]">Durasi freeze: {duration}s</span>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="accent-[var(--accent)]"
            />
          </label>
          <div className="rounded-md border border-[var(--border)] bg-[#151515] p-3 text-xs text-[var(--text-muted)]">
            {active?.media ? active.media.name : "Tidak ada klip video aktif di playhead."}
          </div>
          {status === "loading" || status === "done" ? (
            <div className="h-2 overflow-hidden rounded bg-[#252525]">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          ) : null}
          {status !== "idle" && status !== "loading" && status !== "done" ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{status}</div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button type="button" onClick={close} className="h-9 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--bg-hover)]">
            Batal
          </button>
          <button
            type="button"
            disabled={status === "loading"}
            onClick={freeze}
            className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
