import React, { useState } from "react";
import { Archive, AudioLines, Camera, Download, Layers, Music, Plus, RefreshCw, ScanSearch, SlidersHorizontal } from "lucide-react";
import { makeProxy } from "../../utils/cacheService.js";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { formatTime } from "../../utils/timeFormat.js";
import { defaultAutoReframe, defaultBgRemove, defaultFaceBlur } from "../../utils/aiEffects.js";
import { reduceNoiseFile } from "../../utils/noiseReduction.js";
import { downloadTextFile, exportSRT, exportVTT } from "../../utils/subtitleExport.js";
import { defaultEffects, defaultFilters, defaultTransform, filterPresets, mergePreset } from "../../utils/visualEffects.js";
import { MediaMetadataTabs } from "../ui/MediaMetadataTabs.jsx";
import { CommandPalettePanel } from "../ui/CommandPalettePanel.jsx";
import { AdvancedFFmpegPanel } from "../ui/AdvancedFFmpegPanel.jsx";

const speedOptions = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const transitions = ["none", "crossDissolve", "fadeToBlack", "slideLeft", "wipeLeft"];
const animations = ["none", "fadeIn", "slideUp", "slideDown", "typewriter", "bounce", "zoomIn"];

function buildTabs(clipType, media) {
  const tabs = ["Info"];
  if (clipType === "video" || clipType === "image") tabs.push("Video", "Filter");
  if (clipType === "audio") tabs.push("Audio FX");
  if ((clipType === "video" || clipType === "audio") && media) tabs.push("Commands");
  if (clipType === "video" || clipType === "audio") tabs.push("Export");
  if (clipType === "text") tabs.push("Teks");
  if (clipType === "sticker") tabs.push("Sticker");
  tabs.push("Advanced");
  return tabs;
}

export function RightPanel() {
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const tracks = useProjectStore((state) => state.tracks);
  const updateClip = useProjectStore((state) => state.updateClip);
  const addTextClip = useProjectStore((state) => state.addTextClip);
  const openStabilize = useUiStore((state) => state.openStabilize);
  const toggleCropMode = useUiStore((state) => state.toggleCropMode);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const mediaItems = useMediaStore((state) => state.items);
  const previewMedia = useMediaStore((state) => state.items.find((item) => item.id === state.previewMediaId) ?? null);
  const updateMediaItem = useMediaStore((state) => state.updateMediaItem);
  const clip = tracks.flatMap((track) => track.clips.map((item) => ({ ...item, trackType: track.type }))).find((item) => item.id === selectedClipId);
  const media = mediaItems.find((item) => item.id === clip?.mediaId);
  const clipType = clip?.type === "text" ? "text" : media?.type ?? clip?.trackType;

  const tabs = clip ? buildTabs(clipType, media) : [];
  const [activeTab, setActiveTab] = useState("Info");
  const safeTab = tabs.includes(activeTab) ? activeTab : (tabs[0] || "Info");

  return (
    <aside className="flex min-h-0 flex-col bg-[var(--bg-panel)]">
      <div className="flex h-11 items-center justify-between border-b border-[var(--border)] px-4 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={17} />
          Properti
        </span>
        <button
          type="button"
          onClick={() => addTextClip(currentTime)}
          className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]"
          title="Tambah teks"
        >
          <Plus size={16} />
        </button>
      </div>

      {clip && tabs.length > 1 && (
        <div className="flex gap-0.5 overflow-x-auto border-b border-[var(--border)] px-2 py-1.5 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition ${safeTab === tab ? "bg-[var(--accent)] text-[#07111f]" : "text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-hover)]"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <div className="scrollbar-dark flex-1 overflow-auto p-4 text-sm text-[var(--text-secondary)]">
        {previewMedia && !clip ? (
          <div className="space-y-5">
            <MediaMetadataTabs media={previewMedia} />
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Tambahkan file ke timeline untuk membuka kontrol editing lengkap.
            </p>
          </div>
        ) : !clip ? (
          <EmptyInspector />
        ) : (
          <TabContent
            tab={safeTab}
            clip={clip}
            clipType={clipType}
            media={media}
            tracks={tracks}
            updateClip={updateClip}
            updateMediaItem={updateMediaItem}
            openStabilize={openStabilize}
            toggleCropMode={toggleCropMode}
            currentTime={currentTime}
          />
        )}
      </div>
    </aside>
  );
}

function TabContent({ tab, clip, clipType, media, tracks, updateClip, updateMediaItem, openStabilize, toggleCropMode }) {
  switch (tab) {
    case "Info":
      return (
        <div className="space-y-5">
          {media ? (
            <MediaMetadataTabs media={media} />
          ) : (
            <div className="rounded-md border border-[var(--border)] bg-[var(--bg-panel-soft)] p-3">
              <div className="truncate text-white">{clip.text ?? clip.name ?? "Clip"}</div>
              <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">{clip.id}</div>
            </div>
          )}
          {media && <QuickCommandSection clipType={clipType} media={media} clip={clip} updateClip={updateClip} updateMediaItem={updateMediaItem} />}
        </div>
      );

    case "Video":
      return (
        <div className="space-y-5">
          {clipType === "video" && clip.hasAudio !== false && <MiniAudioControls clip={clip} updateClip={updateClip} />}
          {clipType === "video" && <TransitionControls clip={clip} updateClip={updateClip} />}
          {clipType === "video" && <SpeedControls clip={clip} updateClip={updateClip} />}
          {clipType === "video" && <TransformControls clip={clip} updateClip={updateClip} toggleCropMode={toggleCropMode} />}
          {clipType === "video" && <EffectsControls clip={clip} updateClip={updateClip} openStabilize={openStabilize} />}
        </div>
      );

    case "Filter":
      return (
        <div className="space-y-5">
          <VisualAdjustments clip={clip} updateClip={updateClip} />
          {clipType === "video" && <AiVisualControls clip={clip} updateClip={updateClip} />}
          {clipType === "video" && <FilterControls clip={clip} updateClip={updateClip} />}
        </div>
      );

    case "Audio FX":
      return (
        <div className="space-y-5">
          <AudioControls clip={clip} updateClip={updateClip} />
          <AudioAiControls clip={clip} media={media} updateClip={updateClip} updateMediaItem={updateMediaItem} />
          <AudioFxControls clip={clip} updateClip={updateClip} />
        </div>
      );

    case "Commands":
      return (
        <CommandPalettePanel
          mediaType={clipType}
          onRunCommand={(cmd) => console.log("Run command:", cmd.id, "on clip:", clip.id)}
        />
      );

    case "Export":
      return (
        <div className="space-y-4">
          <ExportQuickControls clip={clip} media={media} />
        </div>
      );

    case "Teks":
      return (
        <div className="space-y-5">
          <TextControls clip={clip} updateClip={updateClip} />
          {clip.caption && <CaptionEditor clip={clip} tracks={tracks} updateClip={updateClip} />}
        </div>
      );

    case "Sticker":
      return <StickerControls clip={clip} updateClip={updateClip} />;

    case "Advanced":
      return <AdvancedFFmpegPanel clip={clip} media={media} onRunCommand={(cmd) => console.log("Advanced run:", cmd)} />;

    default:
      return null;
  }
}

function VisualAdjustments({ clip, updateClip }) {
  const filters = { ...defaultFilters, ...(clip.filters ?? {}) };
  const effects = { blur: 0, ...(clip.effects ?? {}) };
  const set = (patch) => updateClip(clip.id, { filters: { ...filters, ...patch } });
  const setFx = (patch) => updateClip(clip.id, { effects: { ...effects, ...patch } });
  return (
    <Panel title="Visual Adjustments">
      <Range label={`Brightness ${filters.brightness}`} min="-100" max="100" step="1" value={filters.brightness} onChange={(v) => set({ brightness: v })} />
      <Range label={`Contrast ${filters.contrast}`} min="-100" max="100" step="1" value={filters.contrast} onChange={(v) => set({ contrast: v })} />
      <Range label={`Saturation ${filters.saturation}`} min="-100" max="100" step="1" value={filters.saturation} onChange={(v) => set({ saturation: v })} />
      <Range label={`Hue ${filters.hue}deg`} min="-180" max="180" step="1" value={filters.hue} onChange={(v) => set({ hue: v })} />
      <Range label={`Exposure ${filters.exposure} EV`} min="-5" max="5" step="0.1" value={filters.exposure} onChange={(v) => set({ exposure: v })} />
      <Range label={`Gamma ${filters.gamma ?? 1}`} min="0.1" max="4" step="0.05" value={filters.gamma ?? 1} onChange={(v) => set({ gamma: v })} />
      <Range label={`Temperature ${filters.temperature}`} min="-100" max="100" step="1" value={filters.temperature} onChange={(v) => set({ temperature: v })} />
      <Range label={`Tint ${filters.tint}`} min="-100" max="100" step="1" value={filters.tint} onChange={(v) => set({ tint: v })} />
      <Range label={`Sharpness ${filters.sharpness}`} min="-100" max="100" step="1" value={filters.sharpness} onChange={(v) => set({ sharpness: v })} />
      <Range label={`Blur ${effects.blur}px`} min="0" max="20" step="0.5" value={effects.blur ?? 0} onChange={(v) => setFx({ blur: v })} />
      <Range label={`Vignette ${filters.vignette}%`} min="0" max="100" step="1" value={filters.vignette} onChange={(v) => set({ vignette: v })} />
      <label className="grid grid-cols-[80px_1fr] items-center gap-3 text-xs">
        <span className="text-[var(--text-muted)]">LUT</span>
        <select
          value={filters.lut ?? ""}
          onChange={(e) => set({ lut: e.target.value || null })}
          className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white"
        >
          <option value="">Tidak ada</option>
          <option value="cinematic">Cinematic</option>
          <option value="warm">Warm</option>
          <option value="cool">Cool</option>
          <option value="vintage">Vintage</option>
          <option value="bw">B&W</option>
        </select>
      </label>
      <button type="button" onClick={() => updateClip(clip.id, { filters: structuredClone(defaultFilters), effects: { blur: 0 } })} className="h-8 w-full rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)]">
        Reset Semua
      </button>
    </Panel>
  );
}

function QuickCommandSection({ clipType, media, clip, updateClip, updateMediaItem }) {
  const [loading, setLoading] = useState(null);
  const run = async (id, fn) => {
    setLoading(id);
    try { await fn(); } catch { /* ignore */ } finally { setLoading(null); }
  };
  const btns = [
    { id: "convert", icon: <RefreshCw size={12} />, label: "Convert", show: true, fn: () => console.log("open ConvertModal") },
    { id: "compress", icon: <Archive size={12} />, label: "Compress", show: clipType === "video", fn: () => console.log("compress") },
    { id: "extract", icon: <Music size={12} />, label: "Extract Audio", show: clipType === "video", fn: () => console.log("extract audio") },
    { id: "snapshot", icon: <Camera size={12} />, label: "Snapshot", show: clipType === "video" || clipType === "image", fn: () => {
      const canvas = document.querySelector("canvas");
      if (canvas) canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "snapshot.jpg"; a.click(); URL.revokeObjectURL(url);
      }, "image/jpeg", 0.95);
    }},
    { id: "proxy", icon: <Layers size={12} />, label: "Proxy", show: clipType === "video", fn: async () => {
      if (!media) return;
      const inputPath = media.file?.path || media.filePath;
      if (!inputPath) return;
      const result = await makeProxy(inputPath, 540, `proxy-${clip.id}`);
      if (result?.ok && result.outputPath) {
        updateMediaItem(media.id, { proxy: { path: result.outputPath, url: `file://${result.outputPath.replace(/\\/g, "/")}` } });
      }
    }},
    { id: "analyze", icon: <ScanSearch size={12} />, label: "Analyze", show: true, fn: () => console.log("analyze") }
  ].filter((b) => b.show);
  return (
    <Panel title="Command Cepat">
      <div className="grid grid-cols-3 gap-1.5">
        {btns.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => run(btn.id, btn.fn)}
            disabled={loading === btn.id}
            title={btn.label}
            className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white disabled:opacity-40"
          >
            {loading === btn.id ? <span className="h-3 w-3 animate-spin rounded-full border border-[var(--accent)] border-t-transparent" /> : btn.icon}
            {btn.label}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function AudioFxControls({ clip, updateClip }) {
  const audioFx = { volume: 1, gain: 0, pitch: 0, tempo: 1, reverb: 0, echo: 0, compressor: 0, limiter: 0, eqBass: 0, eqMid: 0, eqTreble: 0, loudnorm: false, ...(clip.audioFx ?? {}) };
  const set = (patch) => updateClip(clip.id, { audioFx: { ...audioFx, ...patch } });
  return (
    <Panel title="Audio FX">
      <Range label={`Volume ${Math.round(audioFx.volume * 100)}%`} min="0" max="2" step="0.05" value={audioFx.volume} onChange={(v) => set({ volume: v })} />
      <Range label={`Gain ${audioFx.gain} dB`} min="-20" max="20" step="0.5" value={audioFx.gain} onChange={(v) => set({ gain: v })} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={Boolean(audioFx.loudnorm)} onChange={(e) => set({ loudnorm: e.target.checked })} />
        Normalize (loudnorm -23 LUFS)
      </label>
      <Range label={`Compressor ${Math.round(audioFx.compressor * 100)}%`} min="0" max="1" step="0.05" value={audioFx.compressor} onChange={(v) => set({ compressor: v })} />
      <Range label={`Limiter ${Math.round(audioFx.limiter * 100)}%`} min="0" max="1" step="0.05" value={audioFx.limiter} onChange={(v) => set({ limiter: v })} />
      <Range label={`EQ Bass ${audioFx.eqBass} dB`} min="-12" max="12" step="0.5" value={audioFx.eqBass} onChange={(v) => set({ eqBass: v })} />
      <Range label={`EQ Mid ${audioFx.eqMid} dB`} min="-12" max="12" step="0.5" value={audioFx.eqMid} onChange={(v) => set({ eqMid: v })} />
      <Range label={`EQ Treble ${audioFx.eqTreble} dB`} min="-12" max="12" step="0.5" value={audioFx.eqTreble} onChange={(v) => set({ eqTreble: v })} />
      <Range label={`Pitch ${audioFx.pitch} semitone`} min="-12" max="12" step="1" value={audioFx.pitch} onChange={(v) => set({ pitch: v })} />
      <Range label={`Tempo ${audioFx.tempo}x`} min="0.5" max="2" step="0.05" value={audioFx.tempo} onChange={(v) => set({ tempo: v })} />
      <Range label={`Reverb ${Math.round(audioFx.reverb * 100)}%`} min="0" max="1" step="0.05" value={audioFx.reverb} onChange={(v) => set({ reverb: v })} />
      <Range label={`Echo ${Math.round(audioFx.echo * 100)}%`} min="0" max="1" step="0.05" value={audioFx.echo} onChange={(v) => set({ echo: v })} />
      <Range label={`Fade In ${clip.fadeIn ?? 0}s`} min="0" max="5" step="0.1" value={clip.fadeIn ?? 0} onChange={(v) => updateClip(clip.id, { fadeIn: v })} />
      <Range label={`Fade Out ${clip.fadeOut ?? 0}s`} min="0" max="5" step="0.1" value={clip.fadeOut ?? 0} onChange={(v) => updateClip(clip.id, { fadeOut: v })} />
      <button type="button" onClick={() => updateClip(clip.id, { audioFx: {} })} className="h-8 w-full rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)]">Reset FX</button>
    </Panel>
  );
}

function MiniAudioControls({ clip, updateClip }) {
  return (
    <Panel title="Audio Stream">
      <Range label={`Volume ${Math.round((clip.volume ?? 1) * 100)}%`} min="0" max="2" step="0.05" value={clip.volume ?? 1} onChange={(v) => updateClip(clip.id, { volume: v })} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={Boolean(clip.muted)} onChange={(e) => updateClip(clip.id, { muted: e.target.checked })} />
        Mute audio stream
      </label>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => console.log("extract audio from video")} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] hover:bg-[var(--bg-hover)]">
          <Music size={12} /> Extract
        </button>
        <button type="button" onClick={() => updateClip(clip.id, { hasAudio: false })} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] hover:bg-[var(--bg-hover)]">
          <AudioLines size={12} /> Detach
        </button>
      </div>
    </Panel>
  );
}

function ExportQuickControls({ clip, media }) {
  const [loading, setLoading] = useState(null);
  const run = async (id, fn) => { setLoading(id); try { await fn(); } catch { } finally { setLoading(null); } };
  const btns = [
    { id: "mp4", label: "MP4", fn: () => console.log("export mp4 clip", clip?.id) },
    { id: "webm", label: "WebM", fn: () => console.log("export webm clip", clip?.id) },
    { id: "mp3", label: "MP3", fn: () => console.log("export mp3 audio", clip?.id) },
    { id: "gif", label: "GIF", fn: () => console.log("export gif", clip?.id) }
  ];
  return (
    <Panel title="Export Cepat">
      <p className="text-[11px] text-[var(--text-muted)]">
        Pilih klip di timeline lalu ekspor bagian yang dipilih saja, atau gunakan tombol Ekspor di TopBar untuk export penuh.
      </p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        {btns.map((btn) => (
          <button key={btn.id} type="button" onClick={() => run(btn.id, btn.fn)} disabled={loading === btn.id} className="flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)] disabled:opacity-40">
            {loading === btn.id ? <span className="h-3 w-3 animate-spin rounded-full border border-[var(--accent)] border-t-transparent" /> : <Download size={13} />}
            {btn.label}
          </button>
        ))}
      </div>
      {media && (
        <div className="pt-2 space-y-1.5">
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-medium">Subtitle & Watermark</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => console.log("add watermark")} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] hover:bg-[var(--bg-hover)]">
              <span className="text-xs">🔖</span> Watermark
            </button>
            <button type="button" onClick={() => console.log("burn subtitle")} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] hover:bg-[var(--bg-hover)]">
              <span className="text-xs">CC</span> Burn Sub
            </button>
            <button type="button" onClick={() => console.log("attach subtitle")} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] hover:bg-[var(--bg-hover)]">
              <span className="text-xs">CC</span> Attach Sub
            </button>
            <button type="button" onClick={() => console.log("export caption SRT")} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-[11px] hover:bg-[var(--bg-hover)]">
              <Download size={12} /> Caption
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}


function MediaMetadataInspector({ media }) {
  return (
    <div className="space-y-5">
      <MediaMetadataTabs media={media} />
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        Tambahkan file ke timeline untuk membuka kontrol editing lengkap.
      </p>
    </div>
  );
}

function FilterControls({ clip, updateClip }) {
  const filters = { ...defaultFilters, ...(clip.filters ?? {}) };
  return (
    <Panel title="Filter Preset">
      <div className="grid grid-cols-3 gap-2">
        {Object.keys(filterPresets).map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => updateClip(clip.id, { filters: mergePreset(filters, preset) })}
            className={`rounded-md border px-2 py-2 text-xs ${filters.preset === preset ? "border-[var(--accent)] text-white" : "border-[var(--border)] text-[var(--text-secondary)]"} hover:bg-[var(--bg-hover)]`}
          >
            {preset}
          </button>
        ))}
      </div>
      <HistogramPreview clip={clip} />
      <button type="button" onClick={() => updateClip(clip.id, { filters: structuredClone(defaultFilters) })} className="h-8 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)]">
        Reset Color
      </button>
    </Panel>
  );
}

function AiVisualControls({ clip, updateClip }) {
  const bgRemove = { ...defaultBgRemove, ...(clip.bgRemove ?? {}) };
  const faceBlur = { ...defaultFaceBlur, ...(clip.faceBlur ?? {}) };
  const autoReframe = { ...defaultAutoReframe, ...(clip.autoReframe ?? {}) };
  return (
    <Panel title="AI Video">
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={bgRemove.enabled} onChange={(event) => updateClip(clip.id, { bgRemove: { ...bgRemove, enabled: event.target.checked } })} />
        Hapus background
      </label>
      {bgRemove.enabled ? (
        <>
          <Select label="BG" value={bgRemove.bgType} options={["blur", "color"]} onChange={(value) => updateClip(clip.id, { bgRemove: { ...bgRemove, bgType: value } })} />
          {bgRemove.bgType === "color" ? (
            <label className="grid grid-cols-[80px_1fr] items-center gap-3 text-xs">
              <span className="text-[var(--text-muted)]">Color</span>
              <input type="color" value={bgRemove.bgColor} onChange={(event) => updateClip(clip.id, { bgRemove: { ...bgRemove, bgColor: event.target.value } })} className="h-9 w-full rounded-md border border-[var(--border)] bg-[#151515]" />
            </label>
          ) : (
            <Range label={`BG blur ${bgRemove.blurAmount}px`} min="0" max="40" step="1" value={bgRemove.blurAmount} onChange={(value) => updateClip(clip.id, { bgRemove: { ...bgRemove, blurAmount: value } })} />
          )}
        </>
      ) : null}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={faceBlur.enabled} onChange={(event) => updateClip(clip.id, { faceBlur: { ...faceBlur, enabled: event.target.checked } })} />
        Face blur
      </label>
      {faceBlur.enabled ? (
        <Range label={`Blur wajah ${faceBlur.intensity}px`} min="4" max="40" step="1" value={faceBlur.intensity} onChange={(value) => updateClip(clip.id, { faceBlur: { ...faceBlur, intensity: value } })} />
      ) : null}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={autoReframe.enabled} onChange={(event) => updateClip(clip.id, { autoReframe: { ...autoReframe, enabled: event.target.checked } })} />
        Auto reframe
      </label>
      {autoReframe.enabled ? (
        <>
          <Select label="Aspect" value={autoReframe.targetAspect} options={["9:16", "1:1", "4:5"]} onChange={(value) => updateClip(clip.id, { autoReframe: { ...autoReframe, targetAspect: value } })} />
          <Range label={`Center X ${autoReframe.centerX.toFixed(2)}`} min="0" max="1" step="0.01" value={autoReframe.centerX} onChange={(value) => updateClip(clip.id, { autoReframe: { ...autoReframe, centerX: value } })} />
          <Range label={`Center Y ${autoReframe.centerY.toFixed(2)}`} min="0" max="1" step="0.01" value={autoReframe.centerY} onChange={(value) => updateClip(clip.id, { autoReframe: { ...autoReframe, centerY: value } })} />
        </>
      ) : null}
      <p className="text-[11px] leading-4 text-[var(--text-muted)]">Mode lokal memakai estimasi canvas. Integrasi MediaPipe bisa mengganti mask dan box tanpa mengubah data klip.</p>
    </Panel>
  );
}

function TransformControls({ clip, updateClip, toggleCropMode }) {
  const transform = { ...defaultTransform, ...(clip.transform ?? {}) };
  const setTransform = (patch) => updateClip(clip.id, { transform: { ...transform, ...patch } });
  return (
    <Panel title="Crop & Transform">
      <div className="grid grid-cols-4 gap-1">
        <button type="button" onClick={toggleCropMode} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Crop</button>
        <button type="button" onClick={() => setTransform({ cropX: 0, cropY: 0, cropW: 1, cropH: 1 })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Free</button>
        <button type="button" onClick={() => setTransform({ cropX: 0, cropY: 0, cropW: 1, cropH: 1 })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">16:9</button>
        <button type="button" onClick={() => setTransform({ cropX: 0.21875, cropY: 0, cropW: 0.5625, cropH: 1 })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">9:16</button>
        <button type="button" onClick={() => setTransform({ cropX: 0.125, cropY: 0, cropW: 0.75, cropH: 1 })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">4:3</button>
        <button type="button" onClick={() => setTransform({ cropX: 0.125, cropY: 0, cropW: 0.75, cropH: 1 })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">1:1</button>
        <button type="button" onClick={() => setTransform({ flipH: !transform.flipH })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Flip H</button>
        <button type="button" onClick={() => setTransform({ flipV: !transform.flipV })} className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--bg-hover)]">Flip V</button>
      </div>
      <Range label={`Rotate ${transform.rotation}deg`} min="-180" max="180" step="1" value={transform.rotation} onChange={(value) => setTransform({ rotation: value })} />
      <Range label={`Scale X ${transform.scaleX.toFixed(2)}`} min="0.2" max="3" step="0.05" value={transform.scaleX} onChange={(value) => setTransform({ scaleX: value })} />
      <Range label={`Scale Y ${transform.scaleY.toFixed(2)}`} min="0.2" max="3" step="0.05" value={transform.scaleY} onChange={(value) => setTransform({ scaleY: value })} />
    </Panel>
  );
}

function EffectsControls({ clip, updateClip, openStabilize }) {
  const effects = { ...defaultEffects, ...(clip.effects ?? {}) };
  const filters = { ...defaultFilters, ...(clip.filters ?? {}) };
  return (
    <Panel title="Effects">
      <Range label={`Blur ${effects.blur}px`} min="0" max="20" step="1" value={effects.blur} onChange={(value) => updateClip(clip.id, { effects: { ...effects, blur: value } })} />
      <Range label={`Vignette ${Math.round((effects.vignette?.intensity ?? 0) * 100)}%`} min="0" max="1" step="0.05" value={effects.vignette?.intensity ?? 0} onChange={(value) => updateClip(clip.id, { effects: { ...effects, vignette: { ...(effects.vignette ?? {}), intensity: value } }, filters: { ...filters, vignette: value * 100 } })} />
      <Range label={`Softness ${effects.vignette?.softness ?? 0.5}`} min="0.1" max="1" step="0.05" value={effects.vignette?.softness ?? 0.5} onChange={(value) => updateClip(clip.id, { effects: { ...effects, vignette: { ...(effects.vignette ?? {}), softness: value } } })} />
      <button type="button" onClick={openStabilize} className="h-8 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)]">
        Stabilkan
      </button>
    </Panel>
  );
}

function StickerControls({ clip, updateClip }) {
  return (
    <Panel title="Sticker">
      <Range label={`Opacity ${Math.round((clip.opacity ?? 1) * 100)}%`} min="0" max="1" step="0.05" value={clip.opacity ?? 1} onChange={(value) => updateClip(clip.id, { opacity: value })} />
      <Range label={`Scale X ${clip.scaleX ?? 0.2}`} min="0.05" max="1" step="0.05" value={clip.scaleX ?? 0.2} onChange={(value) => updateClip(clip.id, { scaleX: value })} />
      <Range label={`Scale Y ${clip.scaleY ?? 0.2}`} min="0.05" max="1" step="0.05" value={clip.scaleY ?? 0.2} onChange={(value) => updateClip(clip.id, { scaleY: value })} />
      <Range label={`Rotate ${clip.rotation ?? 0}deg`} min="-180" max="180" step="1" value={clip.rotation ?? 0} onChange={(value) => updateClip(clip.id, { rotation: value })} />
      <Select label="Animasi" value={clip.animation ?? "none"} options={animations} onChange={(value) => updateClip(clip.id, { animation: value })} />
    </Panel>
  );
}

function HistogramPreview() {
  return (
    <div className="h-20 rounded-md border border-[var(--border)] bg-[linear-gradient(90deg,#272727_1px,transparent_1px),linear-gradient(180deg,#1b1b1b,#0f0f0f)] bg-[length:20px_100%,100%_100%]">
      <div className="flex h-full items-end gap-px px-2 pb-2">
        {Array.from({ length: 28 }, (_, index) => (
          <span
            key={index}
            className="flex-1 rounded-t bg-[var(--accent)]/70"
            style={{ height: `${20 + Math.abs(Math.sin(index * 0.55)) * 58}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyInspector() {
  return (
    <div className="grid h-full place-items-center text-center">
      <div>
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-panel-soft)]">
          <SlidersHorizontal size={21} />
        </div>
        <p className="text-sm text-white">Belum ada klip dipilih</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Klik klip di timeline untuk membuka inspector.</p>
      </div>
    </div>
  );
}

function AudioControls({ clip, updateClip, mini = false }) {
  if (mini) {
    return (
      <Panel title="Audio (Video)">
        <Range label={`Volume ${Math.round((clip.volume ?? 1) * 100)}%`} min="0" max="2" step="0.05" value={clip.volume ?? 1} onChange={(value) => updateClip(clip.id, { volume: value })} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={Boolean(clip.muted)} onChange={(e) => updateClip(clip.id, { muted: e.target.checked })} />
          Mute
        </label>
      </Panel>
    );
  }
  return (
    <Panel title="Audio">
      <Range label={`Volume ${Math.round((clip.volume ?? 1) * 100)}%`} min="0" max="2" step="0.05" value={clip.volume ?? 1} onChange={(value) => updateClip(clip.id, { volume: value })} />
      <Range label={`Fade In ${clip.fadeIn ?? 0}s`} min="0" max="5" step="0.1" value={clip.fadeIn ?? 0} onChange={(value) => updateClip(clip.id, { fadeIn: value })} />
      <Range label={`Fade Out ${clip.fadeOut ?? 0}s`} min="0" max="5" step="0.1" value={clip.fadeOut ?? 0} onChange={(value) => updateClip(clip.id, { fadeOut: value })} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={Boolean(clip.normalizeAudio)} onChange={(event) => updateClip(clip.id, { normalizeAudio: event.target.checked })} />
        Normalize audio
      </label>
    </Panel>
  );
}

function AudioAiControls({ clip, media, updateClip, updateMediaItem }) {
  const voiceEffect = { enabled: false, type: "none", pitchShift: 0, intensity: 0.5, ...(clip.voiceEffect ?? {}) };
  const noiseReduction = { enabled: false, intensity: 0, ...(clip.noiseReduction ?? {}) };
  const [denoiseStatus, setDenoiseStatus] = useState("idle");
  const [waveforms, setWaveforms] = useState(null);
  const processNoise = async () => {
    if (!media?.file) return;
    setDenoiseStatus("loading");
    try {
      const result = await reduceNoiseFile(media.file, {
        intensity: noiseReduction.intensity || 70,
        onProgress: (_, message) => message && setDenoiseStatus(message)
      });
      updateMediaItem(media.id, {
        file: result.file,
        url: result.url,
        name: result.file.name,
        type: "audio",
        denoised: true
      });
      updateClip(clip.id, { noiseReduction: { ...noiseReduction, enabled: true, processed: true } });
      setWaveforms({ before: result.waveformBefore, after: result.waveformAfter });
      setDenoiseStatus("Denoise selesai");
    } catch (error) {
      setDenoiseStatus(error instanceof Error ? error.message : "Denoise gagal");
    }
  };
  return (
    <Panel title="AI Audio">
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={noiseReduction.enabled} onChange={(event) => updateClip(clip.id, { noiseReduction: { ...noiseReduction, enabled: event.target.checked } })} />
        Kurangi noise
      </label>
      <Range label={`Noise reduction ${noiseReduction.intensity}%`} min="0" max="100" step="1" value={noiseReduction.intensity} onChange={(value) => updateClip(clip.id, { noiseReduction: { ...noiseReduction, enabled: value > 0, intensity: value } })} />
      <button type="button" onClick={processNoise} disabled={!media?.file || denoiseStatus === "loading"} className="h-8 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)] disabled:opacity-50">
        Process Noise Reduction
      </button>
      {denoiseStatus !== "idle" ? <p className="text-[11px] leading-4 text-[var(--text-muted)]">{denoiseStatus}</p> : null}
      {waveforms ? <MiniWaveforms before={waveforms.before} after={waveforms.after} /> : null}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={voiceEffect.enabled} onChange={(event) => updateClip(clip.id, { voiceEffect: { ...voiceEffect, enabled: event.target.checked } })} />
        Voice changer
      </label>
      <Select label="Voice" value={voiceEffect.type} options={["none", "robot", "chipmunk", "deep", "echo", "reverb"]} onChange={(value) => updateClip(clip.id, { voiceEffect: { ...voiceEffect, enabled: value !== "none", type: value } })} />
      <Range label={`Pitch ${voiceEffect.pitchShift} semitone`} min="-12" max="12" step="1" value={voiceEffect.pitchShift} onChange={(value) => updateClip(clip.id, { voiceEffect: { ...voiceEffect, pitchShift: value } })} />
      <Range label={`Intensity ${Math.round(voiceEffect.intensity * 100)}%`} min="0" max="1" step="0.05" value={voiceEffect.intensity} onChange={(value) => updateClip(clip.id, { voiceEffect: { ...voiceEffect, intensity: value } })} />
    </Panel>
  );
}

function MiniWaveforms({ before, after }) {
  return (
    <div className="space-y-1 rounded-md border border-[var(--border)] bg-[#101010] p-2">
      <WaveLine data={before} color="#ef4444" />
      <WaveLine data={after} color="#4ade80" />
    </div>
  );
}

function WaveLine({ data, color }) {
  return (
    <div className="flex h-8 items-center gap-px">
      {data.map((value, index) => (
        <span key={index} className="flex-1 rounded" style={{ height: `${Math.max(2, value * 28)}px`, backgroundColor: color }} />
      ))}
    </div>
  );
}

function CaptionEditor({ clip, tracks, updateClip }) {
  const captions = tracks
    .filter((track) => track.type === "text")
    .flatMap((track) => track.clips)
    .filter((item) => item.caption)
    .sort((a, b) => a.start - b.start);
  const updateAll = (patch) => captions.forEach((item) => updateClip(item.id, patch));
  return (
    <Panel title="Caption Editor">
      <div className="max-h-32 space-y-1 overflow-auto">
        {captions.map((item) => (
          <label key={item.id} className="grid gap-1 rounded border border-[var(--border)] bg-[#101010] p-2 text-xs">
            <span className="font-mono text-[10px] text-[var(--text-muted)]">{formatMiniTime(item.start)} - {formatMiniTime(item.end)}</span>
            <input value={item.text ?? ""} onChange={(event) => updateClip(item.id, { text: event.target.value })} className="h-7 rounded bg-[#151515] px-2 text-white outline-none" />
          </label>
        ))}
      </div>
      <Range label={`Semua size ${clip.fontSize ?? 44}px`} min="18" max="96" step="1" value={clip.fontSize ?? 44} onChange={(value) => updateAll({ fontSize: value })} />
      <label className="grid grid-cols-[80px_1fr] items-center gap-3 text-xs">
        <span className="text-[var(--text-muted)]">Color</span>
        <input type="color" value={clip.color ?? "#ffffff"} onChange={(event) => updateAll({ color: event.target.value })} className="h-9 w-full rounded-md border border-[var(--border)] bg-[#151515]" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => downloadTextFile("captions.srt", exportSRT(captions), "text/srt")} className="flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)]">
          <Download size={14} /> SRT
        </button>
        <button type="button" onClick={() => downloadTextFile("captions.vtt", exportVTT(captions), "text/vtt")} className="flex h-8 items-center justify-center gap-2 rounded-md border border-[var(--border)] text-xs hover:bg-[var(--bg-hover)]">
          <Download size={14} /> VTT
        </button>
      </div>
    </Panel>
  );
}

function TextControls({ clip, updateClip }) {
  return (
    <Panel title="Teks">
      <label className="grid gap-2">
        <span className="text-xs text-[var(--text-muted)]">Isi teks</span>
        <textarea
          value={clip.text ?? ""}
          onChange={(event) => updateClip(clip.id, { text: event.target.value })}
          className="min-h-20 rounded-md border border-[var(--border)] bg-[#151515] p-2 text-white"
        />
      </label>
      <Select label="Font" value={clip.fontFamily ?? "Arial"} options={["Arial", "Inter", "Helvetica", "Georgia", "Impact", "Verdana"]} onChange={(value) => updateClip(clip.id, { fontFamily: value })} />
      <Range label={`Size ${clip.fontSize ?? 48}px`} min="18" max="120" step="1" value={clip.fontSize ?? 48} onChange={(value) => updateClip(clip.id, { fontSize: value })} />
      <label className="grid grid-cols-[80px_1fr] items-center gap-3 text-xs">
        <span className="text-[var(--text-muted)]">Color</span>
        <input type="color" value={clip.color ?? "#ffffff"} onChange={(event) => updateClip(clip.id, { color: event.target.value })} className="h-9 w-full rounded-md border border-[var(--border)] bg-[#151515]" />
      </label>
      <Select label="Align" value={clip.align ?? "center"} options={["left", "center", "right"]} onChange={(value) => updateClip(clip.id, { align: value })} />
      <Select label="Animasi" value={clip.animation ?? "none"} options={animations} onChange={(value) => updateClip(clip.id, { animation: value })} />
      <Range label={`Anim ${clip.animDuration ?? 0.5}s`} min="0.1" max="3" step="0.1" value={clip.animDuration ?? 0.5} onChange={(value) => updateClip(clip.id, { animDuration: value })} />
    </Panel>
  );
}

function TransitionControls({ clip, updateClip }) {
  const transition = clip.transition ?? { type: "none", duration: 0 };
  return (
    <Panel title="Transisi">
      <Select label="Type" value={transition.type} options={transitions} onChange={(value) => updateClip(clip.id, { transition: { ...transition, type: value } })} />
      <Range label={`Durasi ${transition.duration ?? 0}s`} min="0" max="2" step="0.1" value={transition.duration ?? 0} onChange={(value) => updateClip(clip.id, { transition: { ...transition, duration: value } })} />
    </Panel>
  );
}

function SpeedControls({ clip, updateClip }) {
  const speed = clip.speed ?? 1;
  const label = speed < 1 ? "Lambat" : speed > 1 ? "Cepat" : "Normal";
  return (
    <Panel title={`Speed: ${label}`}>
      <Select label="Speed" value={String(speed)} options={speedOptions.map(String)} onChange={(value) => updateClip(clip.id, { speed: Number(value) })} />
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={clip.preservePitch !== false} onChange={(event) => updateClip(clip.id, { preservePitch: event.target.checked })} />
        Pertahankan pitch audio
      </label>
    </Panel>
  );
}

function Panel({ title, children }) {
  return (
    <section className="space-y-3 rounded-md border border-[var(--border)] bg-[#141414] p-3">
      <h3 className="text-xs font-semibold uppercase text-white">{title}</h3>
      {children}
    </section>
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

function Select({ label, value, options, onChange }) {
  return (
    <label className="grid grid-cols-[80px_1fr] items-center gap-3 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatMiniTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const min = Math.floor(safe / 60);
  const sec = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 10);
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${ms}`;
}
