import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronDown,
  GripVertical,
  Eye,
  EyeOff,
  Headphones,
  ImagePlus,
  Lock,
  LockOpen,
  Magnet,
  Mic,
  MousePointer2,
  Music,
  Redo2,
  Scissors,
  Snowflake,
  Trash2,
  Type,
  Undo2,
  Video,
  Volume2,
  Crop,
  AudioLines,
  Layers,
  Download
} from "lucide-react";
import { ZoomSlider } from "../controls/ZoomSlider.jsx";
import { Playhead } from "../timeline/Playhead.jsx";
import { TimelineRuler } from "../timeline/TimelineRuler.jsx";
import { TrackLane } from "../timeline/TrackLane.jsx";
import { useTimeline } from "../../hooks/useTimeline.js";
import { useMediaStore } from "../../store/mediaStore.js";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { secondsToFrames, selectAutoTrack, snapClipStartToTargets } from "../../utils/timelineEngine.js";
import { makeProxy } from "../../utils/cacheService.js";

const trackIcons = {
  video: Video,
  audio: Mic,
  text: Type,
  overlay: Video
};

const trackColors = {
  video: "#4d9eff",
  audio: "#3ddc84",
  overlay: "#b56cff",
  text: "#f1c94c"
};

function ToolbarButton({ title, children, onClick, active = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px ${
        active ? "bg-[var(--bg-hover)] text-[var(--accent)]" : ""
      }`}
    >
      {children}
    </button>
  );
}

function getTrackHeight(track) {
  if (track.role === "main") return 72;
  if (track.type === "audio") return track.expanded ? 80 : 52;
  if (track.type === "text") return 36;
  if (track.type === "overlay") return track.expanded ? 64 : 44;
  return 44;
}

function TrackLabel({ track, isMain, onThumbnailPick, onThumbnailClear, onBeginTrackDrag, onDropTrack }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(track.name);
  const Icon = trackIcons[track.type] ?? Video;
  const setTrackMuted = useProjectStore((state) => state.setTrackMuted);
  const setTrackSolo = useProjectStore((state) => state.setTrackSolo);
  const setTrackVolume = useProjectStore((state) => state.setTrackVolume);
  const renameTrack = useProjectStore((state) => state.renameTrack);
  const setTrackLocked = useProjectStore((state) => state.setTrackLocked);
  const setTrackVisible = useProjectStore((state) => state.setTrackVisible);
  const toggleTrackExpanded = useProjectStore((state) => state.toggleTrackExpanded);
  const projectThumbnailUrl = useProjectStore((state) => state.projectThumbnailUrl);

  const commitName = () => {
    renameTrack(track.id, draftName);
    setEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-2 border-b border-[var(--border-soft)] px-2 text-xs ${track.buffer ? "opacity-45" : ""}`}
      style={{ height: getTrackHeight(track) }}
      onDragOver={(event) => {
        if (track.role !== "main") event.preventDefault();
      }}
      onDrop={(event) => onDropTrack(event, track.id)}
    >
      <div className="h-8 w-1 rounded-full" style={{ background: trackColors[track.type] ?? "#777" }} />
      {track.role !== "main" ? (
        <button
          type="button"
          title="Reorder track"
          draggable
          onDragStart={(event) => onBeginTrackDrag(event, track.id)}
          className="cursor-grab text-[var(--text-muted)] hover:text-white"
        >
          <GripVertical size={13} />
        </button>
      ) : null}
      <Icon size={15} className="shrink-0 text-[var(--text-muted)]" />
      {isMain ? <ProjectThumbnail thumbnailUrl={projectThumbnailUrl} onPick={onThumbnailPick} onClear={onThumbnailClear} /> : null}
      {!isMain && ["overlay", "video"].includes(track.type) ? <TrackMiniThumbnail track={track} /> : null}
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitName();
            if (event.key === "Escape") {
              setDraftName(track.name);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded bg-[#151515] px-1 py-0.5 text-[var(--text-secondary)] outline-none"
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate text-[var(--text-secondary)]"
          onDoubleClick={() => {
            setDraftName(track.name);
            setEditing(true);
          }}
        >
          {track.name}
        </span>
      )}
      {track.type === "audio" ? (
        <input
          title="Volume track"
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={track.volume ?? 1}
          onChange={(event) => setTrackVolume(track.id, Number(event.target.value))}
          className="w-10 accent-[var(--accent)]"
        />
      ) : null}
      <button
        type="button"
        title="Mute"
        onClick={() => setTrackMuted(track.id, !track.muted)}
        className={`${track.muted ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} hover:text-white`}
      >
        <Volume2 size={13} />
      </button>
      <button
        type="button"
        title="Solo"
        onClick={() => setTrackSolo(track.id)}
        className={`${track.solo ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} hover:text-white`}
      >
        <Headphones size={13} />
      </button>
      <button
        type="button"
        title="Lock"
        onClick={() => setTrackLocked(track.id, !track.locked)}
        className={`${track.locked ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} hover:text-white`}
      >
        {track.locked ? <Lock size={13} /> : <LockOpen size={13} />}
      </button>
      <button
        type="button"
        title="Visible"
        onClick={() => setTrackVisible(track.id, track.visible === false)}
        className={`${track.visible === false ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} hover:text-white`}
      >
        {track.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      {track.type === "audio" || track.type === "overlay" ? (
        <button
          type="button"
          title="Collapse/expand"
          onClick={() => toggleTrackExpanded(track.id)}
          className={`text-[var(--text-muted)] hover:text-white ${track.expanded ? "rotate-180" : ""}`}
        >
          <ChevronDown size={13} />
        </button>
      ) : null}
    </div>
  );
}

function ProjectThumbnail({ thumbnailUrl, onPick, onClear }) {
  return (
    <button
      type="button"
      title="Project thumbnail"
      onClick={onPick}
      onContextMenu={(event) => {
        event.preventDefault();
        if (thumbnailUrl) onClear();
      }}
      className="relative grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded border border-[var(--border)] bg-[#151515] text-[var(--text-muted)] hover:text-white"
    >
      {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <Camera size={16} />}
      <span className="absolute inset-0 hidden place-items-center bg-black/55 group-hover:grid">
        <ImagePlus size={15} />
      </span>
    </button>
  );
}

function TrackMiniThumbnail({ track }) {
  const firstClip = track.clips.find((clip) => clip.src || clip.thumbnailUrl);
  return (
    <div className="grid h-8 w-10 shrink-0 place-items-center overflow-hidden rounded border border-[var(--border-soft)] bg-[#151515] text-[var(--text-muted)]">
      {firstClip?.thumbnailUrl || firstClip?.src ? <img src={firstClip.thumbnailUrl ?? firstClip.src} alt="" className="h-full w-full object-cover" /> : <Camera size={13} />}
    </div>
  );
}

export function Timeline() {
  const scrollRef = useRef(null);
  const labelScrollRef = useRef(null);
  const marqueeRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [marquee, setMarquee] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [trackPanelWidth, setTrackPanelWidth] = useState(160);
  const [viewportWidth, setViewportWidth] = useState(900);
  const [viewport, setViewport] = useState({ left: 0, top: 0, width: 900, height: 180 });
  const tracks = useProjectStore((state) => state.tracks);
  const duration = useProjectStore((state) => state.duration);
  const addClip = useProjectStore((state) => state.addClip);
  const removeSelectedClip = useProjectStore((state) => state.removeSelectedClip);
  const reorderTrack = useProjectStore((state) => state.reorderTrack);
  const setProjectThumbnail = useProjectStore((state) => state.setProjectThumbnail);
  const selectClips = useProjectStore((state) => state.selectClips);
  const deselectAll = useProjectStore((state) => state.deselectAll);
  const splitSelectedAt = useProjectStore((state) => state.splitSelectedAt);
  const undo = useProjectStore((state) => state.undo);
  const redo = useProjectStore((state) => state.redo);
  const mediaItems = useMediaStore((state) => state.items);
  const markAdded = useMediaStore((state) => state.markAdded);
  const setPreviewMedia = useMediaStore((state) => state.setPreviewMedia);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const fps = usePlaybackStore((state) => state.fps);
  const pausePlayback = usePlaybackStore((state) => state.pause);
  const setPlaybackDuration = usePlaybackStore((state) => state.setDuration);
  const snapEnabled = useUiStore((state) => state.snapEnabled);
  const toggleSnap = useUiStore((state) => state.toggleSnap);
  const openFreeze = useUiStore((state) => state.openFreeze);
  const setTimelineScroll = useUiStore((state) => state.setTimelineScroll);
  const setTimelineMarquee = useUiStore((state) => state.setTimelineMarquee);
  const setTimelineSelection = useUiStore((state) => state.setTimelineSelection);
  const setTimelinePlayheadFrame = useUiStore((state) => state.setTimelinePlayheadFrame);
  const { pixelsPerSecond, seekFromPointer, timeFromPointer } = useTimeline();
  const timelineEnd = tracks.reduce(
    (max, track) => Math.max(max, ...track.clips.map((clip) => clip.end)),
    duration
  );
  const displayDuration = Math.max(timelineEnd, Math.ceil(viewportWidth / pixelsPerSecond));
  const laneWidth = Math.max(viewportWidth, displayDuration * pixelsPerSecond);
  const trackHeight = tracks.reduce((sum, track) => sum + getTrackHeight(track), 0);
  const totalHeight = 32 + trackHeight;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return undefined;
    const updateWidth = () => {
      setViewportWidth(Math.max(1, element.clientWidth));
      setViewport({
        left: element.scrollLeft,
        top: element.scrollTop,
        width: element.clientWidth,
        height: element.clientHeight
      });
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPlaybackDuration(displayDuration);
  }, [displayDuration, setPlaybackDuration]);

  useEffect(() => {
    setTimelinePlayheadFrame(secondsToFrames(currentTime, fps));
  }, [currentTime, fps, setTimelinePlayheadFrame]);

  const beginResizeTrackPanel = (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = trackPanelWidth;
    const onMove = (moveEvent) => {
      setTrackPanelWidth(Math.max(120, Math.min(300, startWidth + moveEvent.clientX - startX)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
  };

  const handleProjectThumbnail = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return;
    setProjectThumbnail(URL.createObjectURL(file));
    event.target.value = "";
  };

  const beginTrackDrag = (event, trackId) => {
    event.dataTransfer.setData("trackId", trackId);
  };

  const dropTrack = (event, trackId) => {
    const sourceTrackId = event.dataTransfer.getData("trackId");
    if (sourceTrackId) reorderTrack(sourceTrackId, trackId);
  };

  const handleSeek = (event) => {
    if (!scrollRef.current) return;
    setPreviewMedia(null);
    pausePlayback();
    seekFromPointer(event, scrollRef.current);
  };

  const handleDropMedia = (event, trackId) => {
    event.preventDefault();
    const mediaId = event.dataTransfer.getData("mediaId");
    const media = mediaItems.find((item) => item.id === mediaId);
    if (!media || !scrollRef.current) return;
    const rawStart = timeFromPointer(event, scrollRef.current);
    const resolvedTrackId = selectAutoTrack(tracks, media.type, trackId);
    const track = tracks.find((item) => item.id === resolvedTrackId);
    const start = snapStart(rawStart, media.duration, track?.clips ?? [], currentTime, snapEnabled, pixelsPerSecond, fps);
    const color = media.type === "audio" ? "var(--clip-audio)" : media.type === "image" || media.type === "photo" ? "var(--clip-text)" : "var(--clip-video)";
    addClip(resolvedTrackId, {
      mediaId,
      type: media.type === "audio" ? "audio" : media.type === "image" || media.type === "photo" ? "overlay" : "video",
      hasAudio: media.type === "video",
      name: media.name,
      start,
      end: start + media.duration,
      inPoint: 0,
      outPoint: media.duration,
      mediaDuration: media.duration,
      offset: 0,
      color
    });
    setGhost(null);
    markAdded(mediaId);
    if (media.type === "video") {
      const currentThumbnail = useProjectStore.getState().projectThumbnailUrl;
      if (!currentThumbnail) setProjectThumbnail(media.thumbnailUrl || media.url || "");
    }
  };

  const handleDragMediaOver = (event, trackId) => {
    if (!event || !scrollRef.current) {
      setGhost(null);
      return;
    }
    const mediaId = event.dataTransfer.getData("mediaId");
    const media = mediaItems.find((item) => item.id === mediaId);
    if (!media) return;
    const resolvedTrackId = selectAutoTrack(tracks, media.type, trackId);
    const track = tracks.find((item) => item.id === resolvedTrackId);
    const rawStart = timeFromPointer(event, scrollRef.current);
    const start = snapStart(rawStart, media.duration, track?.clips ?? [], currentTime, snapEnabled, pixelsPerSecond, fps);
    setGhost({ trackId: resolvedTrackId, start, duration: media.duration });
  };

  const splitAtPlayhead = () => {
    splitSelectedAt(currentTime);
  };

  const contentPointFromEvent = (event) => {
    const element = scrollRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    return {
      x: event.clientX - rect.left + element.scrollLeft,
      y: event.clientY - rect.top + element.scrollTop
    };
  };

  const beginTimelinePointer = (event) => {
    if (event.target.closest("[data-timeline-ruler]")) {
      setDraggingPlayhead(true);
      handleSeek(event);
      return;
    }
    if (event.button !== 0) return;
    const point = contentPointFromEvent(event);
    marqueeRef.current = { startX: point.x, startY: point.y, currentX: point.x, currentY: point.y };
    setMarquee(marqueeRef.current);
    setTimelineMarquee(marqueeRef.current);
  };

  const updateTimelinePointer = (event) => {
    if (draggingPlayhead) {
      handleSeek(event);
      return;
    }
    if (!marqueeRef.current) return;
    const point = contentPointFromEvent(event);
    marqueeRef.current = { ...marqueeRef.current, currentX: point.x, currentY: point.y };
    setMarquee(marqueeRef.current);
    setTimelineMarquee(marqueeRef.current);
  };

  const endTimelinePointer = (event) => {
    setDraggingPlayhead(false);
    if (!marqueeRef.current) return;
    const rect = marqueeToRect(marqueeRef.current);
    const didDrag = rect.width > 3 || rect.height > 3;
    if (didDrag) {
      const selected = findClipsInRect(tracks, pixelsPerSecond, getTrackHeight, rect);
      selectClips(selected);
      setTimelineSelection(selected);
    } else {
      if (event?.target && scrollRef.current?.contains(event.target)) {
        setPreviewMedia(null);
        pausePlayback();
        seekFromPointer(event, scrollRef.current);
      }
      deselectAll();
      setTimelineSelection([]);
    }
    marqueeRef.current = null;
    setMarquee(null);
    setTimelineMarquee(null);
  };

  return (
    <section className="flex h-full min-h-0 flex-col border-t border-[var(--border)] bg-[var(--bg-root)]">
      <div className="flex h-10 items-center justify-between border-b border-[var(--border)] bg-[#0f0f0f] px-3">
        <div className="flex items-center gap-1">
          <ToolbarButton title="Add text clip" onClick={() => useProjectStore.getState().addTextClip(currentTime)}>
            <Type size={16} />
          </ToolbarButton>
          <ToolbarButton title="Select">
            <MousePointer2 size={16} />
          </ToolbarButton>
          <ToolbarButton title="Split at playhead" onClick={splitAtPlayhead}>
            <Scissors size={16} />
          </ToolbarButton>
          <ToolbarButton title="Trim to playhead" onClick={() => {
            const state = useProjectStore.getState();
            const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === state.selectedClipId);
            if (!clip) return;
            if (currentTime > clip.start && currentTime < clip.end) {
              state.updateClip(clip.id, { end: currentTime, outPoint: clip.inPoint + (currentTime - clip.start) });
            }
          }}>
            <Scissors size={16} className="rotate-90" />
          </ToolbarButton>
          <ToolbarButton title="Crop mode" onClick={() => useUiStore.getState().toggleCropMode()}>
            <Crop size={16} />
          </ToolbarButton>
          <ToolbarButton title="Freeze frame" onClick={openFreeze}>
            <Snowflake size={16} />
          </ToolbarButton>
          <ToolbarButton title="Extract audio from selected clip" onClick={() => {
            const state = useProjectStore.getState();
            const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === state.selectedClipId);
            if (!clip?.hasAudio) return;
            const mediaItems = useMediaStore.getState().items;
            const media = mediaItems.find((m) => m.id === clip.mediaId);
            if (!media) return;
            const audioTrack = state.tracks.find((t) => t.type === "audio");
            if (!audioTrack) return;
            state.addClip(audioTrack.id, { ...clip, id: crypto.randomUUID(), type: "audio", hasAudio: true, color: "var(--clip-audio)" });
          }}>
            <Music size={16} />
          </ToolbarButton>
          <ToolbarButton title="Snapshot current frame" onClick={() => {
            const canvas = document.querySelector("canvas");
            if (!canvas) return;
            canvas.toBlob((blob) => {
              if (!blob) return;
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `snapshot_${Math.floor(currentTime * 1000)}.jpg`;
              a.click();
              URL.revokeObjectURL(url);
            }, "image/jpeg", 0.95);
          }}>
            <Camera size={16} />
          </ToolbarButton>
          <ToolbarButton title="Normalize audio on selected clip" onClick={() => {
            const state = useProjectStore.getState();
            if (state.selectedClipId) state.updateClip(state.selectedClipId, { normalizeAudio: true });
          }}>
            <AudioLines size={16} />
          </ToolbarButton>
          <ToolbarButton title="Make proxy for selected clip" onClick={async () => {
            const pState = useProjectStore.getState();
            const mState = useMediaStore.getState();
            const clip = pState.tracks.flatMap((t) => t.clips).find((c) => c.id === pState.selectedClipId);
            if (!clip) return;
            const media = mState.items.find((m) => m.id === clip.mediaId);
            if (!media?.file?.path && !media?.filePath) return;
            const inputPath = media.file?.path || media.filePath;
            const result = await makeProxy(inputPath, 540, `proxy-${clip.id}`);
            if (result?.ok && result.outputPath) {
              mState.updateMediaItem(media.id, { proxy: { path: result.outputPath, url: `file://${result.outputPath.replace(/\\/g, "/")}` } });
            }
          }}>
            <Layers size={16} />
          </ToolbarButton>
          <ToolbarButton title="Render selection" onClick={() => {
            const state = useProjectStore.getState();
            const clip = state.tracks.flatMap((t) => t.clips).find((c) => c.id === state.selectedClipId);
            if (clip) console.log("Render selection: clip", clip.id, clip.start, clip.end);
          }}>
            <Download size={16} />
          </ToolbarButton>
          <ToolbarButton title="Delete selected" onClick={removeSelectedClip}>
            <Trash2 size={16} />
          </ToolbarButton>
          <ToolbarButton title="Undo" onClick={undo}>
            <Undo2 size={16} />
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={redo}>
            <Redo2 size={16} />
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-3">
          <ToolbarButton title="Snap" onClick={toggleSnap} active={snapEnabled}>
            <Magnet size={16} />
          </ToolbarButton>
          <ZoomSlider />
        </div>
      </div>
      <div className="grid min-h-0 flex-1" style={{ gridTemplateColumns: `${trackPanelWidth}px 4px 1fr` }}>
        <div ref={labelScrollRef} className="overflow-hidden bg-[#0f0f0f]">
          <div className="sticky top-0 z-20 h-8 border-b border-r border-[var(--border)] bg-[#0f0f0f]" />
          {tracks.map((track) => (
            <TrackLabel
              key={track.id}
              track={track}
              isMain={track.role === "main"}
              onThumbnailPick={() => thumbnailInputRef.current?.click()}
              onThumbnailClear={() => setProjectThumbnail("")}
              onBeginTrackDrag={beginTrackDrag}
              onDropTrack={dropTrack}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Resize track panel"
          onMouseDown={beginResizeTrackPanel}
          className="cursor-col-resize border-x border-[var(--border-soft)] bg-[#151515] hover:bg-[var(--bg-hover)]"
        />
        <div
          ref={scrollRef}
          className="timeline-scrollbar relative overflow-auto"
          onMouseDown={beginTimelinePointer}
          onMouseMove={updateTimelinePointer}
          onMouseUp={endTimelinePointer}
          onMouseLeave={endTimelinePointer}
          onScroll={(event) => {
            if (labelScrollRef.current) labelScrollRef.current.scrollTop = event.currentTarget.scrollTop;
            setViewport({
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
              width: event.currentTarget.clientWidth,
              height: event.currentTarget.clientHeight
            });
            setTimelineScroll(event.currentTarget.scrollLeft, event.currentTarget.scrollTop);
          }}
        >
          <div className="relative" style={{ width: laneWidth, height: totalHeight }}>
            <TimelineRuler duration={displayDuration} pixelsPerSecond={pixelsPerSecond} width={laneWidth} fps={fps} />
            {tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                width={laneWidth}
                pixelsPerSecond={pixelsPerSecond}
                height={getTrackHeight(track)}
                viewportStart={(viewport.left - 200) / pixelsPerSecond}
                viewportEnd={(viewport.left + viewport.width + 200) / pixelsPerSecond}
                onDropMedia={handleDropMedia}
                onDragMediaOver={handleDragMediaOver}
                ghost={ghost}
                playheadTime={currentTime}
              />
            ))}
            {marquee ? <MarqueeBox marquee={marquee} /> : null}
            <Playhead currentTime={currentTime} pixelsPerSecond={pixelsPerSecond} height={totalHeight - 4} />
          </div>
        </div>
      </div>
      <input ref={thumbnailInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleProjectThumbnail} />
    </section>
  );
}

function MarqueeBox({ marquee }) {
  const rect = marqueeToRect(marquee);
  return (
    <div
      className="pointer-events-none absolute z-30 border border-[var(--accent)] bg-[var(--accent)]/20"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    />
  );
}

function marqueeToRect(marquee) {
  const left = Math.min(marquee.startX, marquee.currentX);
  const top = Math.min(marquee.startY, marquee.currentY);
  const right = Math.max(marquee.startX, marquee.currentX);
  const bottom = Math.max(marquee.startY, marquee.currentY);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function findClipsInRect(tracks, pixelsPerSecond, getHeight, rect) {
  const selected = [];
  let y = 32;
  for (const track of tracks) {
    const trackHeight = getHeight(track);
    for (const clip of track.clips) {
      const clipRect = {
        left: clip.start * pixelsPerSecond,
        right: clip.end * pixelsPerSecond,
        top: y + 8,
        bottom: y + Math.max(22, trackHeight - 8)
      };
      if (rectIntersects(rect, clipRect)) selected.push(clip.id);
    }
    y += trackHeight;
  }
  return selected;
}

function rectIntersects(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function snapStart(rawStart, duration, clips, playheadTime, enabled, pixelsPerSecond, fps) {
  return snapClipStartToTargets({
    rawStart,
    duration,
    clips,
    playheadTime,
    enabled,
    fps,
    thresholdSeconds: 5 / pixelsPerSecond
  });
}
