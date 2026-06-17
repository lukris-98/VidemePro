import React from "react";
import { Check, FileAudio, ImageIcon, Plus, Video } from "lucide-react";
import { formatTime } from "../../utils/timeFormat.js";

const iconMap = {
  video: Video,
  audio: FileAudio,
  image: ImageIcon,
  photo: ImageIcon
};

export function MediaThumbnail({ item, selected, onToggle, onPreview, onAdd, viewMode = "thumbnail" }) {
  const Icon = iconMap[item.type] ?? ImageIcon;
  const showsDuration = item.type === "video" || item.type === "audio";
  const isTiles = viewMode === "tiles";
  const durationLabel = showsDuration ? formatTime(item.duration) : "-";

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onClick={() => onPreview(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPreview(item.id);
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("mediaId", item.id);
        const ghost = document.createElement("div");
        ghost.textContent = item.name;
        ghost.style.cssText =
          "position:fixed;top:-1000px;left:-1000px;width:160px;height:44px;padding:10px;border-radius:6px;background:#1e1e1e;color:white;font:12px Arial;border:1px solid #4d9eff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;";
        document.body.appendChild(ghost);
        event.dataTransfer.setDragImage(ghost, 20, 20);
        window.setTimeout(() => ghost.remove(), 0);
      }}
      className={`group relative overflow-hidden rounded-md border border-transparent bg-[#171717] text-left hover:border-[var(--border)] hover:bg-[var(--bg-hover)] ${
        isTiles ? "grid grid-cols-[74px_minmax(0,1fr)_auto] items-center gap-2 p-1.5" : ""
      }`}
    >
      <div className={`checkerboard relative overflow-hidden bg-black ${isTiles ? "h-12 w-[74px] rounded" : "aspect-video"}`}>
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : item.type === "video" ? (
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              const target = Number.isFinite(video.duration) && video.duration > 0.3 ? Math.min(video.duration * 0.1, video.duration - 0.05) : 0;
              try {
                video.currentTime = Math.max(0, target);
              } catch {
                // The browser will still show the first decoded frame when seeking is unavailable.
              }
            }}
          />
        ) : item.type === "image" || item.type === "photo" ? (
          <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-[var(--accent)]">
            <Icon size={28} />
          </div>
        )}
        {showsDuration ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 font-mono text-[9px] text-white">
            {formatTime(item.duration)}
          </span>
        ) : null}
        <button
          type="button"
          title={selected ? "Batalkan pilihan" : "Pilih media"}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(item.id);
          }}
          className={`absolute right-1 top-1 grid h-4 w-4 place-items-center rounded border border-white/60 bg-black/55 text-white transition ${
            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {selected ? <Check size={11} /> : null}
        </button>
      </div>
      <div className={`${isTiles ? "min-w-0 space-y-0.5 p-0" : "space-y-1 p-1.5"}`}>
        <div className="truncate text-[11px] text-[var(--text-secondary)]">{item.name}</div>
        {isTiles ? (
          <div className="truncate text-[9px] text-[var(--text-muted)]">
            {durationLabel} · {formatBytes(item.size ?? item.file?.size)} · {mediaTypeLabel(item.type)}
          </div>
        ) : null}
        <div className={`flex h-4 items-center justify-between gap-1 ${isTiles ? "max-w-[120px]" : ""}`}>
          {item.addedToTimeline ? (
            <span className="min-w-0 truncate rounded bg-[#24354a] px-1.5 py-0.5 text-[9px] text-[var(--accent)]">
              Ditambahkan
            </span>
          ) : (
            <span className="min-w-0" />
          )}
          <button
            type="button"
            title="Tambahkan ke timeline"
            onClick={(event) => {
              event.stopPropagation();
              onAdd?.(item);
            }}
            className="grid h-4 w-4 shrink-0 place-items-center rounded border border-[var(--border)] bg-[#202020] text-[var(--text-secondary)] opacity-0 transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[#07111f] group-hover:opacity-100"
          >
            <Plus size={11} />
          </button>
        </div>
      </div>
      {isTiles ? <span className="w-0" /> : null}
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function mediaTypeLabel(type) {
  if (type === "image" || type === "photo") return "Foto";
  if (type === "video") return "Video";
  if (type === "audio") return "Audio";
  return "File";
}
