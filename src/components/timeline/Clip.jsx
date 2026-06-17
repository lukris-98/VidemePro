import React, { memo, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { useMediaStore } from "../../store/mediaStore.js";
import { drawWaveform } from "../../utils/audioHelper.js";
import { formatTime } from "../../utils/timeFormat.js";

export const Clip = memo(function Clip({ clip, track, pixelsPerSecond, playheadTime }) {
  const dragRef = useRef(null);
  const waveformRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const selectedClipIds = useProjectStore((state) => state.selectedClipIds);
  const selectClip = useProjectStore((state) => state.selectClip);
  const moveClip = useProjectStore((state) => state.moveClip);
  const moveSelectedClips = useProjectStore((state) => state.moveSelectedClips);
  const trimClip = useProjectStore((state) => state.trimClip);
  const snapEnabled = useUiStore((state) => state.snapEnabled);
  const setTimelineSelection = useUiStore((state) => state.setTimelineSelection);
  const openFreeze = useUiStore((state) => state.openFreeze);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);
  const media = useMediaStore((state) => state.items.find((item) => item.id === clip.mediaId));
  const setPreviewMedia = useMediaStore((state) => state.setPreviewMedia);
  const selected = selectedClipIds?.includes(clip.id);
  const underPlayhead = playheadTime > clip.start && playheadTime < clip.end;
  const width = Math.max(24, (clip.end - clip.start) * pixelsPerSecond);
  const clipDuration = Math.max(0.1, clip.end - clip.start);
  const fps = usePlaybackStore((state) => state.fps);
  const clipHeight = Math.max(22, (track?.role === "main" ? 56 : track?.type === "audio" ? 40 : track?.type === "text" ? 24 : 32));

  useEffect(() => {
    if (media?.waveformData?.length && waveformRef.current) {
      const canvas = waveformRef.current;
      canvas.width = Math.max(24, Math.floor(width));
      canvas.height = 48;
      drawWaveform(canvas, media.waveformData);
    }
  }, [media?.waveformData, width]);

  const beginDrag = (event, mode) => {
    event.preventDefault();
    event.stopPropagation();
    setPreviewMedia(null);
    if (mode === "move" && !selected && !event.ctrlKey && !event.metaKey) selectClip(clip.id);
    dragRef.current = {
      mode,
      startX: event.clientX,
      originalStart: clip.start,
      originalEnd: clip.end,
      originalInPoint: clip.inPoint ?? 0,
      originalOutPoint: clip.outPoint ?? clip.mediaDuration ?? clipDuration
    };
    window.addEventListener("mousemove", handleWindowMove);
    window.addEventListener("mouseup", handleWindowUp, { once: true });
  };

  const handleWindowMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rawDelta = (event.clientX - drag.startX) / pixelsPerSecond;
    const delta = snapEnabled ? Math.round(rawDelta * fps) / fps : rawDelta;
    const minLength = 0.1;
    if (drag.mode === "move") {
      const newStart = Math.max(0, drag.originalStart + delta);
      const newEnd = newStart + clipDuration;
      setTooltip(`${formatTime(newStart)} - ${formatTime(newEnd)}`);
      return;
    }
    if (drag.mode === "trim-left") {
      const mediaDuration = clip.mediaDuration ?? drag.originalOutPoint;
      const maxDelta = Math.min(drag.originalEnd - drag.originalStart - minLength, mediaDuration - drag.originalInPoint - minLength);
      const safeDelta = Math.max(-drag.originalInPoint, Math.min(delta, maxDelta));
      setTooltip(`Durasi ${formatTime(drag.originalEnd - (drag.originalStart + safeDelta))}`);
      return;
    }
    const maxRight = (clip.mediaDuration ?? drag.originalOutPoint) - drag.originalOutPoint;
    const safeRightDelta = Math.max(-(drag.originalEnd - drag.originalStart - minLength), Math.min(delta, maxRight));
    setTooltip(`Durasi ${formatTime(drag.originalEnd + safeRightDelta - drag.originalStart)}`);
  };

  const handleWindowUp = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rawDelta = (event.clientX - drag.startX) / pixelsPerSecond;
    const delta = snapEnabled ? Math.round(rawDelta * fps) / fps : rawDelta;
    const minLength = 0.1;

    if (drag.mode === "move") {
      if (selected && (selectedClipIds?.length ?? 0) > 1) {
        moveSelectedClips(clip.id, Math.max(0, drag.originalStart + delta));
      } else {
        moveClip(clip.id, Math.max(0, drag.originalStart + delta), clip.trackId);
      }
    } else if (drag.mode === "trim-left") {
      const mediaDuration = clip.mediaDuration ?? drag.originalOutPoint;
      const maxDelta = Math.min(drag.originalEnd - drag.originalStart - minLength, mediaDuration - drag.originalInPoint - minLength);
      const safeDelta = Math.max(-drag.originalInPoint, Math.min(delta, maxDelta));
      trimClip(clip.id, {
        start: Math.max(0, drag.originalStart + safeDelta),
        inPoint: drag.originalInPoint + safeDelta,
        end: drag.originalEnd,
        outPoint: drag.originalOutPoint
      });
    } else if (drag.mode === "trim-right") {
      const maxRight = (clip.mediaDuration ?? drag.originalOutPoint) - drag.originalOutPoint;
      const safeRightDelta = Math.max(-(drag.originalEnd - drag.originalStart - minLength), Math.min(delta, maxRight));
      trimClip(clip.id, {
        start: drag.originalStart,
        end: drag.originalEnd + safeRightDelta,
        inPoint: drag.originalInPoint,
        outPoint: drag.originalOutPoint + safeRightDelta
      });
    }

    dragRef.current = null;
    setTooltip(null);
    window.removeEventListener("mousemove", handleWindowMove);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation();
        setPreviewMedia(null);
        selectClip(clip.id, event.shiftKey ? "range" : event.ctrlKey || event.metaKey ? "toggle" : "replace");
        queueMicrotask(() => setTimelineSelection(useProjectStore.getState().selectedClipIds ?? []));
      }}
      onMouseDown={(event) => beginDrag(event, "move")}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setPreviewMedia(null);
        selectClip(clip.id);
        setCurrentTime(Math.max(clip.start, Math.min(clip.end - 0.01, clip.start + clipDuration / 2)));
        openFreeze();
      }}
      className={`absolute top-2 overflow-hidden rounded-md border text-left text-xs text-white shadow-sm transition-transform duration-100 active:-translate-y-1 ${
        selected ? "border-white" : underPlayhead ? "border-[var(--danger)]" : "border-white/15"
      }`}
      style={{
        left: clip.start * pixelsPerSecond,
        width,
        height: clipHeight,
        background: clip.timelineColor ?? clip.color ?? "var(--clip-video)"
      }}
    >
      <div
        className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
        onMouseDown={(event) => beginDrag(event, "trim-left")}
      />
      <div className="h-full cursor-grab px-3 py-2 active:cursor-grabbing">
        {track?.role === "main" && media?.thumbnailUrl ? (
          <img src={media.thumbnailUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35" />
        ) : null}
        {media?.waveformData?.length ? (
          <canvas ref={waveformRef} className="absolute inset-0 h-full w-full opacity-90" />
        ) : null}
        <div className="relative z-[1] truncate font-semibold">{clip.text ?? clip.name ?? "Clip"}</div>
        <div className="relative z-[1] mt-1 h-1.5 rounded bg-black/25" />
        <div className="relative z-[1] mt-1 flex items-center gap-1">
          {clip.speed && clip.speed !== 1 ? <span className="rounded bg-black/45 px-1 font-mono text-[10px]">{clip.speed}x</span> : null}
          {clip.transition?.type && clip.transition.type !== "none" ? <span className="rounded bg-black/45 px-1 text-[10px]">{clip.transition.duration}s</span> : null}
          {clip.stabilized ? <span className="rounded bg-yellow-400 px-1 text-[10px] font-semibold text-black">Stab</span> : null}
        </div>
      </div>
      {clip.fadeIn ? <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/55 to-transparent" /> : null}
      {clip.fadeOut ? <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/55 to-transparent" /> : null}
      <div
        className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-white/20 hover:bg-white/40"
        onMouseDown={(event) => beginDrag(event, "trim-right")}
      />
      {tooltip ? (
        <div className="pointer-events-none absolute -top-7 left-2 z-20 rounded bg-black px-2 py-1 font-mono text-[10px] text-white">
          {tooltip}
        </div>
      ) : null}
    </div>
  );
});
