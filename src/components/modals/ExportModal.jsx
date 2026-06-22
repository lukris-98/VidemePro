import React, { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, X } from "lucide-react";
import { useMediaStore } from "../../store/mediaStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { exportProject } from "../../utils/exportProject.js";
import { renderPreviewFrame } from "../../utils/previewRenderer.js";
import { downloadTextFile, exportSRT, exportVTT, getCaptionClips } from "../../utils/subtitleExport.js";
import { formatTime } from "../../utils/timeFormat.js";
import { ModernSelect } from "../ui/ModernSelect.jsx";

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
      <div className="w-[760px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Download size={17} />
            Export Video
          </div>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-4 p-4 text-sm">
          <ExportPreview tracks={tracks} mediaItems={mediaItems} />
          <div className="grid gap-4">
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
            <p className="text-xs leading-5 text-[var(--text-muted)]">MP4 memakai FFmpeg native desktop. Tidak ada fallback FFmpeg.wasm di export ini.</p>
          </div>
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

function ExportPreview({ tracks, mediaItems }) {
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const duration = Math.max(1, ...tracks.flatMap((track) => track.clips.map((clip) => clip.end || 0)));
  const activeVideo = getActiveVideo(tracks, mediaItems, time);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPreviewFrame(canvas.getContext("2d"), canvas, {
      time,
      tracks,
      mediaItems,
      videoElement: videoRef.current,
      imageElement: null,
      previewMedia: null
    });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video && activeVideo?.media) {
      video.dataset.mediaId = activeVideo.media.id;
      const clipTime = (activeVideo.clip.inPoint ?? 0) + (time - activeVideo.clip.start) * (activeVideo.clip.speed ?? 1);
      try {
        video.currentTime = Math.max(0, Math.min(clipTime, video.duration || clipTime));
      } catch {
        draw();
      }
    }
    draw();
  }, [time, tracks, mediaItems, activeVideo?.media?.id]);

  useEffect(() => {
    if (!playing) return undefined;
    let frameId = 0;
    let last = performance.now();
    const tick = (now) => {
      const delta = (now - last) / 1000;
      last = now;
      setTime((value) => {
        const next = value + delta;
        return next >= duration ? 0 : next;
      });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, duration]);

  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[#101010]">
      <div className="relative aspect-video bg-black">
        <canvas ref={canvasRef} width={1280} height={720} className="h-full w-full" />
        {activeVideo?.media ? (
          <video
            key={activeVideo.media.proxy?.path || activeVideo.media.id}
            ref={videoRef}
            src={resolveMediaUrl(activeVideo.media)}
            muted
            playsInline
            preload="auto"
            className="hidden"
            onLoadedData={draw}
            onSeeked={draw}
          />
        ) : null}
      </div>
      <div className="flex h-10 items-center gap-2 border-t border-[var(--border)] px-2">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <input
          type="range"
          min="0"
          max={duration}
          step="0.01"
          value={Math.min(time, duration)}
          onChange={(event) => {
            setPlaying(false);
            setTime(Number(event.target.value));
          }}
          className="min-w-0 flex-1 accent-[var(--accent)]"
        />
        <span className="w-20 text-right font-mono text-[10px] text-[var(--text-muted)]">{formatTime(time)}</span>
      </div>
    </div>
  );
}

function getActiveVideo(tracks, mediaItems, time) {
  for (const track of tracks.filter((item) => item.type === "video" && item.visible !== false && !item.muted)) {
    const clip = track.clips.find((item) => time >= item.start && time <= item.end);
    const media = mediaItems.find((item) => item.id === clip?.mediaId);
    if (clip && media?.type === "video") return { clip, media };
  }
  return null;
}

function resolveMediaUrl(media) {
  if (!media) return "";
  if (media.proxy?.url) return media.proxy.url;
  if (media.proxy?.path && window.videmeNative) return `file://${media.proxy.path.replace(/\\/g, "/")}`;
  return media.url || "";
}

function Select({ label, value, options, onChange }) {
  return <ModernSelect label={label} value={value} options={options.map((option) => ({ value: option, label: option.toUpperCase() }))} onChange={onChange} />;
}
