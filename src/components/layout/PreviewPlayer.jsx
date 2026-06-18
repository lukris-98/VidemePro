import React, { useEffect, useRef, useState } from "react";
import { PlaybackControls } from "../controls/PlaybackControls.jsx";
import { usePlayback } from "../../hooks/usePlayback.js";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { getActiveStickerClips, getActiveTextClips, renderPreviewFrame } from "../../utils/previewRenderer.js";
import { useUiStore } from "../../store/uiStore.js";
import { defaultTransform } from "../../utils/visualEffects.js";
import { segmentFrame } from "../../utils/backgroundRemover.js";
import { boxesToReframe, detectFaces } from "../../utils/faceDetector.js";
import { formatTimecode } from "../../utils/timeFormat.js";
import { makeProxy } from "../../utils/cacheService.js";
import { ModernSelect } from "../ui/ModernSelect.jsx";

export function PreviewPlayer() {
  const canvasRef = useRef(null);
  const previewAreaRef = useRef(null);
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const dragModeRef = useRef(null);
  const scrubbingPreviewRef = useRef(false);
  const pendingPreviewSeekRef = useRef(null);
  const previewSeekHandlerRef = useRef(null);
  const aiAnalyzeRef = useRef({ time: -1, busy: false });
  const [previewVideoTime, setPreviewVideoTime] = useState(0);
  const [previewVideoDuration, setPreviewVideoDuration] = useState(0);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 640, height: 360 });
  const { currentTime, isPlaying } = usePlayback();
  const duration = usePlaybackStore((state) => state.duration);
  const fps = usePlaybackStore((state) => state.fps);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);
  const pausePlayback = usePlaybackStore((state) => state.pause);
  const tracks = useProjectStore((state) => state.tracks);
  const selectedClipId = useProjectStore((state) => state.selectedClipId);
  const selectClip = useProjectStore((state) => state.selectClip);
  const updateClip = useProjectStore((state) => state.updateClip);
  const updateClipLive = useProjectStore((state) => state.updateClipLive);
  const mediaItems = useMediaStore((state) => state.items);
  const cropMode = useUiStore((state) => state.cropMode);
  const showSafeArea = useUiStore((state) => state.previewSafeArea);
  const showAlphaGrid = useUiStore((state) => state.previewAlphaGrid);
  const showCompare = useUiStore((state) => state.previewCompare);
  const previewAspect = useUiStore((state) => state.previewAspect);
  const setPreviewAspect = useUiStore((state) => state.setPreviewAspect);
  const previewMediaId = useMediaStore((state) => state.previewMediaId);
  const previewMedia = useMediaStore((state) => {
    if (state.transientPreviewMedia) return state.transientPreviewMedia;
    return state.items.find((item) => item.id === state.previewMediaId) ?? null;
  });

  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderPreviewFrame(canvas.getContext("2d"), canvas, {
      time: currentTime,
      tracks,
      mediaItems,
      videoElement: videoRef.current,
      imageElement: imageRef.current,
      previewMedia
    });
  };

  useEffect(() => {
    drawPreview();
  }, [currentTime, previewMedia, previewMediaId, tracks, mediaItems]);

  useEffect(() => {
    const element = previewAreaRef.current;
    if (!element) return undefined;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const width = Math.max(1, rect.width - 8);
      const height = Math.max(1, rect.height - 38);
      const ratio = aspectValue(previewAspect);
      const frameWidth = Math.min(width, height * ratio);
      setPreviewSize({ width: frameWidth, height: frameWidth / ratio });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewAspect]);

  useEffect(() => {
    const video = videoRef.current;
    const activeVideo = getActiveVideo(tracks, mediaItems, currentTime, previewMedia);
    if (isPlaying && activeVideo?.clip) return undefined;
    if (video && activeVideo?.media) {
      const onReady = () => drawPreview();
      video.addEventListener("seeked", onReady, { once: true });
      video.addEventListener("loadeddata", onReady, { once: true });
      video.dataset.mediaId = activeVideo.media.id;
      if (activeVideo.clip) {
        const clipTime = (activeVideo.clip.inPoint ?? 0) + (currentTime - activeVideo.clip.start) * (activeVideo.clip.speed ?? 1);
        const targetTime = Math.min(clipTime, Math.max(0, video.duration || clipTime));
        try {
          video.currentTime = targetTime;
        } catch {
          drawPreview();
        }
      } else {
        drawPreview();
      }
      return () => {
        video.removeEventListener("seeked", onReady);
        video.removeEventListener("loadeddata", onReady);
      };
    }
    return undefined;
  }, [currentTime, isPlaying, previewMedia, tracks, mediaItems]);

  const activeVideo = getActiveVideo(tracks, mediaItems, currentTime, previewMedia);

  const handlePreviewVideoReady = () => {
    const video = videoRef.current;
    if (!video) return;
    setPreviewVideoDuration(video.duration || previewMedia?.duration || 0);
    drawPreview();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || !activeVideo?.clip || !activeVideo.media) return undefined;
    let frameId = 0;
    const clip = activeVideo.clip;
    const clipTime = (clip.inPoint ?? 0) + (currentTime - clip.start) * (clip.speed ?? 1);
    const targetTime = Math.max(0, Math.min(clipTime, video.duration || clip.mediaDuration || clipTime));
    video.dataset.mediaId = activeVideo.media.id;
    video.muted = true;
    video.playbackRate = clip.speed ?? 1;
    if (Number.isFinite(targetTime) && Math.abs((video.currentTime || 0) - targetTime) > 0.12) {
      try {
        video.currentTime = targetTime;
      } catch {
        drawPreview();
      }
    }
    const drawLoop = () => {
      drawPreview();
      frameId = window.requestAnimationFrame(drawLoop);
    };
    const start = async () => {
      try {
        await video.play();
      } catch {
        drawPreview();
      }
      drawLoop();
    };
    start();
    return () => {
      window.cancelAnimationFrame(frameId);
      video.pause();
      video.playbackRate = 1;
    };
  }, [isPlaying, activeVideo?.clip?.id, activeVideo?.media?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || previewMedia?.type !== "video") return undefined;
    let frameId = 0;
    video.loop = true;
    video.muted = true;
    const syncVideoTime = () => {
      setPreviewVideoTime(video.currentTime || 0);
      setPreviewVideoDuration(video.duration || previewMedia.duration || 0);
    };
    const drawLoop = () => {
      if (scrubbingPreviewRef.current) return;
      drawPreview();
      frameId = window.requestAnimationFrame(drawLoop);
    };
    const startPreview = async () => {
      try {
        await video.play();
        setPreviewVideoPlaying(true);
      } catch {
        setPreviewVideoPlaying(false);
        drawPreview();
      }
      syncVideoTime();
      drawLoop();
    };
    video.addEventListener("loadedmetadata", syncVideoTime);
    video.addEventListener("timeupdate", syncVideoTime);
    startPreview();
    return () => {
      window.cancelAnimationFrame(frameId);
      video.removeEventListener("loadedmetadata", syncVideoTime);
      video.removeEventListener("timeupdate", syncVideoTime);
      video.pause();
      setPreviewVideoPlaying(false);
      video.loop = false;
    };
  }, [previewMedia?.id, previewMedia?.type]);

  useEffect(() => {
    if (previewMedia?.type !== "video") {
      setPreviewVideoTime(0);
      setPreviewVideoDuration(0);
      setPreviewVideoPlaying(false);
    }
  }, [previewMedia?.id, previewMedia?.type]);

  const stopPreviewVideo = () => {
    const video = videoRef.current;
    if (!video || previewMedia?.type !== "video") return;
    video.pause();
    setPreviewVideoPlaying(false);
  };

  const togglePreviewVideo = async () => {
    const video = videoRef.current;
    if (!video || previewMedia?.type !== "video") return;
    if (!video.paused) {
      stopPreviewVideo();
      return;
    }
    try {
      await video.play();
      setPreviewVideoPlaying(true);
    } catch {
      setPreviewVideoPlaying(false);
    }
  };

  const seekPreviewVideo = (value) => {
    const video = videoRef.current;
    if (!video || previewMedia?.type !== "video") return;
    stopPreviewVideo();
    const nextTime = Math.max(0, Math.min(Number(value), previewVideoDuration || previewMedia.duration || 0));
    setPreviewVideoTime(nextTime);
    pendingPreviewSeekRef.current = nextTime;
    if (previewSeekHandlerRef.current) {
      video.removeEventListener("seeked", previewSeekHandlerRef.current);
      video.removeEventListener("loadeddata", previewSeekHandlerRef.current);
    }
    const drawWhenReady = () => {
      drawPreview();
      if (pendingPreviewSeekRef.current !== null && Math.abs(video.currentTime - pendingPreviewSeekRef.current) > 0.04) {
        const pendingTime = pendingPreviewSeekRef.current;
        pendingPreviewSeekRef.current = null;
        seekPreviewVideo(pendingTime);
      } else {
        pendingPreviewSeekRef.current = null;
        previewSeekHandlerRef.current = null;
      }
    };
    previewSeekHandlerRef.current = drawWhenReady;
    video.addEventListener("seeked", drawWhenReady, { once: true });
    video.addEventListener("loadeddata", drawWhenReady, { once: true });
    try {
      video.currentTime = nextTime;
    } catch {
      drawPreview();
    }
  };

  const beginPreviewScrub = () => {
    scrubbingPreviewRef.current = true;
    pendingPreviewSeekRef.current = null;
    stopPreviewVideo();
  };

  const endPreviewScrub = () => {
    scrubbingPreviewRef.current = false;
    drawPreview();
  };

  const beginTimelineScrub = () => {
    pausePlayback();
  };

  const seekTimeline = (value) => {
    setCurrentTime(Number(value));
  };

  const updateOverlayPosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const clampX = Math.max(0, Math.min(1, x));
    const clampY = Math.max(0, Math.min(1, y));
    const activeSticker =
      getActiveStickerClips(tracks, currentTime).find((clip) => clip.id === selectedClipId) ?? getActiveStickerClips(tracks, currentTime)[0];
    if (activeSticker) {
      selectClip(activeSticker.id);
      updateClip(activeSticker.id, { posX: clampX, posY: clampY });
      return;
    }
    const activeText = getActiveTextClips(tracks, currentTime).find((clip) => clip.id === selectedClipId) ?? getActiveTextClips(tracks, currentTime)[0];
    if (activeText) {
      selectClip(activeText.id);
      updateClip(activeText.id, { posX: clampX, posY: clampY });
    }
  };

  const handleCanvasPointer = (event) => {
    dragModeRef.current = "overlay";
    updateOverlayPosition(event);
    window.addEventListener("mousemove", handleWindowMove);
    window.addEventListener("mouseup", handleWindowUp, { once: true });
  };

  const handleWindowMove = (event) => {
    if (dragModeRef.current === "overlay") updateOverlayPosition(event);
    if (dragModeRef.current?.startsWith("crop:")) updateCrop(event, dragModeRef.current.replace("crop:", ""));
  };

  const handleWindowUp = () => {
    dragModeRef.current = null;
    window.removeEventListener("mousemove", handleWindowMove);
  };

  const beginCropDrag = (event, handle) => {
    event.preventDefault();
    event.stopPropagation();
    dragModeRef.current = `crop:${handle}`;
    window.addEventListener("mousemove", handleWindowMove);
    window.addEventListener("mouseup", handleWindowUp, { once: true });
  };

  const updateCrop = (event, handle) => {
    const canvas = canvasRef.current;
    if (!canvas || !selectedClip) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const current = { ...defaultTransform, ...(selectedClip.transform ?? {}) };
    let { cropX, cropY, cropW, cropH } = current;
    const min = 0.08;
    if (handle.includes("l")) {
      const right = cropX + cropW;
      cropX = Math.min(x, right - min);
      cropW = right - cropX;
    }
    if (handle.includes("r")) {
      cropW = Math.max(min, x - cropX);
    }
    if (handle.includes("t")) {
      const bottom = cropY + cropH;
      cropY = Math.min(y, bottom - min);
      cropH = bottom - cropY;
    }
    if (handle.includes("b")) {
      cropH = Math.max(min, y - cropY);
    }
    cropW = Math.min(cropW, 1 - cropX);
    cropH = Math.min(cropH, 1 - cropY);
    updateClip(selectedClip.id, { transform: { ...current, cropX, cropY, cropW, cropH } });
  };

  const selectedClip = tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId);
  const selectedTransform = { ...defaultTransform, ...(selectedClip?.transform ?? {}) };

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `snapshot_${Date.now()}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/jpeg", 0.95);
  };

  useEffect(() => {
    const video = videoRef.current;
    const clip = activeVideo?.clip;
    if (!video || !clip || video.readyState < 2) return;
    const wantsMask = clip.bgRemove?.enabled;
    const wantsFace = clip.faceBlur?.enabled || clip.autoReframe?.enabled;
    if (!wantsMask && !wantsFace) return;
    if (aiAnalyzeRef.current.busy || Math.abs(aiAnalyzeRef.current.time - currentTime) < 0.35) return;
    aiAnalyzeRef.current = { time: currentTime, busy: true };
    let cancelled = false;
    const run = async () => {
      const patch = {};
      try {
        if (wantsFace) {
          const boxes = await detectFaces(video);
          if (boxes.length) {
            patch.faceBlur = { ...(clip.faceBlur ?? {}), boxes };
            const center = boxesToReframe(boxes);
            if (center && clip.autoReframe?.enabled) patch.autoReframe = { ...(clip.autoReframe ?? {}), ...center };
          }
        }
        if (wantsMask) {
          const maskUrl = await segmentFrame(video);
          if (maskUrl) patch.bgRemove = { ...(clip.bgRemove ?? {}), maskUrl };
        }
        if (!cancelled && Object.keys(patch).length) updateClipLive(clip.id, patch);
      } catch {
        // Fallback canvas masks still render when MediaPipe cannot process a frame.
      } finally {
        aiAnalyzeRef.current.busy = false;
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeVideo?.clip?.id, activeVideo?.clip?.bgRemove?.enabled, activeVideo?.clip?.faceBlur?.enabled, activeVideo?.clip?.autoReframe?.enabled, currentTime, updateClipLive]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={previewAreaRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-1">
        <div className="flex h-full min-h-0 w-full min-w-0 flex-col items-center justify-center gap-1">
          <div
            className="relative overflow-hidden rounded-md border border-[var(--border)] bg-black"
            style={{ width: previewSize.width, height: previewSize.height }}
          >
            <canvas
              ref={canvasRef}
              width={canvasDimensions(previewAspect).width}
              height={canvasDimensions(previewAspect).height}
              data-preview-canvas="true"
              className="h-full w-full cursor-crosshair"
              onMouseDown={handleCanvasPointer}
            />
            {showSafeArea && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute border border-white/20" style={{ inset: "5%" }} />
                <div className="absolute border border-white/30" style={{ inset: "10%" }} />
              </div>
            )}
            {showAlphaGrid && (
              <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "repeating-conic-gradient(#888 0% 25%,transparent 0% 50%)", backgroundSize: "16px 16px", mixBlendMode: "difference" }} />
            )}
            {showCompare && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-y-0 left-1/2 border-l border-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
                <div className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">A</div>
                <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">B</div>
              </div>
            )}
            {cropMode && selectedClip ? (
              <div className="absolute inset-0">
                <div
                  className="absolute border-2 border-[var(--accent)] bg-[var(--accent)]/10"
                  style={{
                    left: `${selectedTransform.cropX * 100}%`,
                    top: `${selectedTransform.cropY * 100}%`,
                    width: `${selectedTransform.cropW * 100}%`,
                    height: `${selectedTransform.cropH * 100}%`
                  }}
                >
                  <div className="absolute left-1/3 top-0 h-full border-l border-white/40" />
                  <div className="absolute left-2/3 top-0 h-full border-l border-white/40" />
                  <div className="absolute left-0 top-1/3 w-full border-t border-white/40" />
                  <div className="absolute left-0 top-2/3 w-full border-t border-white/40" />
                  <button type="button" onMouseDown={(event) => beginCropDrag(event, "lt")} className="absolute left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--accent)]" />
                  <button type="button" onMouseDown={(event) => beginCropDrag(event, "rt")} className="absolute right-0 top-0 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded bg-[var(--accent)]" />
                  <button type="button" onMouseDown={(event) => beginCropDrag(event, "lb")} className="absolute bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded bg-[var(--accent)]" />
                  <button type="button" onMouseDown={(event) => beginCropDrag(event, "rb")} className="absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 rounded bg-[var(--accent)]" />
                </div>
              </div>
            ) : null}
            {activeVideo?.media ? (
              <video
                key={activeVideo.media.proxy?.path || activeVideo.media.id}
                ref={videoRef}
                src={resolveMediaUrl(activeVideo.media)}
                className="hidden"
                muted
                playsInline
                preload="auto"
                data-media-id={activeVideo.media.id}
                onLoadedMetadata={handlePreviewVideoReady}
                onLoadedData={handlePreviewVideoReady}
                onCanPlay={handlePreviewVideoReady}
                onSeeked={handlePreviewVideoReady}
                onTimeUpdate={() => {
                  if (previewMedia?.type === "video") setPreviewVideoTime(videoRef.current?.currentTime || 0);
                }}
              />
            ) : null}
            {previewMedia?.type === "image" || previewMedia?.type === "photo" ? (
              <img
                ref={imageRef}
                src={previewMedia.url || previewMedia.thumbnailUrl}
                alt=""
                data-media-id={previewMedia.id}
                className="hidden"
                onLoad={drawPreview}
              />
            ) : null}
          </div>
          <div className="w-[min(260px,100%)]">
            <ModernSelect
              value={previewAspect}
              onChange={setPreviewAspect}
              options={previewAspectOptions}
              buttonClassName="h-8"
              menuClassName="bottom-[calc(100%+4px)] top-auto"
            />
          </div>
        </div>
      </div>

      {previewMedia?.type === "video" ? (
        <div className="border-t border-[var(--border)] bg-[var(--bg-panel-soft)] px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="w-20 font-mono text-xs text-[var(--text-secondary)]">{formatPreviewTime(previewVideoTime)}</span>
            <input
              type="range"
              min="0"
              max={Math.max(0.01, previewVideoDuration || previewMedia.duration || 0.01)}
              step="0.01"
              value={Math.min(previewVideoTime, previewVideoDuration || previewMedia.duration || 0)}
              onMouseDown={beginPreviewScrub}
              onTouchStart={beginPreviewScrub}
              onMouseUp={endPreviewScrub}
              onTouchEnd={endPreviewScrub}
              onBlur={endPreviewScrub}
              onChange={(event) => seekPreviewVideo(event.target.value)}
              className="min-w-0 flex-1 accent-[var(--accent)]"
            />
            <span className="w-20 text-right font-mono text-xs text-[var(--text-secondary)]">
              {formatPreviewTime(previewVideoDuration || previewMedia.duration)}
            </span>
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--border)] bg-[var(--bg-panel-soft)] px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="w-28 font-mono text-xs text-[var(--text-secondary)]">{formatTimecode(currentTime, fps)}</span>
            <input
              type="range"
              min="0"
              max={Math.max(0.01, duration || 0.01)}
              step={1 / fps}
              value={Math.min(currentTime, duration || 0)}
              onMouseDown={beginTimelineScrub}
              onTouchStart={beginTimelineScrub}
              onChange={(event) => seekTimeline(event.target.value)}
              className="min-w-0 flex-1 accent-[var(--accent)]"
              aria-label="Scrub timeline preview"
            />
            <span className="w-28 text-right font-mono text-xs text-[var(--text-secondary)]">{formatTimecode(duration, fps)}</span>
          </div>
        </div>
      )}
      <PlaybackControls
        previewMode={previewMedia?.type === "video"}
        previewPlaying={previewVideoPlaying}
        onPreviewToggle={togglePreviewVideo}
      />
    </div>
  );
}

const previewAspectOptions = [
  { value: "16:9", label: "YouTube 16:9" },
  { value: "9:16", label: "Shorts/Reels/TikTok 9:16" },
  { value: "1:1", label: "Instagram Square 1:1" },
  { value: "4:5", label: "Instagram Feed 4:5" },
  { value: "1.91:1", label: "Facebook/X 1.91:1" },
  { value: "21:9", label: "Cinema 21:9" }
];

function aspectValue(aspect) {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "1:1") return 1;
  if (aspect === "4:5") return 4 / 5;
  if (aspect === "1.91:1") return 1.91;
  if (aspect === "21:9") return 21 / 9;
  return 16 / 9;
}

function canvasDimensions(aspect) {
  if (aspect === "9:16") return { width: 1080, height: 1920 };
  if (aspect === "1:1") return { width: 1080, height: 1080 };
  if (aspect === "4:5") return { width: 1080, height: 1350 };
  if (aspect === "1.91:1") return { width: 1200, height: 628 };
  if (aspect === "21:9") return { width: 2560, height: 1080 };
  return { width: 1920, height: 1080 };
}

function getActiveVideo(tracks, mediaItems, time, previewMedia) {
  if (previewMedia?.type === "video") return { clip: null, media: previewMedia };
  for (const track of tracks.filter((item) => item.type === "video" && !item.muted)) {
    const clip = track.clips.find((item) => time >= item.start && time <= item.end);
    const media = mediaItems.find((item) => item.id === clip?.mediaId);
    if (media?.type === "video") return { clip, media };
  }
  return null;
}

function resolveMediaUrl(media) {
  if (!media) return null;
  if (media.proxy?.url) return media.proxy.url;
  if (media.proxy?.path && window.videmeNative) {
    return `file://${media.proxy.path.replace(/\\/g, "/")}`;
  }
  return media.url;
}

function formatPreviewTime(seconds) {
  const safe = Math.max(0, seconds || 0);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe % 1) * 100);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}
