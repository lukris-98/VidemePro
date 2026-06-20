import React, { useEffect, useRef, useState } from "react";
import { Captions, ChevronLeft, ChevronRight, Clipboard, Download, Eraser, Eye, FileAudio, FileText, Focus, FolderOpen, Heart, ImagePlus, Info, KeyRound, Mic2, MicVocal, Music, Pause, Play, RotateCcw, Save, Scissors, Search, Sparkles, Upload, User, X } from "lucide-react";
import { MediaImporter } from "../media/MediaImporter.jsx";
import { MediaThumbnail } from "../media/MediaThumbnail.jsx";
import { HorizontalRail } from "../ui/HorizontalRail.jsx";
import { ModernSelect } from "../ui/ModernSelect.jsx";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { generateWaveform } from "../../utils/audioHelper.js";
import { formatTime } from "../../utils/timeFormat.js";
import { readMediaMetadata } from "../../utils/thumbnailGen.js";
import { builtinStickers } from "../../utils/visualEffects.js";
import { generateVoxCpmSpeech } from "../../utils/voxcpm.js";

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
  { id: "voice", label: "Voice", desc: "Voice generation dan clone", icon: Mic2 },
  { id: "music", label: "Music", desc: "Generate music dengan Apiframe", icon: Music },
  { id: "lyrics", label: "Lyrics", desc: "Ambil lirik dari Spotify Track ID", icon: FileText }
];

function AudioPanel({ activeTab, onTabChange, items, selectedItems, onToggle, onPreview, onAdd }) {
  const historyButtonRef = useRef(null);
  const historyPopoverRef = useRef(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const uploadedAudio = items.filter((item) => item.type === "audio" && !isGeneratedAudioSource(item));
  const voiceAudio = items.filter((item) => item.type === "audio" && isVoiceAudio(item));
  const musicAudio = items.filter((item) => item.type === "audio" && item.metadata?.source === "music");
  const buckets = {
    upload: uploadedAudio,
    voice: voiceAudio,
    music: musicAudio
  };
  const currentItems = buckets[activeTab] ?? [];
  const activeMeta = audioTabs.find((tab) => tab.id === activeTab) ?? audioTabs[0];
  const countLabel = activeTab === "lyrics" ? "RapidAPI" : `${currentItems.length} audio`;
  const usesHistoryPopover = activeTab === "voice" || activeTab === "music";

  useEffect(() => {
    if (activeTab === "ai") onTabChange("music");
    if (activeTab === "voice-clone") onTabChange("voice");
  }, [activeTab, onTabChange]);

  useEffect(() => {
    setHistoryOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!historyOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (
        !historyPopoverRef.current?.contains(event.target) &&
        !historyButtonRef.current?.contains(event.target)
      ) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [historyOpen]);

  return (
    <div
      className="grid h-full min-h-[260px] overflow-hidden rounded-md border border-[var(--border)] bg-[#101010]"
      style={{ gridTemplateColumns: `${navCollapsed ? 46 : 118}px minmax(0,1fr)` }}
    >
      <nav className="no-scrollbar flex min-h-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[#0d0d0d] p-1.5">
        <div className="min-h-0 flex-1">
          {audioTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            const count = buckets[tab.id]?.length ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                title={navCollapsed ? `${tab.label} (${count} item)` : tab.label}
                onClick={() => onTabChange(tab.id)}
                className={`mb-1 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left active:translate-y-px ${
                  navCollapsed ? "justify-center" : ""
                } ${
                  active
                    ? "border-[var(--accent)] bg-[#152235] text-white"
                    : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${active ? "bg-[var(--accent)] text-[#07111f]" : "bg-[#171717] text-[var(--text-secondary)]"}`}>
                  <Icon size={14} />
                </span>
                {!navCollapsed ? (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{tab.label}</span>
                    <span className="block text-[10px] text-[var(--text-muted)]">{count} item</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          title={navCollapsed ? "Lebarkan sub tab" : "Ciutkan sub tab"}
          onClick={() => setNavCollapsed((value) => !value)}
          className="mt-1 grid h-8 w-full place-items-center rounded-md border border-[var(--border)] bg-[#111] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
        >
          {navCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </nav>

      <section className="relative scrollbar-dark min-h-0 overflow-auto p-3">
        <div className="relative mb-3 flex items-start justify-between gap-2 border-b border-[var(--border-soft)] pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileAudio size={15} className="text-[var(--accent)]" />
              <h2 className="truncate text-sm font-semibold text-white">{activeMeta.label}</h2>
            </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{activeMeta.desc}</p>
          </div>
          {usesHistoryPopover ? (
            <button
              ref={historyButtonRef}
              type="button"
              onClick={() => setHistoryOpen((value) => !value)}
              className={`shrink-0 rounded border px-2 py-1 text-[10px] active:translate-y-px ${
                historyOpen
                  ? "border-[var(--accent)] bg-[#152235] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[#151515] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
              }`}
            >
              History {currentItems.length}
            </button>
          ) : (
            <span className="shrink-0 rounded border border-[var(--border)] bg-[#151515] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
              {countLabel}
            </span>
          )}
          {usesHistoryPopover && historyOpen ? (
            <div ref={historyPopoverRef} className="absolute left-0 right-0 top-10 z-50 h-[min(390px,calc(100vh-190px))] min-w-[300px]">
              <GeneratedAudioHistoryPopover
                title={`History ${currentItems.length}`}
                source={activeMeta.label}
                items={currentItems}
                selectedItems={selectedItems}
                onToggle={onToggle}
                onPreview={onPreview}
                onAdd={onAdd}
              />
            </div>
          ) : null}
        </div>

        {activeTab === "upload" ? (
          <UploadAudioList items={currentItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
        ) : activeTab === "lyrics" ? (
          <LyricsPanel />
        ) : activeTab === "voice" ? (
          <VoicePanel items={currentItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
        ) : activeTab === "music" ? (
          <MusicPanel items={currentItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
        ) : (
          <AudioSourceList source={activeMeta.label} items={currentItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
        )}
      </section>
    </div>
  );
}

const SPOTIFY_RAPIDAPI_HOST = "spotify23.p.rapidapi.com";

const voiceDesignOptions = {
  gender: [
    { value: "young boy", label: "Anak laki-laki" },
    { value: "young girl", label: "Anak perempuan" },
    { value: "young man", label: "Pria muda" },
    { value: "young woman", label: "Wanita muda" },
    { value: "adult man", label: "Pria dewasa" },
    { value: "adult woman", label: "Wanita dewasa" }
  ],
  age: [
    { value: "around 8 years old", label: "8 tahun" },
    { value: "around 12 years old", label: "12 tahun" },
    { value: "around 20 years old", label: "20-an" },
    { value: "around 35 years old", label: "35-an" },
    { value: "around 55 years old", label: "55-an" }
  ],
  tone: [
    { value: "warm and friendly", label: "Hangat" },
    { value: "cheerful and bright", label: "Ceria" },
    { value: "soft and sweet", label: "Lembut" },
    { value: "confident and clear", label: "Percaya diri" },
    { value: "calm and professional", label: "Profesional" }
  ],
  emotion: [
    { value: "happy", label: "Senang" },
    { value: "excited", label: "Antusias" },
    { value: "relaxed", label: "Santai" },
    { value: "melancholic", label: "Sendu" },
    { value: "serious", label: "Serius" }
  ],
  pace: [
    { value: "slowly", label: "Pelan" },
    { value: "at a natural pace", label: "Natural" },
    { value: "quickly", label: "Cepat" }
  ],
  accent: [
    { value: "with a neutral Indonesian accent", label: "Indonesia netral" },
    { value: "with a casual Indonesian accent", label: "Indonesia kasual" },
    { value: "with a neutral English accent", label: "English netral" }
  ],
  pitch: [
    { value: "high-pitched", label: "Tinggi" },
    { value: "natural-pitched", label: "Natural" },
    { value: "low-pitched", label: "Rendah" }
  ]
};

const VOXCPM_REFERENCE_STORAGE_KEY = "videme-voxcpm-reference-presets";
const APIFRAME_KEYS_LOCAL_STORAGE_KEY = "videme-apiframe-api-keys";
const OPENROUTER_KEYS_LOCAL_STORAGE_KEY = "videme-openrouter-api-keys";

function VoicePanel({ items, selectedItems, onToggle, onPreview, onAdd }) {
  const [voiceMode, setVoiceMode] = useState("design");
  const modeItems = items.filter((item) => {
    if (voiceMode === "clone") return item.metadata?.source === "voice-clone";
    return item.metadata?.source === "voice-design" || (item.metadata?.source === "ai" && item.metadata?.voxMode === "design");
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--border)] bg-[#0d0d0d] p-1">
        {[
          ["design", "Generation Voice"],
          ["clone", "Voice Clone"]
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setVoiceMode(id)}
            className={`h-8 rounded text-[11px] font-semibold ${voiceMode === id ? "bg-[var(--accent)] text-[#07111f]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <VoxCpmPanel mode={voiceMode} items={modeItems} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
    </div>
  );
}

function VoxCpmPanel({ mode, items, selectedItems, onToggle, onPreview, onAdd }) {
  const addMediaItem = useMediaStore((state) => state.addMediaItem);
  const createMediaDraft = useMediaStore((state) => state.createMediaDraft);
  const repairInputRef = useRef(null);
  const runtimeReferenceFiles = useRef(new Map());
  const [targetText, setTargetText] = useState("Halo, selamat datang di Vidme Pro. Hari ini kita akan membuat suara narasi yang natural.");
  const [promptText, setPromptText] = useState("");
  const [referenceAudio, setReferenceAudio] = useState(null);
  const [repairPresetId, setRepairPresetId] = useState(null);
  const [savedReferences, setSavedReferences] = useState(() => loadSavedReferences());
  const [referenceStatus, setReferenceStatus] = useState({});
  const [voice, setVoice] = useState({
    gender: "young boy",
    age: "around 8 years old",
    tone: "cheerful and bright",
    emotion: "happy",
    pace: "at a natural pace",
    accent: "with a neutral Indonesian accent",
    pitch: "high-pitched"
  });
  const [cfgValue, setCfgValue] = useState(2);
  const [normalize, setNormalize] = useState(false);
  const [denoise, setDenoise] = useState(true);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const isDesign = mode === "design";
  const controlInstruction = buildControlInstruction(voice);
  const canGenerate = targetText.trim() && (isDesign || referenceAudio);
  const source = isDesign ? "Generation Voice" : "Voice Clone";
  const canSaveReference = !isDesign && referenceAudio && promptText.trim();

  useEffect(() => {
    if (isDesign || !savedReferences.length) return undefined;
    let cancelled = false;
    const checkReferences = async () => {
      const entries = await Promise.all(
        savedReferences.map(async (item) => {
          if (runtimeReferenceFiles.current.has(item.id)) return [item.id, "ready"];
          if (!item.path || !window.videmeNative?.file?.exists) return [item.id, "missing"];
          const result = await window.videmeNative.file.exists(item.path);
          return [item.id, result?.exists ? "ready" : "missing"];
        })
      );
      if (!cancelled) setReferenceStatus(Object.fromEntries(entries));
    };
    checkReferences();
    return () => {
      cancelled = true;
    };
  }, [isDesign, savedReferences]);

  useEffect(() => {
    if (!isDesign) persistSavedReferences(savedReferences);
  }, [isDesign, savedReferences]);

  const generateSpeech = async () => {
    if (!targetText.trim()) {
      setMessage("Target text masih kosong.");
      return;
    }
    if (!isDesign && !referenceAudio) {
      setMessage("Upload reference audio dulu untuk mode Clone.");
      return;
    }
    setStatus("loading");
    setMessage(isDesign ? "Membuat voice design dengan VoxCPM..." : "Meng-clone suara reference dengan VoxCPM...");
    try {
      const blob = await generateVoxCpmSpeech({
        text: targetText.trim(),
        controlInstruction: isDesign ? controlInstruction : "",
        referenceAudio: isDesign ? null : referenceAudio,
        usePromptText: !isDesign && Boolean(promptText.trim()),
        promptText: isDesign ? "" : promptText.trim(),
        cfgValue,
        normalize,
        denoise
      });
      const file = new File([blob], `voxcpm-${mode}-${Date.now()}.wav`, { type: blob.type || "audio/wav" });
      const draft = createMediaDraft(file, {
        name: `VoxCPM ${isDesign ? "Design" : "Clone"} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        metadata: {
          ffprobe: null,
          source: isDesign ? "voice-design" : "voice-clone",
          voxMode: mode,
          controlInstruction: isDesign ? controlInstruction : "",
          promptText: isDesign ? "" : promptText.trim()
        }
      });
      const metadata = await readMediaMetadata(file, draft.url);
      const waveformData = await generateWaveform(file);
      addMediaItem({ ...draft, ...metadata, duration: metadata.duration || draft.duration, waveformData });
      setStatus("idle");
      setMessage(`Audio VoxCPM ditambahkan ke ${source}.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Gagal generate VoxCPM.");
    }
  };

  const applyReferenceFile = (file) => {
    if (!file) return;
    setReferenceAudio(file);
  };

  const saveReferencePreset = () => {
    if (!canSaveReference) {
      setMessage("Upload audio dan isi transcript dulu sebelum simpan.");
      return;
    }
    const id = crypto.randomUUID();
    const path = getFilePath(referenceAudio);
    const preset = {
      id,
      name: referenceAudio.name || "Reference audio",
      path,
      size: referenceAudio.size || 0,
      lastModified: referenceAudio.lastModified || 0,
      transcript: promptText.trim(),
      savedAt: Date.now()
    };
    runtimeReferenceFiles.current.set(id, referenceAudio);
    setSavedReferences((state) => [preset, ...state.filter((item) => item.path ? item.path !== path : item.name !== preset.name).slice(0, 11)]);
    setReferenceStatus((state) => ({ ...state, [id]: "ready" }));
    setMessage("Reference voice disimpan.");
  };

  const selectSavedReference = async (preset) => {
    setPromptText(preset.transcript || "");
    const runtimeFile = runtimeReferenceFiles.current.get(preset.id);
    if (runtimeFile) {
      setReferenceAudio(runtimeFile);
      setReferenceStatus((state) => ({ ...state, [preset.id]: "ready" }));
      return;
    }
    if (preset.path && window.videmeNative?.file?.readAudio) {
      const result = await window.videmeNative.file.readAudio(preset.path);
      if (result?.ok) {
        const bytes = new Uint8Array(result.bytes || []);
        const file = new File([bytes], result.name || preset.name, { type: result.mime || "audio/*", lastModified: preset.lastModified || Date.now() });
        runtimeReferenceFiles.current.set(preset.id, file);
        setReferenceAudio(file);
        setReferenceStatus((state) => ({ ...state, [preset.id]: "ready" }));
        return;
      }
    }
    setReferenceAudio(null);
    setReferenceStatus((state) => ({ ...state, [preset.id]: "missing" }));
    setRepairPresetId(preset.id);
    setMessage("File reference tidak ditemukan. Klik Cari File untuk menautkan ulang.");
  };

  const repairSavedReference = (preset) => {
    setRepairPresetId(preset.id);
    repairInputRef.current?.click();
  };

  const handleRepairFile = (file) => {
    if (!file || !repairPresetId) return;
    runtimeReferenceFiles.current.set(repairPresetId, file);
    setReferenceAudio(file);
    setSavedReferences((state) =>
      state.map((item) =>
        item.id === repairPresetId
          ? { ...item, name: file.name || item.name, path: getFilePath(file), size: file.size || item.size, lastModified: file.lastModified || item.lastModified }
          : item
      )
    );
    setReferenceStatus((state) => ({ ...state, [repairPresetId]: "ready" }));
    setRepairPresetId(null);
    setMessage("File reference berhasil ditautkan ulang.");
  };

  return (
    <div className="no-scrollbar h-full overflow-y-auto pr-1">
      <div className="space-y-3">
        <label className="grid gap-1 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
          Target Text
          <textarea
            value={targetText}
            onChange={(event) => setTargetText(event.target.value)}
            rows={4}
            className="no-scrollbar min-h-24 resize-none rounded-md border border-[var(--border)] bg-[#101010] p-2 text-xs normal-case leading-5 text-white outline-none focus:border-[var(--accent)]"
          />
        </label>

        {isDesign ? (
          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[#141414] p-2">
            <CompactSelect label="Gender" value={voice.gender} options={voiceDesignOptions.gender} onChange={(value) => setVoice((state) => ({ ...state, gender: value }))} />
            <CompactSelect label="Umur" value={voice.age} options={voiceDesignOptions.age} onChange={(value) => setVoice((state) => ({ ...state, age: value }))} />
            <CompactSelect label="Nada" value={voice.tone} options={voiceDesignOptions.tone} onChange={(value) => setVoice((state) => ({ ...state, tone: value }))} />
            <CompactSelect label="Emosi" value={voice.emotion} options={voiceDesignOptions.emotion} onChange={(value) => setVoice((state) => ({ ...state, emotion: value }))} />
            <CompactSelect label="Pace" value={voice.pace} options={voiceDesignOptions.pace} onChange={(value) => setVoice((state) => ({ ...state, pace: value }))} />
            <CompactSelect label="Aksen" value={voice.accent} options={voiceDesignOptions.accent} onChange={(value) => setVoice((state) => ({ ...state, accent: value }))} />
            <CompactSelect label="Pitch" value={voice.pitch} options={voiceDesignOptions.pitch} onChange={(value) => setVoice((state) => ({ ...state, pitch: value }))} />
            <div className="rounded border border-[var(--border-soft)] bg-[#101010] p-2 text-[10px] leading-4 text-[var(--text-muted)]">
              {controlInstruction}
            </div>
          </div>
        ) : (
          <div className="space-y-2 rounded-md border border-[var(--border)] bg-[#141414] p-2">
            {savedReferences.length ? (
              <SavedReferenceRail
                references={savedReferences}
                statuses={referenceStatus}
                onSelect={selectSavedReference}
                onRepair={repairSavedReference}
              />
            ) : null}
            <input
              ref={repairInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                handleRepairFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase text-[var(--text-muted)]">Reference Audio</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => applyReferenceFile(event.target.files?.[0] ?? null)}
              />
              <span className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white">
                <Upload size={13} />
                {referenceAudio ? referenceAudio.name : "Upload WAV/MP3"}
              </span>
            </label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
              Transcript Reference
              <textarea
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                rows={4}
                placeholder="Isi transcript audio reference agar cloning lebih stabil."
                className="no-scrollbar min-h-20 resize-none rounded-md border border-[var(--border)] bg-[#101010] p-2 text-xs normal-case leading-5 text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
            </label>
            <button
              type="button"
              disabled={!canSaveReference}
              onClick={saveReferencePreset}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Save size={13} />
              Simpan Reference
            </button>
          </div>
        )}

        <div className="space-y-2 rounded-md border border-[var(--border)] bg-[#141414] p-2">
          <RangeMini label={`CFG ${cfgValue}`} min="1" max="3" step="0.1" value={cfgValue} onChange={setCfgValue} />
          <ToggleMini label="Normalize text" checked={normalize} onChange={setNormalize} />
          <ToggleMini label="Denoise reference" checked={denoise} onChange={setDenoise} />
        </div>

        {message ? (
          <div className={`rounded-md border px-2 py-2 text-xs leading-5 ${status === "error" ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-[var(--border)] bg-[#151515] text-[var(--text-secondary)]"}`}>
            {message}
          </div>
        ) : null}

        <button
          type="button"
          disabled={status === "loading" || !canGenerate}
          onClick={generateSpeech}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-xs font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Mic2 size={14} />
          {status === "loading" ? "Generating..." : "Generate Speech"}
        </button>

      </div>
    </div>
  );
}

function CompactSelect({ label, value, options, onChange }) {
  return <ModernSelect label={label} value={value} options={options} onChange={onChange} layout="row-80" buttonClassName="h-8" menuClassName="no-scrollbar" />;
}

function SavedReferenceRail({ references, statuses, onSelect, onRepair }) {
  return (
    <HorizontalRail className="mb-1" contentClassName="flex gap-2 pb-1" step={156} buttonClassName="h-14">
      {references.map((item) => {
        const missing = statuses[item.id] === "missing";
        return (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(item);
              }
            }}
            className={`min-w-[150px] max-w-[170px] rounded-md border bg-[#101010] p-2 text-left hover:bg-[var(--bg-hover)] ${
              missing ? "border-red-500/45" : "border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${missing ? "bg-red-500/10 text-red-200" : "bg-[var(--clip-audio)]/12 text-[var(--clip-audio)]"}`}>
                <FileAudio size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-semibold text-white">{item.name}</span>
                <span className="block truncate text-[9px] text-[var(--text-muted)]">{item.transcript || "Transcript tersimpan"}</span>
              </span>
            </div>
            {missing ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRepair(item);
                }}
                className="mt-2 flex h-7 w-full items-center justify-center gap-1 rounded border border-red-500/35 text-[10px] text-red-100 hover:bg-red-500/10"
              >
                <FolderOpen size={12} />
                Cari File
              </button>
            ) : null}
          </div>
        );
      })}
    </HorizontalRail>
  );
}

function RangeMini({ label, min, max, step, value, onChange }) {
  return (
    <label className="grid gap-1 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[var(--accent)]" />
    </label>
  );
}

function ToggleMini({ label, checked, onChange }) {
  return (
    <label className="flex h-7 items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
      <span className="truncate">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[var(--accent)]" />
    </label>
  );
}

function buildControlInstruction(voice) {
  return `Create a ${voice.pitch} voice for a ${voice.gender}, ${voice.age}. The voice should sound ${voice.tone}, ${voice.emotion}, natural, and expressive. Speak ${voice.pace}, ${voice.accent}.`;
}

function loadSavedReferences() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOXCPM_REFERENCE_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.name && item?.transcript).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function persistSavedReferences(references) {
  localStorage.setItem(VOXCPM_REFERENCE_STORAGE_KEY, JSON.stringify(references.slice(0, 12)));
}

function getFilePath(file) {
  return file?.path || file?.webkitRelativePath || "";
}

function maskApiKeyForUi(key) {
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 3)}...${key.slice(-3)}`;
  return `${key.slice(0, 7)}...${key.slice(-4)}`;
}

function normalizeApiKeyList(keys) {
  return [...new Set(keys.map((key) => String(key || "").trim()).filter(Boolean))].map((key, index) => ({
    id: key,
    index: index + 1,
    masked: maskApiKeyForUi(key),
    credit: null,
    connected: false,
    source: "local"
  }));
}

function loadLocalApiframeKeys() {
  try {
    const parsed = JSON.parse(localStorage.getItem(APIFRAME_KEYS_LOCAL_STORAGE_KEY) || "[]");
    return normalizeApiKeyList(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function saveLocalApiframeKeys(entries) {
  localStorage.setItem(APIFRAME_KEYS_LOCAL_STORAGE_KEY, JSON.stringify(entries.map((entry) => entry.id)));
}

async function checkLocalApiframeKey(entry) {
  try {
    const response = await fetch("/apiframe-proxy/v2/me", {
      method: "GET",
      headers: { "X-API-Key": entry.id }
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      return { ...entry, connected: false, credit: null, error: data?.error || text || `Apiframe gagal (${response.status}).` };
    }
    return {
      ...entry,
      connected: true,
      credit: Number(data?.team?.credits ?? 0),
      userEmail: data?.user?.email || "",
      teamName: data?.team?.name || "",
      plan: data?.team?.plan || "",
      apiKeyName: data?.apiKey?.name || ""
    };
  } catch (error) {
    return {
      ...entry,
      connected: false,
      credit: null,
      error: error instanceof Error && error.message === "Failed to fetch"
        ? "Gagal cek kredit. Restart dev server agar proxy Apiframe aktif."
        : error instanceof Error ? error.message : "Gagal cek kredit Apiframe."
    };
  }
}

async function checkLocalApiframeKeys(entries) {
  return Promise.all(entries.map((entry) => checkLocalApiframeKey(entry)));
}

function loadLocalOpenrouterKeys() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPENROUTER_KEYS_LOCAL_STORAGE_KEY) || "[]");
    return normalizeApiKeyList(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

function saveLocalOpenrouterKeys(entries) {
  localStorage.setItem(OPENROUTER_KEYS_LOCAL_STORAGE_KEY, JSON.stringify(entries.map((entry) => entry.id)));
}

async function checkLocalOpenrouterKey(entry) {
  try {
    const response = await fetch("/openrouter-proxy/api/v1/key", {
      method: "GET",
      headers: { Authorization: `Bearer ${entry.id}` }
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      return { ...entry, connected: false, credit: null, error: data?.error?.message || data?.error || text || `OpenRouter gagal (${response.status}).` };
    }
    const info = data?.data || data || {};
    const limit = Number(info.limit ?? info.credit_limit ?? NaN);
    const usage = Number(info.usage ?? info.usage_total ?? 0);
    return {
      ...entry,
      connected: true,
      credit: Number.isFinite(limit) ? Math.max(0, limit - usage) : null,
      userEmail: info.label || info.name || "",
      limit: Number.isFinite(limit) ? limit : null,
      usage: Number.isFinite(usage) ? usage : null
    };
  } catch (error) {
    return {
      ...entry,
      connected: false,
      credit: null,
      error: error instanceof Error && error.message === "Failed to fetch"
        ? "Gagal cek OpenRouter. Restart dev server agar proxy aktif."
        : error instanceof Error ? error.message : "Gagal cek OpenRouter."
    };
  }
}

async function checkLocalOpenrouterKeys(entries) {
  return Promise.all(entries.map((entry) => checkLocalOpenrouterKey(entry)));
}

const musicModelOptions = [
  { group: true, label: "Suno" },
  { value: "suno-v5-5", label: "Suno V5.5 · 11 kredit" },
  { value: "suno-v4-5-plus", label: "Suno V4.5 Plus · 11 kredit" },
  { value: "suno-v5", label: "Suno V5 · 11 kredit" },
  { value: "suno-v4-5", label: "Suno V4.5 · 11 kredit" },
  { value: "suno-v4", label: "Suno V4 · 11 kredit" },
  { group: true, label: "Google Lyria" },
  { value: "lyria-3-pro", label: "Lyria 3 Pro · 14 kredit" },
  { value: "lyria-3-clip", label: "Lyria 3 Clip · 7 kredit" },
  { group: true, label: "Producer (FUZZ)" },
  { value: "producer-fuzz-2-pro", label: "Producer FUZZ 2 Pro · 6 kredit" },
  { value: "producer-fuzz-2", label: "Producer FUZZ 2 · 6 kredit" },
  { group: true, label: "Udio" },
  { value: "udio", label: "Udio · 9 kredit" }
];

const openrouterFreeModelOptions = [
  { group: true, label: "OpenAI" },
  { value: "openai/gpt-oss-120b:free", label: "GPT OSS 120B" },
  { value: "openai/gpt-oss-20b:free", label: "GPT OSS 20B" },
  { group: true, label: "NVIDIA Nemotron" },
  { value: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra 550B" },
  { value: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B" },
  { value: "nvidia/nemotron-3-nano-30b-a3b:free", label: "Nemotron 3 Nano 30B" },
  { value: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "Nemotron 3 Nano Omni Reasoning" },
  { value: "nvidia/nemotron-nano-9b-v2:free", label: "Nemotron Nano 9B V2" },
  { value: "nvidia/nemotron-nano-12b-v2-vl:free", label: "Nemotron Nano 12B VL" },
  { value: "nvidia/nemotron-3.5-content-safety:free", label: "Nemotron 3.5 Content Safety" },
  { value: "nvidia/llama-nemotron-embed-vl-1b-v2:free", label: "Llama Nemotron Embed VL 1B" },
  { value: "nvidia/llama-nemotron-rerank-vl-1b-v2:free", label: "Llama Nemotron Rerank VL 1B" },
  { group: true, label: "Poolside Laguna" },
  { value: "poolside/laguna-m.1:free", label: "Laguna M.1" },
  { value: "poolside/laguna-xs.2:free", label: "Laguna XS.2" },
  { group: true, label: "Google Gemma" },
  { value: "google/gemma-4-31b-it:free", label: "Gemma 4 31B IT" },
  { value: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B A4B IT" },
  { group: true, label: "Qwen" },
  { value: "qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen3 Next 80B Instruct" },
  { value: "qwen/qwen3-coder:free", label: "Qwen3 Coder" },
  { group: true, label: "Meta Llama" },
  { value: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B Instruct" },
  { group: true, label: "Liquid" },
  { value: "liquid/lfm-2.5-1.2b-thinking:free", label: "LFM 2.5 1.2B Thinking" },
  { value: "liquid/lfm-2.5-1.2b-instruct:free", label: "LFM 2.5 1.2B Instruct" },
  { group: true, label: "Cohere" },
  { value: "cohere/north-mini-code:free", label: "North Mini Code" }
];

const musicModelApiMap = {
  "suno-v5-5": { model: "suno", sunoVersion: "V5_5" },
  "suno-v4-5-plus": { model: "suno", sunoVersion: "V4_5PLUS" },
  "suno-v5": { model: "suno", sunoVersion: "V5" },
  "suno-v4-5": { model: "suno", sunoVersion: "V4_5" },
  "suno-v4": { model: "suno", sunoVersion: "V4" },
  "lyria-3-pro": { model: "lyria-3-pro" },
  "lyria-3-clip": { model: "lyria-3-clip" },
  "producer-fuzz-2-pro": { model: "producer-fuzz-2-pro" },
  "producer-fuzz-2": { model: "producer-fuzz-2" },
  udio: { model: "udio" }
};

function MusicPanel({ items, selectedItems, onToggle, onPreview, onAdd }) {
  const [modalOpen, setModalOpen] = useState(false);
  const latestMusic = items[0];

  return (
    <>
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-xs font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] active:translate-y-px"
        >
          <Sparkles size={15} />
          Generate Music AI
        </button>
        <div className="rounded-md border border-[var(--border)] bg-[#141414] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Music size={14} className="text-[var(--clip-audio)]" />
            Music Library
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            {items.length ? `${items.length} hasil music tersimpan di History.` : "Belum ada hasil music. Tekan Generate Music AI untuk membuat lagu."}
          </p>
          {latestMusic ? (
            <div className="mt-3 rounded-md border border-[var(--border-soft)] bg-[#101010] p-2">
              <div className="truncate text-xs font-semibold text-white">{latestMusic.metadata?.title || latestMusic.name}</div>
              <div className="mt-1 text-[10px] text-[var(--text-muted)]">{formatTime(latestMusic.duration)} - {formatAudioSource(latestMusic)}</div>
            </div>
          ) : null}
        </div>
      </div>
      {modalOpen ? (
        <MusicGenerationModal
          items={items}
          selectedItems={selectedItems}
          onToggle={onToggle}
          onPreview={onPreview}
          onAdd={onAdd}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function MusicGenerationModal({ items, selectedItems, onToggle, onPreview, onAdd, onClose }) {
  const addMediaItem = useMediaStore((state) => state.addMediaItem);
  const createMediaDraft = useMediaStore((state) => state.createMediaDraft);
  const audioRef = useRef(null);
  const [model, setModel] = useState("suno-v5-5");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [instrumental, setInstrumental] = useState(false);
  const [vocalGender, setVocalGender] = useState("");
  const [sunoVersion, setSunoVersion] = useState("V4_5PLUS");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [likedIds, setLikedIds] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [selectedMusicId, setSelectedMusicId] = useState(items[0]?.id || null);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeyMessage, setApiKeyMessage] = useState("");
  const [apiSettingsTab, setApiSettingsTab] = useState("music");
  const [openrouterDraft, setOpenrouterDraft] = useState("");
  const [openrouterKeys, setOpenrouterKeys] = useState([]);
  const [openrouterMessage, setOpenrouterMessage] = useState("");
  const [visibleApiKeyIds, setVisibleApiKeyIds] = useState([]);
  const [visibleOpenrouterKeyIds, setVisibleOpenrouterKeyIds] = useState([]);
  const [autoFillOpen, setAutoFillOpen] = useState(false);
  const [autoFillPrompt, setAutoFillPrompt] = useState("");
  const [autoFillModel, setAutoFillModel] = useState("openai/gpt-oss-120b:free");
  const [autoFillStatus, setAutoFillStatus] = useState("idle");
  const [autoFillMessage, setAutoFillMessage] = useState("");
  const apiKeyMenuRef = useRef(null);
  const vocalLyricsPlaceholder = `[Intro]
Bisikkan satu kalimat pembuka yang membangun suasana.

[Verse 1]
Mulai cerita utama dengan bahasa yang jelas dan mengalir.

[Pre-Chorus]
Naikkan emosi, beri rasa menuju bagian reff.

[Chorus]
Tulis hook utama yang paling mudah diingat.

[Bridge]
Beri kejutan kecil atau sudut pandang baru.

[Outro]
Tutup lagu dengan kalimat singkat yang membekas.`;
  const instrumentalPromptPlaceholder = "Contoh: intro piano lembut, beat masuk perlahan, hook gitar bersih, energi naik di bagian akhir.";
  const connectedApiKeys = apiKeys.filter((key) => key.connected);
  const totalApiCredits = apiKeys.reduce((sum, key) => sum + (Number.isFinite(key.credit) ? key.credit : 0), 0);

  const filteredItems = items.filter((item) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [item.name, item.metadata?.title, item.metadata?.prompt, item.metadata?.tags, item.metadata?.model]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
  const selectedMusic = items.find((item) => item.id === selectedMusicId) || filteredItems[0] || items[0] || null;

  useEffect(() => {
    if (!selectedMusicId && items[0]?.id) setSelectedMusicId(items[0].id);
  }, [items, selectedMusicId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [onClose]);

  const refreshApiKeys = async (checkCredits = false) => {
    if (!window.videmeNative?.apiframe?.listKeys) {
      const localKeys = loadLocalApiframeKeys();
      const nextKeys = checkCredits ? await checkLocalApiframeKeys(localKeys) : localKeys;
      setApiKeys(nextKeys);
      return;
    }
    const result = await window.videmeNative.apiframe.listKeys({ checkCredits });
    if (result?.ok) setApiKeys(result.keys || []);
  };

  const refreshOpenrouterKeys = async (checkCredits = false) => {
    if (!window.videmeNative?.openrouter?.listKeys) {
      const localKeys = loadLocalOpenrouterKeys();
      const nextKeys = checkCredits ? await checkLocalOpenrouterKeys(localKeys) : localKeys;
      setOpenrouterKeys(nextKeys);
      return;
    }
    const result = await window.videmeNative.openrouter.listKeys({ checkCredits });
    if (result?.ok) setOpenrouterKeys(result.keys || []);
  };

  useEffect(() => {
    refreshApiKeys(true);
    refreshOpenrouterKeys(true);
  }, []);

  useEffect(() => {
    if (!apiKeyOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!apiKeyMenuRef.current?.contains(event.target)) setApiKeyOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [apiKeyOpen]);

  const addApiKeys = async () => {
    if (!apiKeyDraft.trim()) {
      setApiKeyMessage("API Key masih kosong.");
      return;
    }
    const requestedCount = apiKeyDraft.split(/\r?\n/).map((key) => key.trim()).filter(Boolean).length;
    if (!window.videmeNative?.apiframe?.addKeys) {
      const existing = loadLocalApiframeKeys();
      const next = normalizeApiKeyList([...existing.map((entry) => entry.id), ...apiKeyDraft.split(/\r?\n/)]);
      const checked = await checkLocalApiframeKeys(next);
      saveLocalApiframeKeys(checked);
      setApiKeys(checked);
      setApiKeyDraft("");
      const connectedCount = checked.filter((key) => key.connected).length;
      setApiKeyMessage(`${requestedCount} API Key diproses. ${connectedCount} terhubung.`);
      return;
    }
    const result = await window.videmeNative.apiframe.addKeys(apiKeyDraft);
    if (!result?.ok) {
      setApiKeyMessage(result?.error || "Gagal menyimpan API Key.");
      return;
    }
    setApiKeys(result.keys || []);
    setApiKeyDraft("");
    const connectedCount = (result.keys || []).filter((key) => key.connected).length;
    setApiKeyMessage(`${requestedCount} API Key diproses. ${connectedCount} terhubung.`);
  };

  const addOpenrouterKeys = async () => {
    if (!openrouterDraft.trim()) {
      setOpenrouterMessage("OpenRouter API Key masih kosong.");
      return;
    }
    const requestedCount = openrouterDraft.split(/\r?\n/).map((key) => key.trim()).filter(Boolean).length;
    if (!window.videmeNative?.openrouter?.addKeys) {
      const existing = loadLocalOpenrouterKeys();
      const next = normalizeApiKeyList([...existing.map((entry) => entry.id), ...openrouterDraft.split(/\r?\n/)]);
      const checked = await checkLocalOpenrouterKeys(next);
      saveLocalOpenrouterKeys(checked);
      setOpenrouterKeys(checked);
      setOpenrouterDraft("");
      const connectedCount = checked.filter((key) => key.connected).length;
      setOpenrouterMessage(`${requestedCount} OpenRouter Key diproses. ${connectedCount} terhubung.`);
      return;
    }
    const result = await window.videmeNative.openrouter.addKeys(openrouterDraft);
    if (!result?.ok) {
      setOpenrouterMessage(result?.error || "Gagal menyimpan OpenRouter API Key.");
      return;
    }
    setOpenrouterKeys(result.keys || []);
    setOpenrouterDraft("");
    const connectedCount = (result.keys || []).filter((key) => key.connected).length;
    setOpenrouterMessage(`${requestedCount} OpenRouter Key diproses. ${connectedCount} terhubung.`);
  };

  const removeApiKey = async (id) => {
    if (!window.videmeNative?.apiframe?.removeKey) {
      const next = loadLocalApiframeKeys().filter((key) => key.id !== id).map((key, index) => ({ ...key, index: index + 1 }));
      saveLocalApiframeKeys(next);
      setApiKeys(next);
      setVisibleApiKeyIds((ids) => ids.filter((keyId) => keyId !== id));
      setApiKeyMessage("API Key lokal dihapus.");
      return;
    }
    const result = await window.videmeNative.apiframe.removeKey(id);
    if (result?.ok) {
      setApiKeys(result.keys || []);
      setApiKeyMessage("API Key dihapus.");
    }
  };

  const removeOpenrouterKey = async (id) => {
    if (!window.videmeNative?.openrouter?.removeKey) {
      const next = loadLocalOpenrouterKeys().filter((key) => key.id !== id).map((key, index) => ({ ...key, index: index + 1 }));
      saveLocalOpenrouterKeys(next);
      setOpenrouterKeys(next);
      setVisibleOpenrouterKeyIds((ids) => ids.filter((keyId) => keyId !== id));
      setOpenrouterMessage("OpenRouter API Key lokal dihapus.");
      return;
    }
    const result = await window.videmeNative.openrouter.removeKey(id);
    if (result?.ok) {
      setOpenrouterKeys(result.keys || []);
      setOpenrouterMessage("OpenRouter API Key dihapus.");
    }
  };

  const openApiframeSite = () => {
    if (window.videmeNative?.shell?.openExternal) {
      window.videmeNative.shell.openExternal("https://apiframe.ai");
    } else {
      window.open("https://apiframe.ai", "_blank", "noopener,noreferrer");
    }
  };

  const openOpenrouterSite = () => {
    if (window.videmeNative?.shell?.openExternal) {
      window.videmeNative.shell.openExternal("https://openrouter.ai");
    } else {
      window.open("https://openrouter.ai", "_blank", "noopener,noreferrer");
    }
  };

  const toggleVisibleApiKey = (id) => {
    setVisibleApiKeyIds((ids) => (ids.includes(id) ? ids.filter((keyId) => keyId !== id) : [...ids, id]));
  };

  const toggleVisibleOpenrouterKey = (id) => {
    setVisibleOpenrouterKeyIds((ids) => (ids.includes(id) ? ids.filter((keyId) => keyId !== id) : [...ids, id]));
  };

  const callOpenrouterAutoFill = async (idea) => {
    const modeLabel = instrumental ? "instrumental music" : "vocal song";
    const messages = [
      {
        role: "system",
        content:
          "You help fill an AI music generator form. Reply with JSON only. Keys: title, lyrics, style, vocalGender. title max 80 chars. lyrics max 5000 chars. style max 1000 chars. vocalGender is m, f, or empty string."
      },
      {
        role: "user",
        content:
          `Create form content for ${modeLabel}. User idea: ${idea}\n` +
          (instrumental
            ? "Make lyrics a concise instrumental arrangement prompt, not sung lyrics. Use Indonesian where natural."
            : "Make lyrics with sections [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro]. Use Indonesian where natural.")
      }
    ];
    if (window.videmeNative?.openrouter?.complete) {
      const result = await window.videmeNative.openrouter.complete({ model: autoFillModel, messages, temperature: 0.75 });
      if (!result?.ok) throw new Error(result?.error || "OpenRouter gagal mengisi form.");
      return result.data?.choices?.[0]?.message?.content || "";
    }
    const activeKey = openrouterKeys.find((key) => key.connected)?.id || loadLocalOpenrouterKeys()[0]?.id || "";
    if (!activeKey) throw new Error("Tambahkan OpenRouter API Key di tab AI Auto Fill dulu.");
    const response = await fetch("/openrouter-proxy/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${activeKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vidme.pro",
        "X-OpenRouter-Title": "Vidme Pro"
      },
      body: JSON.stringify({ model: autoFillModel, messages, temperature: 0.75, response_format: { type: "json_object" } })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || data?.error || "OpenRouter gagal. Restart dev server jika proxy belum aktif.");
    return data?.choices?.[0]?.message?.content || "";
  };

  const applyAutoFill = async () => {
    if (!autoFillPrompt.trim()) {
      setAutoFillMessage(instrumental ? "Tulis gambaran singkat instrumental yang kamu bayangkan." : "Tulis gambaran singkat music yang kamu bayangkan.");
      return;
    }
    setAutoFillStatus("loading");
    setAutoFillMessage("AI sedang mengisi form...");
    try {
      const raw = await callOpenrouterAutoFill(autoFillPrompt.trim());
      const jsonText = String(raw || "").match(/\{[\s\S]*\}/)?.[0] || raw;
      const parsed = JSON.parse(jsonText);
      setTitle(String(parsed.title || "").slice(0, 80));
      setPrompt(String(parsed.lyrics || "").slice(0, 5000));
      setStyle(String(parsed.style || "").slice(0, 1000));
      if (!instrumental && ["m", "f"].includes(parsed.vocalGender)) setVocalGender(parsed.vocalGender);
      setAutoFillStatus("idle");
      setAutoFillMessage("Form berhasil diisi otomatis.");
      setTimeout(() => setAutoFillOpen(false), 500);
    } catch (error) {
      setAutoFillStatus("error");
      setAutoFillMessage(error instanceof Error ? error.message : "Auto Fill gagal.");
    }
  };

  const generateMusic = async () => {
    if (!prompt.trim()) {
      setMessage("Prompt music masih kosong.");
      return;
    }
    setStatus("loading");
    setMessage("Mengirim job music ke Apiframe...");
    try {
      const payload = buildApiframeMusicPayload({ model, prompt, title, style, customMode, instrumental, vocalGender });
      const browserApiKey = apiKeys.find((key) => key.connected)?.id || loadLocalApiframeKeys()[0]?.id || "";
      const started = window.videmeNative?.apiframe?.generateMusic
        ? await window.videmeNative.apiframe.generateMusic(payload)
        : await generateLocalApiframeMusic(payload, browserApiKey);
      if (!started?.ok) throw new Error(started?.error || "Gagal membuat job music.");
      const jobId = started.data?.jobId || started.data?.id;
      if (!jobId) throw new Error("Apiframe tidak mengembalikan Job ID.");
      const job = await pollApiframeMusicJob(jobId, (next) => {
        const progress = Number.isFinite(next.progress) ? ` ${next.progress}%` : "";
        setMessage(`Music ${String(next.status || "PROCESSING").toLowerCase()}${progress}...`);
      }, window.videmeNative?.apiframe?.getJob ? null : (id) => getLocalApiframeJob(id, browserApiKey));
      const tracks = job?.result?.tracks || [];
      if (!tracks.length) throw new Error("Job selesai, tapi tidak ada track music.");
      setMessage(`Mengunduh ${tracks.length} track music...`);
      let firstCreated = null;
      for (const track of tracks) {
        const created = await addMusicTrackToLibrary(track, { model, prompt, title, style }, { addMediaItem, createMediaDraft });
        if (!firstCreated && created) firstCreated = created;
      }
      if (firstCreated?.id) setSelectedMusicId(firstCreated.id);
      setStatus("idle");
      setMessage(`${tracks.length} track music ditambahkan ke History.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Generate music gagal.");
    }
  };

  const togglePreview = async (item) => {
    if (!item) return;
    if (playingId === item.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(item.url);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    onPreview(item.id);
    setSelectedMusicId(item.id);
    try {
      await audio.play();
      setPlayingId(item.id);
    } catch {
      setPlayingId(null);
    }
  };

  const downloadMusic = (item) => {
    if (!item) return;
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.file?.name || `${item.name || "apiframe-music"}.mp3`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const rerunFromItem = (item) => {
    if (!item) return;
    setPrompt(item.metadata?.prompt || prompt);
    setTitle(item.metadata?.title || "");
    setStyle(item.metadata?.tags || item.metadata?.style || style);
    if (item.metadata?.model) setModel(item.metadata.model);
  };

  return (
    <div className="no-scrollbar fixed inset-0 z-[200] overflow-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="mx-auto grid h-[min(760px,calc(100vh-32px))] w-[70vw] min-w-[860px] max-w-[980px] grid-cols-[minmax(620px,1fr)_240px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-panel)] text-white shadow-2xl shadow-black/70"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <section className="grid min-h-0 grid-cols-[minmax(300px,0.9fr)_minmax(300px,1.1fr)]">
          <div className="flex min-h-0 flex-col border-r border-[var(--border)]">
            <div className="relative flex h-12 shrink-0 items-center border-b border-[var(--border)] px-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                <Sparkles size={14} className="text-[var(--accent)]" />
                Create
              </div>
              <div ref={apiKeyMenuRef} className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setApiKeyOpen((value) => !value)}
                  className={`flex h-8 w-fit items-center justify-center gap-1.5 rounded-md border px-1.5 text-[9px] font-semibold normal-case leading-3 tracking-normal hover:bg-[var(--bg-hover)] hover:text-white ${
                    apiKeyOpen ? "border-[var(--accent)] bg-[#152235] text-white" : "border-[var(--border)] bg-[#151515] text-[var(--text-secondary)]"
                  }`}
                >
                  <KeyRound size={12} />
                  <span className="block text-left">
                    Dapatkan<br />API Key
                  </span>
                </button>
                <div className="flex h-8 w-fit min-w-[84px] flex-col justify-center rounded-md border border-white bg-white px-1.5 text-center normal-case tracking-normal">
                  <div className="text-[12px] font-extrabold leading-3 text-[#d4a017]">Kredit {totalApiCredits}</div>
                  <div className="text-[10px] font-extrabold leading-3 text-[#0f8f3d]">
                    {connectedApiKeys.length ? `${connectedApiKeys.length} Terhubung` : "Belum terhubung"}
                  </div>
                </div>
                {apiKeyOpen ? (
                  <ApiKeySettingsPopover
                    activeTab={apiSettingsTab}
                    onTabChange={setApiSettingsTab}
                    value={apiKeyDraft}
                    keys={apiKeys}
                    message={apiKeyMessage}
                    onChange={setApiKeyDraft}
                    onAdd={addApiKeys}
                    onRefresh={() => refreshApiKeys(true)}
                    onRemove={removeApiKey}
                    visibleIds={visibleApiKeyIds}
                    onToggleVisible={toggleVisibleApiKey}
                    onOpenApiframe={openApiframeSite}
                    openrouterValue={openrouterDraft}
                    openrouterKeys={openrouterKeys}
                    openrouterMessage={openrouterMessage}
                    openrouterVisibleIds={visibleOpenrouterKeyIds}
                    onOpenrouterChange={setOpenrouterDraft}
                    onOpenrouterAdd={addOpenrouterKeys}
                    onOpenrouterRefresh={() => refreshOpenrouterKeys(true)}
                    onOpenrouterRemove={removeOpenrouterKey}
                    onOpenrouterToggleVisible={toggleVisibleOpenrouterKey}
                    onOpenOpenrouter={openOpenrouterSite}
                    onClose={() => setApiKeyOpen(false)}
                  />
                ) : null}
              </div>
            </div>
            <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-3.5">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Type</label>
                <button
                  type="button"
                  onClick={() => {
                    setAutoFillOpen(true);
                    setAutoFillMessage("");
                  }}
                  className="auto-fill-border h-8 px-3 text-[11px] font-bold"
                >
                  <span>Auto Fill</span>
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => setInstrumental(true)} className={`h-8 rounded-md border px-3 text-[11px] font-bold ${instrumental ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]" : "border-[var(--border)] bg-[#101010] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}>Instrumental</button>
                <button type="button" onClick={() => setInstrumental(false)} className={`h-8 rounded-md border px-3 text-[11px] font-bold ${!instrumental ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]" : "border-[var(--border)] bg-[#101010] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"}`}>Vocal</button>
              </div>
              {!instrumental ? (
                <div className="mt-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Vocal Gender <span className="text-[var(--text-muted)]">(Opsional)</span></div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setVocalGender("m")} className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-bold ${vocalGender === "m" ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]" : "border-[var(--border)] bg-[#101010] text-[var(--text-secondary)]"}`}>
                      <User size={12} />
                      Male
                    </button>
                    <button type="button" onClick={() => setVocalGender("f")} className={`flex h-8 items-center gap-1.5 rounded-md border px-3 text-[11px] font-bold ${vocalGender === "f" ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]" : "border-[var(--border)] bg-[#101010] text-[var(--text-secondary)]"}`}>
                      <User size={12} />
                      Female
                    </button>
                    <button type="button" onClick={() => setVocalGender("")} className={`ml-auto h-8 rounded-md border px-3 text-[11px] font-bold ${!vocalGender ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]" : "border-[var(--border)] bg-[#101010] text-[var(--text-secondary)]"}`}>Auto</button>
                  </div>
                </div>
              ) : null}
              <div className="mt-3 space-y-2.5">
                <MusicModalSelect label="Model AI" value={model} options={musicModelOptions} onChange={setModel} />
                <MusicModalInput label="Title" value={title} max={80} placeholder="Judul singkat untuk musik ini" onChange={setTitle} />
                <MusicModalTextArea
                  label="Lyrics"
                  value={prompt}
                  max={5000}
                  rows={instrumental ? 5 : 4}
                  placeholder={instrumental ? instrumentalPromptPlaceholder : vocalLyricsPlaceholder}
                  info={instrumental ? null : <LyricsStructureHelp />}
                  onChange={setPrompt}
                  onCopy={() => navigator.clipboard?.writeText(prompt)}
                  onDelete={() => setPrompt("")}
                />
                <MusicModalTextArea label="Deskripsi utama (wajib)" value={style} max={1000} rows={instrumental ? 3 : 2} placeholder="Contoh: cinematic pop, beat halus, piano terang, mood optimis, cocok untuk opening video" onChange={setStyle} onCopy={() => navigator.clipboard?.writeText(style)} onDelete={() => setStyle("")} />
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-[1fr_76px] gap-2 border-t border-[var(--border)] p-3.5">
              <button
                type="button"
                disabled={status === "loading"}
                onClick={generateMusic}
                className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-3 text-[11px] font-bold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Sparkles size={12} />
                {status === "loading" ? "Creating..." : "Create"}
              </button>
              <button type="button" onClick={() => setMessage("")} className="h-8 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">Clear</button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                <Music size={14} className="text-[var(--accent)]" />
                Library
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <label className="flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[#101010] px-3 text-xs text-[var(--text-muted)]">
                <Search size={15} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari judul, gaya, status..." className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-[var(--text-muted)]" />
                <span>{items.length} lagu</span>
              </label>
              {message ? (
                <div className={`mt-3 rounded-md border px-3 py-2 text-xs leading-5 ${status === "error" ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-[var(--border)] bg-[#151515] text-[var(--text-secondary)]"}`}>
                  {message}
                </div>
              ) : null}
              <div className="no-scrollbar mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <MusicLibraryRow
                      key={item.id}
                      item={item}
                      active={selectedMusic?.id === item.id}
                      selected={selectedItems.includes(item.id)}
                      liked={likedIds.includes(item.id)}
                      playing={playingId === item.id}
                      onSelect={() => {
                        setSelectedMusicId(item.id);
                        onPreview(item.id);
                      }}
                      onPlay={() => togglePreview(item)}
                      onDownload={() => downloadMusic(item)}
                      onRerun={() => rerunFromItem(item)}
                      onLike={() => setLikedIds((ids) => (ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]))}
                      onAdd={() => onAdd(item)}
                      onToggle={() => onToggle(item.id)}
                    />
                  ))
                ) : (
                  <div className="grid h-full min-h-[220px] place-items-center rounded-md border border-dashed border-[var(--border)] bg-[#101010] p-4 text-center">
                    <div>
                      <Music size={24} className="mx-auto text-[var(--accent)]" />
                      <p className="mt-3 text-sm font-bold text-white">Library kosong</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Hasil generate music akan muncul di sini.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col border-l border-[var(--border)] bg-[var(--bg-panel)]">
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              <Play size={14} className="text-[var(--accent)]" />
              Detail
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
              <X size={15} />
            </button>
          </div>
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            {selectedMusic ? (
              <MusicDetailPanel
                item={selectedMusic}
                liked={likedIds.includes(selectedMusic.id)}
                playing={playingId === selectedMusic.id}
                onPlay={() => togglePreview(selectedMusic)}
                onDownload={() => downloadMusic(selectedMusic)}
                onRerun={() => rerunFromItem(selectedMusic)}
                onLike={() => setLikedIds((ids) => (ids.includes(selectedMusic.id) ? ids.filter((id) => id !== selectedMusic.id) : [...ids, selectedMusic.id]))}
                onAdd={() => onAdd(selectedMusic)}
              />
            ) : (
              <div className="grid h-full min-h-[320px] place-items-center rounded-md border border-dashed border-[var(--border)] bg-[#101010] text-center">
                <div>
                  <Music size={28} className="mx-auto text-[var(--accent)]" />
                  <p className="mt-3 text-sm font-bold text-white">Belum ada detail</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Pilih hasil music dari Library.</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
      {autoFillOpen ? (
        <AutoFillDialog
          instrumental={instrumental}
          value={autoFillPrompt}
          model={autoFillModel}
          modelOptions={openrouterFreeModelOptions}
          status={autoFillStatus}
          message={autoFillMessage}
          onChange={setAutoFillPrompt}
          onModelChange={setAutoFillModel}
          onGenerate={applyAutoFill}
          onClose={() => setAutoFillOpen(false)}
        />
      ) : null}
    </div>
  );
}

function MusicModalInput({ label, value, max, placeholder, onChange }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
        <span>{value.length} / {max}</span>
      </span>
      <input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-9 w-full rounded-md border border-[var(--border)] bg-[#101010] px-3 text-xs font-semibold text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
      />
    </label>
  );
}

function AutoFillDialog({ instrumental, value, model, modelOptions, status, message, onChange, onModelChange, onGenerate, onClose }) {
  const subject = instrumental ? "instrument" : "music";
  return (
    <div className="fixed inset-0 z-[210] grid place-items-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="auto-fill-modal-bg w-[420px] rounded-md border border-white/15 p-4 shadow-2xl shadow-black/70" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Sparkles size={16} className="text-[var(--accent)]" />
            Auto Fill
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
            <X size={14} />
          </button>
        </div>
        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          Jelaskan singkat {subject} yang kamu mau. Bayangkan {subject} kesukaanmu, lalu biarkan AI mengisi title, lyrics, deskripsi, dan opsi yang cocok.
        </p>
        <div className="mt-3">
          <ModernSelect
            label="Model Free"
            value={model}
            options={modelOptions}
            onChange={onModelChange}
            layout="compact"
            buttonClassName="h-9 text-xs font-bold"
            labelClassName="text-[var(--text-muted)] font-bold uppercase tracking-[0.16em]"
            menuClassName="no-scrollbar max-h-64"
          />
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={5}
          placeholder={instrumental ? "Contoh: instrumental cinematic, piano hangat, beat pelan, cocok untuk opening travel..." : "Contoh: lagu pop optimis untuk video motivasi, hook mudah diingat, suara female lembut..."}
          className="no-scrollbar mt-3 w-full resize-none rounded-md border border-[var(--border)] bg-[#0d0d0d] p-3 text-xs leading-5 text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
        />
        {message ? <p className={`mt-3 text-center text-[11px] ${status === "error" ? "text-red-200" : "text-[var(--text-muted)]"}`}>{message}</p> : null}
        <div className="mt-3 grid grid-cols-[1fr_82px] gap-2">
          <button type="button" disabled={status === "loading"} onClick={onGenerate} className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-white px-3 text-[11px] font-bold text-black hover:bg-[#e9e9e9] disabled:cursor-not-allowed disabled:opacity-45">
            <Sparkles size={12} />
            {status === "loading" ? "Mengisi..." : "Isi Otomatis"}
          </button>
          <button type="button" onClick={onClose} className="h-8 rounded-md border border-white/20 bg-black px-3 text-[11px] font-bold text-white hover:bg-[#171717]">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeySettingsPopover({
  activeTab,
  onTabChange,
  value,
  keys,
  message,
  visibleIds,
  onChange,
  onAdd,
  onRefresh,
  onRemove,
  onToggleVisible,
  onOpenApiframe,
  openrouterValue,
  openrouterKeys,
  openrouterMessage,
  openrouterVisibleIds,
  onOpenrouterChange,
  onOpenrouterAdd,
  onOpenrouterRefresh,
  onOpenrouterRemove,
  onOpenrouterToggleVisible,
  onOpenOpenrouter,
  onClose
}) {
  const [pendingDeleteKey, setPendingDeleteKey] = useState(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deleteAccepted, setDeleteAccepted] = useState(false);
  const config = activeTab === "autofill"
    ? {
        title: "AI Auto Fill",
        siteLabel: "openrouter.ai",
        onOpenSite: onOpenOpenrouter,
        value: openrouterValue,
        keys: openrouterKeys,
        message: openrouterMessage,
        visibleIds: openrouterVisibleIds,
        onChange: onOpenrouterChange,
        onAdd: onOpenrouterAdd,
        onRefresh: onOpenrouterRefresh,
        onRemove: onOpenrouterRemove,
        onToggleVisible: onOpenrouterToggleVisible,
        creditLabel: "saldo",
        placeholder: "Tempel OpenRouter API Key di sini"
      }
    : {
        title: "Music AI Creator",
        siteLabel: "apiframe.ai",
        onOpenSite: onOpenApiframe,
        value,
        keys,
        message,
        visibleIds,
        onChange,
        onAdd,
        onRefresh,
        onRemove,
        onToggleVisible,
        creditLabel: "kredit",
        placeholder: "Tempel Apiframe API Key di sini"
      };

  const closeDeleteConfirm = () => {
    setPendingDeleteKey(null);
    setConfirmDeleteText("");
    setDeleteAccepted(false);
  };

  const confirmDelete = () => {
    if (!pendingDeleteKey || !deleteAccepted || confirmDeleteText !== "YES SURE") return;
    config.onRemove(pendingDeleteKey.id);
    closeDeleteConfirm();
  };

  return (
    <div className="absolute left-4 top-[calc(100%+8px)] z-[140] max-h-[calc(100vh-88px)] w-[460px] overflow-hidden rounded-md border border-[var(--border)] bg-[#101010] p-3 normal-case tracking-normal shadow-2xl shadow-black/70">
      <div className="mb-3 flex items-center justify-between pr-9">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <KeyRound size={17} className="text-[var(--accent)]" />
          Setelan API Key
        </div>
        <button type="button" onClick={onClose} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-md border border-red-500/45 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-md border border-[var(--border)] bg-[#0d0d0d] p-1">
        <button type="button" onClick={() => onTabChange("music")} className={`h-8 rounded text-[11px] font-bold ${activeTab === "music" ? "bg-[var(--accent)] text-[#07111f]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white"}`}>
          Music AI Creator
        </button>
        <button type="button" onClick={() => onTabChange("autofill")} className={`h-8 rounded text-[11px] font-bold ${activeTab === "autofill" ? "bg-[var(--accent)] text-[#07111f]" : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white"}`}>
          AI Auto Fill
        </button>
      </div>
      <div className="space-y-1 text-xs leading-4 text-[var(--text-secondary)]">
        <p>
          1. Buka{" "}
          <button type="button" onClick={config.onOpenSite} className="text-[var(--accent)] underline-offset-2 hover:underline">
            {config.siteLabel}
          </button>
          .
        </p>
        <p>2. Login pakai Gmail saja.</p>
        <p>3. Buat API Key dan copy.</p>
        <p>4. Tempel <span className="font-semibold text-white">satu kunci per baris</span> di bawah, lalu <span className="font-semibold text-white">Tambah</span>.</p>
      </div>
      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">Tambah API Key (satu per baris)</span>
        <div className="relative mt-2">
          <textarea
            value={config.value}
            onChange={(event) => config.onChange(event.target.value)}
            rows={3}
            placeholder={config.placeholder}
            className="no-scrollbar w-full resize-none rounded-md border border-[var(--border)] bg-[#0d0d0d] p-3 pb-12 text-xs leading-5 text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
          <div className="absolute bottom-3 right-3 grid w-1/2 grid-cols-[1fr_32px_32px] gap-1.5">
            <button type="button" onClick={config.onAdd} className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-2 text-[10px] font-bold text-[#07111f] hover:bg-[var(--accent-strong)]">
              <Sparkles size={12} />
              Tambah
            </button>
            <button type="button" title="Cek Kredit" onClick={config.onRefresh} className="grid h-8 place-items-center rounded-md border border-[var(--border)] bg-[#151515] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
              <RotateCcw size={13} />
            </button>
            <button type="button" title="Hapus isi input" onClick={() => config.onChange("")} className="grid h-8 place-items-center rounded-md border border-red-500/35 bg-red-500/10 text-red-200 hover:bg-red-500/15">
              <Eraser size={13} />
            </button>
          </div>
        </div>
      </label>
      {config.message ? <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">{config.message}</p> : null}
      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <span>Kunci tersimpan</span>
          <span>
            {config.keys.length} kunci
            {config.keys.some((key) => key.connected && Number.isFinite(key.credit)) ? ` - ${config.creditLabel} ${config.keys.reduce((sum, key) => sum + (Number.isFinite(key.credit) ? key.credit : 0), 0)}` : ""}
          </span>
        </div>
        {config.keys.length ? (
          <div className="space-y-2">
            {config.keys.map((key) => (
              <div key={key.id} className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[#151515] p-3">
                <div className="text-[10px] font-bold text-[var(--clip-text)]">#{key.index}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-white">{config.visibleIds.includes(key.id) ? key.id : key.masked}</div>
                  <div className={`mt-0.5 text-[10px] font-semibold ${key.connected || key.source === "local" ? "text-[var(--clip-audio)]" : "text-red-200"}`}>
                    {key.connected
                      ? `${Number.isFinite(key.credit) ? `${key.credit} ${config.creditLabel}` : "Terhubung"}${key.userEmail ? ` - ${key.userEmail}` : ""}`
                      : key.error || "Belum terhubung"}
                  </div>
                </div>
                <ApiKeyMiniButton icon={Clipboard} onClick={() => navigator.clipboard?.writeText(key.id)} />
                <ApiKeyMiniButton icon={Eye} onClick={() => config.onToggleVisible(key.id)} />
                <ApiKeyMiniButton icon={RotateCcw} onClick={config.onRefresh} />
                <ApiKeyMiniButton icon={Eraser} danger onClick={() => setPendingDeleteKey(key)} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[#151515] p-3 text-center text-xs text-[var(--text-muted)]">
            Belum ada API Key tersimpan.
          </div>
        )}
      </div>
      {pendingDeleteKey ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-black/60 p-4">
          <div className="w-[360px] rounded-md border border-[var(--border)] bg-[#101010] p-4 shadow-2xl shadow-black/70">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Hapus API Key?</p>
                <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{pendingDeleteKey.masked}</p>
              </div>
              <button type="button" onClick={closeDeleteConfirm} className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
                <X size={14} />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
              Pilih Ya lalu ketik <span className="font-bold text-white">YES SURE</span> dengan huruf besar semua untuk mengaktifkan tombol Delete.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={closeDeleteConfirm} className="h-8 rounded-md border border-[var(--border)] bg-[#151515] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
                Tidak
              </button>
              <button type="button" onClick={() => setDeleteAccepted(true)} className={`h-8 rounded-md border text-xs font-bold ${deleteAccepted ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]" : "border-[var(--accent)] bg-[#152235] text-white"}`}>
                Ya
              </button>
            </div>
            <input
              value={confirmDeleteText}
              onChange={(event) => setConfirmDeleteText(event.target.value)}
              disabled={!deleteAccepted}
              placeholder="YES SURE"
              className="mt-3 h-9 w-full rounded-md border border-[var(--border)] bg-[#0d0d0d] px-3 text-xs font-bold text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            />
            <button
              type="button"
              disabled={!deleteAccepted || confirmDeleteText !== "YES SURE"}
              onClick={confirmDelete}
              className="mt-3 h-9 w-full rounded-md border border-red-500/35 bg-red-500/10 text-xs font-bold text-red-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApiKeyMiniButton({ icon: Icon, danger, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-md border ${danger ? "border-red-500/35 bg-red-500/10 text-red-200 hover:bg-red-500/15" : "border-[var(--border)] bg-[#101010] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white"}`}>
      <Icon size={13} />
    </button>
  );
}

function MusicModalTextArea({ label, value, max, rows, placeholder, info, onChange, onCopy, onDelete }) {
  const [tooltipRect, setTooltipRect] = useState(null);
  const showTooltip = (target) => {
    const rect = target.getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - 340);
    const top = Math.min(rect.bottom + 6, window.innerHeight - 210);
    setTooltipRect({ left: Math.max(8, left), top: Math.max(8, top) });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {label}
          {info ? (
            <span className="relative" onMouseLeave={() => setTooltipRect(null)}>
              <button
                type="button"
                onMouseEnter={(event) => showTooltip(event.currentTarget)}
                onFocus={(event) => showTooltip(event.currentTarget)}
                onBlur={() => setTooltipRect(null)}
                className="grid h-5 w-5 place-items-center rounded-full border border-[var(--border)] bg-[#151515] text-[var(--accent)] hover:bg-[var(--bg-hover)]"
                aria-label="Penjelasan struktur lirik"
              >
                <Info size={11} />
              </button>
              {tooltipRect ? (
                <div
                  className="scrollbar-dark fixed z-[9999] max-h-44 w-[320px] overflow-y-auto rounded-md border border-[var(--border)] bg-[#101010] p-3 normal-case tracking-normal shadow-2xl shadow-black/80"
                  style={{ left: tooltipRect.left, top: tooltipRect.top }}
                >
                  {info}
                </div>
              ) : null}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-[10px] font-bold tracking-[0.12em] text-[var(--text-muted)]">{value.length} / {max}</span>
          <button type="button" onClick={onCopy} className="h-6 rounded border border-[var(--border)] bg-[#151515] px-2 text-[9px] font-bold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white">Copy</button>
          {value.trim() ? (
            <button type="button" onClick={onDelete} className="h-6 rounded border border-[#67213a] bg-[#240b18] px-2 text-[9px] font-bold text-[#ff9aac] hover:border-[#d04d75]">Delete</button>
          ) : null}
        </div>
      </div>
      <textarea
        value={value}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="no-scrollbar mt-1.5 w-full resize-none rounded-md border border-[var(--border)] bg-[#101010] p-3 text-xs font-semibold leading-5 text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
      />
    </div>
  );
}

function MusicModalSelect({ label, value, options, onChange }) {
  return (
    <ModernSelect
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      layout="compact"
      buttonClassName="h-9 text-xs font-bold"
      labelClassName="text-[var(--text-muted)] font-bold uppercase tracking-[0.16em]"
      menuClassName="no-scrollbar"
    />
  );
}

function LyricsStructureHelp() {
  return (
    <div className="space-y-2 text-[11px] leading-4 text-[var(--text-secondary)]">
      <p className="font-semibold text-white">Panduan struktur lirik</p>
      <p><span className="font-bold text-[var(--accent)]">Intro</span> adalah pembuka suasana. Biasanya pendek, bisa berupa satu kalimat atau vokal ringan.</p>
      <p><span className="font-bold text-[var(--clip-audio)]">Verse</span> adalah bagian cerita. Di sini kamu mengenalkan situasi, tokoh, atau pesan utama.</p>
      <p><span className="font-bold text-[var(--clip-text)]">Pre-Chorus</span> adalah jembatan menuju reff. Gunakan untuk menaikkan emosi atau tensi.</p>
      <p><span className="font-bold text-[var(--danger)]">Chorus</span> adalah hook utama. Buat paling mudah diingat dan cocok untuk diulang.</p>
      <p><span className="font-bold text-[#c084fc]">Bridge</span> memberi variasi di tengah lagu agar tidak monoton.</p>
      <p><span className="font-bold text-[#93c5fd]">Outro</span> adalah penutup. Bisa mengulang hook atau memberi kalimat akhir yang kuat.</p>
    </div>
  );
}

function MusicLibraryRow({ item, active, selected, liked, playing, onSelect, onPlay, onDownload, onRerun, onLike, onAdd, onToggle }) {
  return (
    <div className={`rounded-md border p-3 ${active ? "border-[var(--accent)] bg-[#152235]" : "border-[var(--border)] bg-[#151515]"}`} onClick={onSelect}>
      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-md bg-[#101010]">
          {item.metadata?.imageUrl ? <img src={item.metadata.imageUrl} alt="" className="h-full w-full object-cover" /> : <Music size={18} className="text-[var(--accent)]" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white">{item.metadata?.title || item.name}</div>
          <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{formatTime(item.duration)} - {item.metadata?.model || "music"}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded bg-[#063f24] px-1.5 py-0.5 text-[9px] font-bold text-[#70ff99]">SUCCESS</span>
            <span className="rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent)]">{item.metadata?.model || "AI"}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <MusicMiniButton icon={playing ? Pause : Play} label={playing ? "Pause" : "Putar"} onClick={onPlay} />
        <MusicMiniButton icon={Download} label="Unduh" onClick={onDownload} />
        <MusicMiniButton icon={RotateCcw} label="Ulang" onClick={onRerun} />
        <MusicMiniButton icon={Heart} label={liked ? "Disukai" : "Suka"} active={liked} onClick={onLike} />
        <MusicMiniButton label={selected ? "Dipilih" : "Pilih"} onClick={onToggle} />
        <MusicMiniButton label="Tambah" accent onClick={onAdd} />
      </div>
    </div>
  );
}

function MusicMiniButton({ icon: Icon, label, active, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold ${
        accent
          ? "border-[var(--accent)] bg-[var(--accent)] text-[#07111f]"
          : active
            ? "border-[var(--accent)] bg-[#152235] text-[var(--accent)]"
            : "border-[var(--border)] bg-[#101010] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white"
      }`}
    >
      {Icon ? <Icon size={12} /> : null}
      {label}
    </button>
  );
}

function MusicDetailPanel({ item, liked, playing, onPlay, onDownload, onRerun, onLike, onAdd }) {
  return (
    <div className="space-y-4">
      <div className="relative grid aspect-video place-items-center overflow-hidden rounded-md bg-[#101010]">
        {item.metadata?.imageUrl ? <img src={item.metadata.imageUrl} alt="" className="h-full w-full object-cover" /> : <Music size={42} className="text-[var(--accent)]" />}
        <button type="button" onClick={onPlay} className="absolute grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-[#07111f] shadow-lg shadow-black/40">
          {playing ? <Pause size={26} /> : <Play size={26} />}
        </button>
      </div>
      <div>
        <h3 className="truncate text-lg font-bold text-white">{item.metadata?.title || item.name}</h3>
        <div className="mt-2 flex gap-1">
          <span className="rounded bg-[#063f24] px-2 py-1 text-[10px] font-bold text-[#70ff99]">SUCCESS</span>
          <span className="rounded bg-[var(--accent)]/15 px-2 py-1 text-[10px] font-bold text-[var(--accent)]">{item.metadata?.model || "AI"}</span>
        </div>
      </div>
      <MusicDetailText title="Style" value={item.metadata?.tags || item.metadata?.prompt || "-"} />
      <MusicDetailText title="Lirik" value={item.metadata?.prompt || "-"} />
      <div className="grid grid-cols-3 gap-2">
        <MusicIconButton icon={Heart} active={liked} onClick={onLike} />
        <MusicIconButton icon={Download} onClick={onDownload} />
        <MusicIconButton icon={RotateCcw} onClick={onRerun} />
      </div>
      <button type="button" onClick={onAdd} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-xs font-bold text-[#07111f]">
        <Upload size={13} />
        Tambah ke Timeline
      </button>
    </div>
  );
}

function MusicDetailText({ title, value }) {
  const copyValue = () => navigator.clipboard?.writeText(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {title}
        <button type="button" onClick={copyValue} className="rounded border border-[var(--border)] bg-[#151515] px-2 py-1 text-[9px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white">Copy</button>
      </div>
      <div className="no-scrollbar max-h-36 overflow-y-auto rounded-md border border-[var(--border)] bg-[#101010] p-3 text-xs leading-5 text-[var(--text-secondary)]">{value}</div>
    </div>
  );
}

function MusicIconButton({ icon: Icon, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`grid h-9 place-items-center rounded-md border ${active ? "border-[var(--accent)] bg-[#152235] text-[var(--accent)]" : "border-[var(--border)] bg-[#101010] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white"}`}>
      <Icon size={15} />
    </button>
  );
}

function buildApiframeMusicPayload({ model, prompt, title, style, customMode, instrumental, vocalGender }) {
  const cleanTitle = title.trim();
  const cleanStyle = style.trim();
  const apiConfig = musicModelApiMap[model] ?? { model };
  const payload = { model: apiConfig.model, prompt: prompt.trim() };
  if (apiConfig.model === "suno") {
    payload.sunoParams = {
      custom_mode: Boolean(customMode),
      instrumental: Boolean(instrumental),
      model_version: apiConfig.sunoVersion || "V4_5PLUS"
    };
    if (cleanTitle) payload.sunoParams.title = cleanTitle.slice(0, 80);
    if (cleanStyle) payload.sunoParams.style = cleanStyle;
    if (vocalGender) payload.sunoParams.vocal_gender = vocalGender;
  } else if (apiConfig.model === "udio") {
    payload.udioParams = { lyrics_type: instrumental ? "instrumental" : customMode ? "user" : "generate" };
    if (cleanTitle) payload.udioParams.title = cleanTitle.slice(0, 80);
    if (cleanStyle) payload.udioParams.style = cleanStyle;
  } else if (apiConfig.model === "mureka") {
    payload.murekaParams = { instrumental: Boolean(instrumental), n: 2 };
    if (customMode) payload.murekaParams.lyrics = prompt.trim();
  } else if (apiConfig.model === "elevenlabs-music") {
    payload.elevenlabsParams = { force_instrumental: Boolean(instrumental), output_format: "mp3_high_quality" };
  }
  return payload;
}

async function apiframeBrowserRequest(pathname, apiKey, options = {}) {
  if (!apiKey) return { ok: false, error: "Tambahkan Apiframe API Key di tab Music AI Creator dulu." };
  const response = await fetch(`/apiframe-proxy/v2${pathname}`, {
    ...options,
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) return { ok: false, status: response.status, error: data?.error || text || `Apiframe gagal (${response.status}).` };
  return { ok: true, data };
}

function generateLocalApiframeMusic(payload, apiKey) {
  return apiframeBrowserRequest("/music/generate", apiKey, { method: "POST", body: JSON.stringify(payload) });
}

function getLocalApiframeJob(jobId, apiKey) {
  return apiframeBrowserRequest(`/jobs/${encodeURIComponent(jobId)}`, apiKey, { method: "GET" });
}

async function pollApiframeMusicJob(jobId, onProgress, getJob) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await wait(attempt === 0 ? 1200 : 5000);
    const result = getJob ? await getJob(jobId) : await window.videmeNative.apiframe.getJob(jobId);
    if (!result?.ok) throw new Error(result?.error || "Gagal mengecek status music.");
    const job = result.data;
    onProgress?.(job);
    if (job.status === "COMPLETED") return job;
    if (job.status === "FAILED") throw new Error(job.error || "Generate music gagal di Apiframe.");
  }
  throw new Error("Generate music belum selesai setelah beberapa menit.");
}

async function addMusicTrackToLibrary(track, request, stores) {
  const audioUrl = track.audioUrl;
  if (!audioUrl) return;
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Gagal mengunduh track music (${response.status}).`);
  const blob = await response.blob();
  const name = `${track.title || request.title || "Apiframe Music"}-${track.id || Date.now()}.mp3`.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
  const file = new File([blob], name, { type: blob.type || "audio/mpeg" });
  const draft = stores.createMediaDraft(file, {
    name,
    thumbnailUrl: track.imageUrl || "",
    duration: track.duration || 5,
    metadata: {
      ffprobe: null,
      source: "music",
      provider: "apiframe",
      model: request.model,
      prompt: request.prompt,
      style: request.style,
      title: track.title || request.title || "",
      tags: track.tags || "",
      audioUrl,
      imageUrl: track.imageUrl || null
    }
  });
  const metadata = await readMediaMetadata(file, draft.url);
  const waveformData = await generateWaveform(file);
  const item = { ...draft, ...metadata, duration: track.duration || metadata.duration || draft.duration, waveformData };
  stores.addMediaItem(item);
  return item;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function LyricsPanel() {
  const addCaptionClips = useProjectStore((state) => state.addCaptionClips);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const [trackId, setTrackId] = useState("4snRyiaLyvTMuiOhzp8MF7");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [lyrics, setLyrics] = useState([]);

  const fetchLyrics = async () => {
    const id = trackId.trim();
    if (!id) {
      setMessage("Track ID masih kosong.");
      return;
    }
    if (!window.videmeNative?.spotify?.lyrics) {
      setMessage("Lyrics API tersedia di desktop app agar API key tidak diekspos ke UI/frontend.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const result = await window.videmeNative.spotify.lyrics({ id });
      if (!result?.ok) throw new Error(result?.error || "Gagal mengambil lirik.");
      const lines = normalizeSpotifyLyrics(result.data);
      setLyrics(lines);
      setMessage(lines.length ? `${lines.length} baris lirik dimuat.` : "Lirik kosong untuk track ini.");
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Gagal mengambil lirik.");
    }
  };

  const copyLyrics = () => {
    navigator.clipboard?.writeText(lyrics.map((line) => line.text).join("\n")).then(
      () => setMessage("Lirik disalin."),
      () => setMessage("Gagal menyalin lirik.")
    );
  };

  const addLyricsAsCaptions = () => {
    const timed = lyrics.filter((line) => Number.isFinite(line.start));
    if (!timed.length) {
      setMessage("Response lirik tidak punya timestamp yang bisa dijadikan caption.");
      return;
    }
    const clips = timed.map((line, index) => {
      const next = timed[index + 1];
      const start = currentTime + line.start;
      const end = currentTime + (Number.isFinite(line.end) ? line.end : next?.start ?? line.start + 3);
      return {
        id: crypto.randomUUID(),
        type: "text",
        name: "Lyric",
        text: line.text,
        start,
        end: Math.max(start + 0.4, end),
        inPoint: 0,
        outPoint: Math.max(0.4, end - start),
        mediaDuration: Math.max(0.4, end - start),
        caption: true,
        captionStyle: "karaoke",
        color: "#ffffff",
        timelineColor: "var(--clip-text)",
        fontFamily: "Arial",
        fontSize: 44,
        fontWeight: "bold",
        backgroundColor: "transparent",
        padding: 8,
        align: "center",
        posX: 0.5,
        posY: 0.84,
        animation: "fadeIn",
        animDuration: 0.25
      };
    });
    addCaptionClips(clips);
    setMessage(`${clips.length} lyric caption ditambahkan ke timeline.`);
  };

  return (
    <div className="space-y-3">
      <form
        className="rounded-md border border-[var(--border)] bg-[#141414] p-3"
        onSubmit={(event) => {
          event.preventDefault();
          fetchLyrics();
        }}
      >
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Spotify Track ID
        </label>
        <div className="mt-2 flex gap-2">
          <input
            value={trackId}
            onChange={(event) => setTrackId(event.target.value)}
            placeholder="4snRyiaLyvTMuiOhzp8MF7"
            className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[#101010] px-3 text-xs text-white outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="h-9 rounded-md bg-[var(--accent)] px-3 text-xs font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          >
            {status === "loading" ? "Loading" : "Fetch"}
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
          Endpoint: {SPOTIFY_RAPIDAPI_HOST}/track_lyrics
        </p>
      </form>

      {message ? (
        <div className={`rounded-md border px-3 py-2 text-xs ${status === "error" ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-[var(--border)] bg-[#151515] text-[var(--text-secondary)]"}`}>
          {message}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="button" disabled={!lyrics.length} onClick={copyLyrics} className="flex h-8 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)] disabled:opacity-40">
          <Clipboard size={13} />
          Copy
        </button>
        <button type="button" disabled={!lyrics.length} onClick={addLyricsAsCaptions} className="flex h-8 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)] disabled:opacity-40">
          <Captions size={13} />
          Caption
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto rounded-md border border-[var(--border)] bg-[#101010] p-2 scrollbar-dark">
        {lyrics.length ? (
          <div className="space-y-1">
            {lyrics.map((line, index) => (
              <div key={`${line.start ?? index}-${line.text}`} className="rounded border border-[var(--border-soft)] bg-[#151515] px-2 py-1.5">
                <div className="text-[10px] text-[var(--text-muted)]">{formatLyricTime(line.start)}</div>
                <div className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{line.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <AudioEmptyState title="Lyrics kosong" desc="Masukkan Spotify Track ID, lalu fetch lirik dari RapidAPI." />
        )}
      </div>
    </div>
  );
}

function normalizeSpotifyLyrics(data) {
  const rawLines = data?.lyrics?.lines ?? data?.lines ?? data?.data?.lyrics?.lines ?? [];
  if (Array.isArray(rawLines) && rawLines.length) {
    return rawLines
      .map((line) => ({
        text: String(line.words ?? line.text ?? line.lyric ?? "").trim(),
        start: msToSeconds(line.startTimeMs ?? line.start_ms ?? line.start),
        end: msToSeconds(line.endTimeMs ?? line.end_ms ?? line.end)
      }))
      .filter((line) => line.text);
  }
  const plainText = data?.lyrics ?? data?.text ?? data?.body?.lyrics ?? "";
  return String(plainText)
    .split(/\r?\n/)
    .map((text) => ({ text: text.trim(), start: null, end: null }))
    .filter((line) => line.text);
}

function msToSeconds(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 1000 ? numeric / 1000 : numeric;
}

function formatLyricTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  return formatTime(seconds);
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

function GeneratedAudioHistoryPopover({ title, source, items, selectedItems, onToggle, onPreview, onAdd }) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[#101010] shadow-xl shadow-black/50">
      <div className="flex h-11 shrink-0 items-center border-b border-white/10 px-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-white">{title}</div>
          <div className="truncate text-[10px] text-[var(--text-muted)]">Hasil generate dari {source}</div>
        </div>
      </div>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        <AudioSourceList source={source} items={items} selectedItems={selectedItems} onToggle={onToggle} onPreview={onPreview} onAdd={onAdd} />
      </div>
    </div>
  );
}

function AudioSourceList({ source, items, selectedItems, onToggle, onPreview, onAdd }) {
  const audioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const toggleAudioPreview = async (item) => {
    if (playingId === item.id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(item.url);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => setPlayingId(null);
    onPreview(item.id);
    try {
      await audio.play();
      setPlayingId(item.id);
    } catch {
      setPlayingId(null);
    }
  };

  const downloadAudio = (item) => {
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.file?.name || `${item.name || "voxcpm-audio"}.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const beginAudioDrag = (event, item) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("mediaId", item.id);
    const ghost = document.createElement("div");
    ghost.textContent = item.name;
    ghost.style.cssText =
      "position:fixed;top:-1000px;left:-1000px;width:180px;height:44px;padding:10px;border-radius:6px;background:#151515;color:white;font:12px Arial;border:1px solid #3ddc84;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;";
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 20, 20);
    window.setTimeout(() => ghost.remove(), 0);
  };

  const activateAction = (event, action) => {
    event.stopPropagation();
    action();
  };

  const activateActionFromKey = (event, action) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    action();
  };

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
        <div
          key={item.id}
          role="button"
          tabIndex={0}
          draggable
          onClick={() => onPreview(item.id)}
          onDragStart={(event) => beginAudioDrag(event, item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onPreview(item.id);
            }
          }}
          className={`group grid w-full grid-cols-[40px_minmax(0,1fr)_auto_auto_auto] items-center gap-2 rounded-md border bg-[#151515] p-2 text-left hover:bg-[var(--bg-hover)] ${
            selectedItems.includes(item.id) ? "border-[var(--accent)]" : "border-[var(--border)]"
          }`}
        >
          <span
            role="button"
            tabIndex={0}
            title={playingId === item.id ? "Pause preview" : "Play preview"}
            onClick={(event) => activateAction(event, () => toggleAudioPreview(item))}
            onKeyDown={(event) => activateActionFromKey(event, () => toggleAudioPreview(item))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--clip-audio)]/12 text-[var(--clip-audio)] hover:bg-[var(--clip-audio)]/20"
          >
            {playingId === item.id ? <Pause size={17} /> : <Play size={17} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs text-white">{item.name}</span>
            <span className="mt-0.5 block text-[10px] text-[var(--text-muted)]">
              {formatTime(item.duration)} - {formatAudioSource(item)}
            </span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => activateAction(event, () => onToggle(item.id))}
            onKeyDown={(event) => activateActionFromKey(event, () => onToggle(item.id))}
            className="h-7 whitespace-nowrap rounded border border-[var(--border)] px-2 text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white"
          >
            {selectedItems.includes(item.id) ? "Dipilih" : "Pilih"}
          </span>
          <span
            role="button"
            tabIndex={0}
            title="Unduh audio"
            onClick={(event) => activateAction(event, () => downloadAudio(item))}
            onKeyDown={(event) => activateActionFromKey(event, () => downloadAudio(item))}
            className="grid h-7 w-7 place-items-center rounded border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-white"
          >
            <Download size={13} />
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => activateAction(event, () => onAdd(item))}
            onKeyDown={(event) => activateActionFromKey(event, () => onAdd(item))}
            className="h-7 whitespace-nowrap rounded bg-[var(--accent)] px-2 text-[10px] font-semibold text-[#07111f] hover:bg-[var(--accent-strong)]"
          >
            Tambah
          </span>
        </div>
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
  if (item.metadata?.source === "voice-design") return "voice design";
  if (item.metadata?.source === "voice-clone") return "voice clone";
  if (item.metadata?.source === "music") return item.metadata?.model ? `music ${item.metadata.model}` : "music";
  if (item.metadata?.source) return item.metadata.source;
  return item.file?.type || "uploaded";
}

function isVoiceAudio(item) {
  return item.metadata?.source === "voice-clone" || item.metadata?.source === "voice-design" || (item.metadata?.source === "ai" && item.metadata?.voxMode === "design");
}

function isGeneratedAudioSource(item) {
  return isVoiceAudio(item) || item.metadata?.source === "music";
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
