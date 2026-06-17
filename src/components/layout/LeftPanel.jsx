import React, { useState } from "react";
import { Captions, Eraser, Focus, ImagePlus, MicVocal, Scissors, Sparkles } from "lucide-react";
import { MediaImporter } from "../media/MediaImporter.jsx";
import { MediaThumbnail } from "../media/MediaThumbnail.jsx";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { builtinStickers } from "../../utils/visualEffects.js";

const tabs = ["Media", "Audio", "Teks", "Stiker", "AI", "Efek", "Filter", "Transisi"];
const filters = ["Semua", "Video", "Foto", "Audio"];

export function LeftPanel() {
  const leftTab = useUiStore((state) => state.leftTab);
  const setLeftTab = useUiStore((state) => state.setLeftTab);
  const items = useMediaStore((state) => state.items);
  const selectedItems = useMediaStore((state) => state.selectedItems);
  const toggleSelect = useMediaStore((state) => state.toggleSelect);
  const setPreviewMedia = useMediaStore((state) => state.setPreviewMedia);
  const importStatus = useMediaStore((state) => state.importStatus);
  const importMessage = useMediaStore((state) => state.importMessage);
  const addStickerClip = useProjectStore((state) => state.addStickerClip);
  const addClip = useProjectStore((state) => state.addClip);
  const deselectAll = useProjectStore((state) => state.deselectAll);
  const tracks = useProjectStore((state) => state.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const updateClip = useProjectStore((state) => state.updateClip);
  const markAdded = useMediaStore((state) => state.markAdded);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const openAutoCaption = useUiStore((state) => state.openAutoCaption);
  const openAiImage = useUiStore((state) => state.openAiImage);
  const openSmartCut = useUiStore((state) => state.openSmartCut);
  const [filter, setFilter] = useState("Semua");
  const [sortOrder, setSortOrder] = useState("az");
  const [viewMode, setViewMode] = useState("thumbnail");
  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);

  const filteredItems = items
    .filter((item) => {
      if (filter === "Semua") return true;
      if (filter === "Foto") return item.type === "image" || item.type === "photo";
      return item.type === filter.toLowerCase();
    })
    .sort((a, b) => {
      const result = a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
      return sortOrder === "az" ? result : -result;
    });
  const selectedMediaItems = items.filter((item) => selectedItems.includes(item.id));

  const addMediaToTimeline = (mediaItemsToAdd) => {
    mediaItemsToAdd.forEach((item) => {
      const targetTrack =
        item.type === "audio"
          ? tracks.find((track) => track.type === "audio")
          : tracks.find((track) => track.type === "video") ?? tracks.find((track) => track.type === "overlay");
      if (!targetTrack) return;
      const color =
        item.type === "audio"
          ? "var(--clip-audio)"
          : item.type === "image" || item.type === "photo"
            ? "var(--clip-text)"
            : "var(--clip-video)";
      addClip(targetTrack.id, {
        mediaId: item.id,
        name: item.name,
        start: currentTime,
        end: currentTime + item.duration,
        inPoint: 0,
        outPoint: item.duration,
        mediaDuration: item.duration,
        offset: 0,
        color
      });
      markAdded(item.id);
    });
  };

  const addFromMediaLibrary = (item) => {
    addMediaToTimeline(selectedMediaItems.length ? selectedMediaItems : [item]);
  };

  const previewMedia = (id) => {
    deselectAll();
    setPreviewMedia(id);
  };

  return (
    <aside className="flex min-h-0 flex-col bg-[var(--bg-panel)]">
      <div className="scrollbar-dark flex h-11 shrink-0 items-end gap-4 overflow-x-auto border-b border-[var(--border)] px-3">
        {tabs.map((tab) => {
          const key = tab.toLowerCase();
          const active = leftTab === key;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setLeftTab(key)}
              className={`h-10 border-b-2 px-0.5 text-sm ${
                active ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
      <div className="scrollbar-dark min-h-0 flex-1 overflow-auto p-3">
        {leftTab === "media" ? (
          <div className="space-y-3">
            <MediaImporter
              filter={filter}
              filters={filters}
              onFilterChange={setFilter}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            {importStatus !== "idle" || importMessage ? (
              <div
                className={`rounded-md border px-3 py-2 text-xs ${
                  importStatus === "error"
                    ? "border-red-500/40 bg-red-500/10 text-red-200"
                    : "border-[var(--border)] bg-[#171717] text-[var(--text-secondary)]"
                }`}
              >
                {importMessage || (importStatus === "loading" ? "Mengimpor media" : "Import gagal")}
              </div>
            ) : null}
            {filteredItems.length ? (
              <div className={viewMode === "tiles" ? "grid gap-1.5" : "grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-1.5"}>
                {filteredItems.map((item) => (
                  <MediaThumbnail
                    key={item.id}
                    item={item}
                    viewMode={viewMode}
                    selected={selectedItems.includes(item.id)}
                    onToggle={toggleSelect}
                    onPreview={previewMedia}
                    onAdd={addFromMediaLibrary}
                  />
                ))}
              </div>
            ) : (
              <div className="grid h-48 place-items-center rounded-md border border-[var(--border)] bg-[#141414] text-center">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">Media kosong</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">Tambahkan video, foto, atau audio.</p>
                </div>
              </div>
            )}
          </div>
        ) : leftTab === "stiker" ? (
          <div className="grid grid-cols-2 gap-2">
            {builtinStickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => addStickerClip(sticker.id, currentTime)}
                className="group rounded-md border border-[var(--border)] bg-[#151515] p-3 text-left hover:bg-[var(--bg-hover)]"
              >
                <div className="grid aspect-video place-items-center rounded bg-black/35">
                  <img src={sticker.src} alt={sticker.name} className="h-14 w-14" />
                </div>
                <div className="mt-2 truncate text-xs text-[var(--text-secondary)]">{sticker.name}</div>
              </button>
            ))}
          </div>
        ) : leftTab === "ai" ? (
          <AiPanel clip={selectedClip} updateClip={updateClip} openAutoCaption={openAutoCaption} openAiImage={openAiImage} openSmartCut={openSmartCut} />
        ) : (
          <div className="grid h-full place-items-center rounded-md border border-[var(--border)] bg-[#141414] text-center">
            <div>
              <p className="text-sm text-white">{tabs.find((tab) => tab.toLowerCase() === leftTab)}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Panel ini disiapkan untuk Part berikutnya.</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function AiPanel({ clip, updateClip, openAutoCaption, openAiImage, openSmartCut }) {
  const isVisual = clip && clip.type !== "text" && clip.type !== "sticker";
  const patchClip = (patch) => clip && updateClip(clip.id, patch);
  return (
    <div className="space-y-2">
      <AiCard icon={Captions} title="Auto Caption" desc="Whisper API atau caption draft lokal." action="Generate" onClick={openAutoCaption} />
      <AiCard icon={ImagePlus} title="AI Image" desc="Generate image dan masukkan ke media library." action="Generate" onClick={openAiImage} />
      <AiCard icon={Scissors} title="Smart Cut" desc="Analisis audio dan hapus bagian sunyi." action="Analisis" onClick={openSmartCut} disabled={!clip} />
      <AiCard
        icon={Eraser}
        title="Background Remover"
        desc="Mask subject lokal dengan pilihan background."
        action={clip?.bgRemove?.enabled ? "Aktif" : "Enable"}
        onClick={() => patchClip({ bgRemove: { ...(clip.bgRemove ?? {}), enabled: !clip?.bgRemove?.enabled } })}
        disabled={!isVisual}
      />
      <AiCard
        icon={Focus}
        title="Face Blur"
        desc="Sensor area wajah estimasi di preview."
        action={clip?.faceBlur?.enabled ? "Aktif" : "Enable"}
        onClick={() => patchClip({ faceBlur: { ...(clip.faceBlur ?? {}), enabled: !clip?.faceBlur?.enabled } })}
        disabled={!isVisual}
      />
      <AiCard
        icon={Sparkles}
        title="Auto Reframe"
        desc="Crop otomatis ke 9:16 untuk short video."
        action={clip?.autoReframe?.enabled ? "Aktif" : "Enable"}
        onClick={() => patchClip({ autoReframe: { ...(clip.autoReframe ?? {}), enabled: !clip?.autoReframe?.enabled, targetAspect: "9:16" } })}
        disabled={!isVisual}
      />
      <AiCard
        icon={MicVocal}
        title="Voice Changer"
        desc="Preset suara ada di inspector audio."
        action="Inspector"
        onClick={() => {}}
        disabled={!clip}
      />
    </div>
  );
}

function AiCard({ icon: Icon, title, desc, action, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-md border border-[var(--border)] bg-[#151515] p-3 text-left hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--accent)]/12 text-[var(--accent)]">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-white">{title}</span>
        <span className="mt-1 block text-xs leading-4 text-[var(--text-muted)]">{desc}</span>
      </span>
      <span className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">{action}</span>
    </button>
  );
}
