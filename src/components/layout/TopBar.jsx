import React, { useEffect, useRef, useState } from "react";
import { Download, Menu, Share2 } from "lucide-react";
import vidmeLogo from "../../assets/vidme-logo.png";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { formatAdaptiveTimecode, parseTimecodeInput } from "../../utils/timeFormat.js";
import { FFmpegStatusBadge } from "../ui/FFmpegStatusBadge.jsx";

function IconButton({ title, children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export function TopBar({ leftWidth = 420, rightWidth = 420 }) {
  const projectName = useProjectStore((state) => state.projectName);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const duration = usePlaybackStore((state) => state.duration);
  const fps = usePlaybackStore((state) => state.fps);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);
  const openExport = useUiStore((state) => state.openExport);
  const [editingTimecode, setEditingTimecode] = useState(false);
  const [timecodeDraft, setTimecodeDraft] = useState("");
  const inputRef = useRef(null);
  const displayTimecode = formatAdaptiveTimecode(currentTime, fps);

  useEffect(() => {
    if (!editingTimecode) setTimecodeDraft(displayTimecode);
  }, [displayTimecode, editingTimecode]);

  useEffect(() => {
    if (!editingTimecode) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingTimecode]);

  const commitTimecode = () => {
    const nextTime = parseTimecodeInput(timecodeDraft, currentTime, fps);
    if (nextTime !== null) setCurrentTime(Math.min(nextTime, duration));
    setEditingTimecode(false);
  };

  return (
    <header
      className="grid h-12 items-center border-b border-[var(--border)] bg-[var(--bg-topbar)] px-3"
      style={{ gridTemplateColumns: `${leftWidth}px 4px minmax(420px, 1fr) 4px ${rightWidth}px` }}
    >
      <div className="flex items-center gap-2">
        <img
          src={vidmeLogo}
          alt="VidemePro+"
          className="h-8 w-8 rounded-lg object-cover"
        />
        <span className="text-sm font-semibold">VidemePro+</span>
        <IconButton title="Menu">
          <Menu size={18} />
        </IconButton>
      </div>
      <div className="col-start-3 flex items-center justify-center gap-3">
        <span className="max-w-[180px] truncate text-xs text-[var(--text-muted)]">{projectName}</span>
        {editingTimecode ? (
          <input
            ref={inputRef}
            value={timecodeDraft}
            onChange={(event) => setTimecodeDraft(event.target.value)}
            onBlur={commitTimecode}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitTimecode();
              if (event.key === "Escape") setEditingTimecode(false);
            }}
            className="h-8 w-[150px] rounded-md border border-[var(--accent)] bg-[#121212] px-3 text-center font-mono text-sm text-white outline-none"
            aria-label="Input timecode"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingTimecode(true)}
            className="flex h-8 min-w-[150px] items-center justify-center rounded-md border border-[var(--border)] bg-[#121212] px-4 font-mono text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            title="Klik untuk lompat ke timecode. Contoh: 1030, +15, 00:00:10:30"
          >
            {displayTimecode}
          </button>
        )}
      </div>
      <div className="col-start-5 flex items-center justify-end gap-2">
        <FFmpegStatusBadge />
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <Share2 size={16} />
          Bagikan
        </button>
        <button
          type="button"
          onClick={openExport}
          className="flex h-8 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] active:translate-y-px"
        >
          <Download size={16} />
          Ekspor
        </button>
      </div>
    </header>
  );
}
