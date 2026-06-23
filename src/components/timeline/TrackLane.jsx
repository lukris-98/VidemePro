import React, { memo, useMemo } from "react";
import { Film } from "lucide-react";
import { Clip } from "./Clip.jsx";

export const TrackLane = memo(function TrackLane({
  track,
  pixelsPerSecond,
  width,
  height,
  viewportStart,
  viewportEnd,
  onDropMedia,
  onDragMediaOver,
  ghost,
  playheadTime,
  isTimelineEmpty = false,
  stickMainTrack = false,
  stickyTop = 32,
  onOpenClipContextMenu
}) {
  const visibleClips = useMemo(
    () => track.clips.filter((clip) => clip.end >= viewportStart && clip.start <= viewportEnd),
    [track.clips, viewportEnd, viewportStart]
  );
  const stickyStyle = track.role === "main" && stickMainTrack ? { position: "sticky", top: stickyTop, bottom: 0, zIndex: 14 } : null;

  return (
    <div
      className={`relative border-b border-[var(--border-soft)] hover:bg-[#111] ${track.buffer ? "bg-[#0b0b0b]" : "bg-[#0d0d0d]"}`}
      style={{ width, height, ...stickyStyle }}
      onDragOver={(event) => {
        if (track.locked) return;
        event.preventDefault();
        onDragMediaOver(event, track.id);
      }}
      onDragLeave={() => onDragMediaOver(null, track.id)}
      onDrop={(event) => {
        if (!track.locked) onDropMedia(event, track.id);
      }}
    >
      {track.role === "main" && isTimelineEmpty ? <MainTrackEmptyState width={width} height={height} /> : null}
      {track.role === "main" ? <MainTrackGaps clips={track.clips} pixelsPerSecond={pixelsPerSecond} height={height} /> : null}
      {ghost?.trackId === track.id ? (
        <div
          className={`pointer-events-none absolute top-2 z-10 rounded-md border ${
            ghost.kind === "text"
              ? "animate-pulse border-[var(--clip-text)] bg-[var(--clip-text)]/30 shadow-[0_0_14px_rgba(241,201,76,0.28)]"
              : "border-[var(--accent)] bg-[var(--accent)]/30"
          }`}
          style={{
            left: ghost.start * pixelsPerSecond,
            width: Math.max(24, ghost.duration * pixelsPerSecond),
            height: Math.max(20, height - 16)
          }}
        />
      ) : null}
      {visibleClips.map((clip) => (
        <Clip key={clip.id} clip={clip} track={track} pixelsPerSecond={pixelsPerSecond} playheadTime={playheadTime} onOpenContextMenu={onOpenClipContextMenu} />
      ))}
    </div>
  );
});

function MainTrackEmptyState({ width, height }) {
  return (
    <div
      className="pointer-events-none absolute left-3 top-2 z-[1] flex items-center gap-3 rounded border border-dashed border-white/10 bg-white/[0.03] px-4 text-xs text-[var(--text-secondary)]"
      style={{ width: Math.max(220, width - 24), height: Math.max(28, height - 16) }}
    >
      <Film size={15} className="shrink-0 text-[var(--text-muted)]" />
      <span>Ayo mulai berkreasi, seret materi ke sini.</span>
    </div>
  );
}

function MainTrackGaps({ clips, pixelsPerSecond, height }) {
  const gaps = useMemo(() => {
    const sorted = [...clips].sort((a, b) => a.start - b.start);
    const result = [];
    let cursor = 0;
    for (const clip of sorted) {
      if (clip.start > cursor) result.push({ start: cursor, end: clip.start });
      cursor = Math.max(cursor, clip.end);
    }
    return result;
  }, [clips]);

  return gaps.map((gap) => (
    <div
      key={`${gap.start}-${gap.end}`}
      className="pointer-events-none absolute top-2 grid place-items-center rounded border border-dashed border-white/10 bg-white/[0.03] font-mono text-[10px] text-white/25"
      style={{
        left: gap.start * pixelsPerSecond,
        width: Math.max(18, (gap.end - gap.start) * pixelsPerSecond),
        height: Math.max(20, height - 16)
      }}
    >
      {(gap.end - gap.start) * pixelsPerSecond > 34 ? "Gap" : ""}
    </div>
  ));
}
