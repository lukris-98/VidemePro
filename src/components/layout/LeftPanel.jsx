import React, { useState } from "react";
import { Captions, Eraser, FileAudio, Focus, ImagePlus, Mic2, MicVocal, Scissors, Sparkles, Upload, Wand2 } from "lucide-react";
import { MediaImporter } from "../media/MediaImporter.jsx";
import { MediaThumbnail } from "../media/MediaThumbnail.jsx";
import { HorizontalRail } from "../ui/HorizontalRail.jsx";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { formatTime } from "../../utils/timeFormat.js";
import { builtinStickers } from "../../utils/visualEffects.js";

const tabs = ["Media", "Audio", "Teks", "Stiker", "AI", "Efek", "Filter", "Transisi"];
const filters = ["Semua", "Gambar", "Video"];

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
  const [filter, setFilter] = useState("Gambar");
  const [sortOrder, setSortOrder] = useState("az");
  const [viewMode, setViewMode] = useState("thumbnail");
  const [audioTab, setAudioTab] = useState("upload");
  const [mediaSourceTab, setMediaSourceTab] = useState("device");
  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);

  const filteredItems = items
    .filter((item) => {
      if (filter === "Semua") return true;
      if (filter === "Gambar") return item.type === "image" || item.type === "photo";
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
      <div className="h-11 shrink-0 border-b border-[var(--border)] px-3">
        <HorizontalRail className="h-full" contentClassName="flex h-full items-end gap-4" buttonClassName="mb-1 h-7">
          {tabs.map((tab) => {
            const key = tab.toLowerCase();
            const active = leftTab === key;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setLeftTab(key)}
                className={`h-10 shrink-0 border-b-2 px-0.5 text-sm ${
                  active ? "border-[var(--accent)] text-white" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </HorizontalRail>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {leftTab === "media" ? (
          <div className="no-scrollbar h-full overflow-y-auto pb-3">
            <div className="flex min-h-full flex-col gap-3">
            <MediaImporter
              filter={filter}
              filters={filters}
              onFilterChange={setFilter}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onOnlineAssetReady={(item) => addMediaToTimeline([item])}
              onSourceTabChange={setMediaSourceTab}
              resultsSlotId="media-source-results-slot"
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
              <div className="min-h-48 flex-1">
                {mediaSourceTab === "device" ? (
                  filteredItems.length ? (
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
                    <div className="grid h-full min-h-48 place-items-center rounded-md border border-[var(--border)] bg-[#141414] text-center">
                      <div>
                        <p className="text-sm text-[var(--text-secondary)]">Media kosong</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">Tambahkan video, foto, atau audio.</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div id="media-source-results-slot" className="h-full min-h-48" />
                )}
                </div>
            </div>
          </div>
        ) : leftTab === "audio" ? (
          <AudioPanel
            activeTab={audioTab}
            onTabChange={setAudioTab}
            items={items}
            selectedItems={selectedItems}
            onToggle={toggleSelect}
            onPreview={previewMedia}
            onAdd={addFromMediaLibrary}
          />
        ) : leftTab === "stiker" ? (
          <div className="scrollbar-dark h-full overflow-y-auto">
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
          </div>
        ) : leftTab === "ai" ? (
          <div className="scrollbar-dark h-full overflow-y-auto">
            <AiPanel clip={selectedClip} updateClip={updateClip} openAutoCaption={openAutoCaption} openAiImage={openAiImage} openSmartCut={openSmartCut} />
          </div>
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

const audioTabs = [
  { id: "upload", label: "Upload", desc: "File audio lokal", icon: Upload },
  { id: "voice-clone", label: "Voice Clone", desc: "Suara hasil clone", icon: Mic2 },
  { id: "ai", label: "AI", desc: "Audio generatif", icon: Wand2 }
];

function AudioPanel({ activeTab, onTabChange, items, selectedItems, onToggle, onPreview, onAdd }) {
  const uploadedAudio = items.filter((item) => item.type === "audio" && !["ai", "voice-clone"].includes(item.metadata?.source));
  const voiceCloneAudio = items.filter((item) => item.type === "audio" && item.metadata?.source === "voice-clone");
  const aiAudio = items.filter((item) => item.type === "audio" && item.metadata?.source === "ai");
  const buckets = {
    upload: uploadedAudio,
    "voice-clone": voiceCloneAudio,
    ai: aiAudio
  };
  const currentItems = buckets[activeTab] ?? [];
  const activeMeta = audioTabs.find((tab) => tab.id === activeTab) ?? audioTabs[0];

  return (
    <div className="grid h-full min-h-[260px] grid-cols-[118px_minmax(0,1fr)] overflow-hidden rounded-md border border-[var(--border)] bg-[#101010]">
      <nav className="scrollbar-dark min-h-0 overflow-auto border-r border-[var(--border)] bg-[#0d0d0d] p-1.5">
        {audioTabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.id === activeTab;
          const count = buckets[tab.id]?.length ?? 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left active:translate-y-px ${
                active
                  ? "border-[var(--accent)] bg-[#152235] text-white"
                  : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${active ? "bg-[var(--accent)] text-[#07111f]" : "bg-[#171717] text-[var(--text-secondary)]"}`}>
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{tab.label}</span>
                <span className="block text-[10px] text-[var(--text-muted)]">{count} item</span>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="scrollbar-dark min-h-0 overflow-auto p-3">
        <div className="mb-3 flex items-start justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileAudio size={15} className="text-[var(--accent)]" />
              <h2 className="truncate text-sm font-semibold text-white">{activeMeta.label}</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{activeMeta.desc}</p>
          </div>
          <span className="shrink-0 rounded border border-[var(--border)] bg-[#151515] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
            {currentItems.length} audio
          </span>
        </div>

        {activeTab === "upload" ? (
          <UploadAudioList items={currentItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
        ) : (
          <AudioSourceList source={activeMeta.label} items={currentItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
        )}
      </section>
    </div>
  );
}

function UploadAudioList({ items, selectedItems, onToggle, onPreview, onAdd }) {
  if (!items.length) {
    return (
      <AudioEmptyState
        title="Belum ada audio upload"
        desc="Import file MP3, WAV, AAC, OGG, atau format audio lain dari tab Media, lalu semua audio lokal akan muncul di sini."
      />
    );
  }

  return (
    <div className="grid gap-1.5">
      {items.map((item) => (
        <MediaThumbnail
          key={item.id}
          item={item}
          viewMode="tiles"
          selected={selectedItems.includes(item.id)}
          onToggle={onToggle}
          onPreview={onPreview}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

function AudioSourceList({ source, items, selectedItems, onToggle, onPreview, onAdd }) {
  if (!items.length) {
    return (
      <AudioEmptyState
        title={`${source} kosong`}
        desc={`Audio dari ${source} akan tampil di sini setelah API atau generator sumber tersebut menambahkan item ke media library.`}
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPreview(item.id)}
          className={`group flex w-full items-center gap-2 rounded-md border bg-[#151515] p-2 text-left hover:bg-[var(--bg-hover)] ${
            selectedItems.includes(item.id) ? "border-[var(--accent)]" : "border-[var(--border)]"
          }`}
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--clip-audio)]/12 text-[var(--clip-audio)]">
            <FileAudio size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-white">{item.name}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
              {formatTime(item.duration)} - {formatAudioSource(item)}
            </span>
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle(item.id);
            }}
            className="h-7 rounded border border-[var(--border)] px-2 text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white"
          >
            {selectedItems.includes(item.id) ? "Dipilih" : "Pilih"}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAdd(item);
            }}
            className="h-7 rounded bg-[var(--accent)] px-2 text-[10px] font-semibold text-[#07111f] hover:bg-[var(--accent-strong)]"
          >
            Tambah
          </button>
        </button>
      ))}
    </div>
  );
}

function AudioEmptyState({ title, desc }) {
  return (
    <div className="grid min-h-[190px] place-items-center rounded-md border border-dashed border-[var(--border)] bg-[#141414] p-4 text-center">
      <div className="max-w-[220px]">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-md bg-[var(--clip-audio)]/10 text-[var(--clip-audio)]">
          <FileAudio size={20} />
        </div>
        <p className="mt-3 text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{desc}</p>
      </div>
    </div>
  );
}

function formatAudioSource(item) {
  if (item.metadata?.source) return item.metadata.source;
  return item.file?.type || "uploaded";
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
