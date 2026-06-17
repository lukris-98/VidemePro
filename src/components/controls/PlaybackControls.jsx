import React from "react";
import { Expand, Pause, Play, Rewind, SkipBack, SkipForward, StepBack, StepForward } from "lucide-react";
import { usePlaybackStore } from "../../store/playbackStore.js";
import { formatTimecode } from "../../utils/timeFormat.js";

function ControlButton({ title, children, onClick, active = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)] active:translate-y-px ${
        active ? "bg-[var(--bg-hover)] text-white" : "text-[var(--text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}

export function PlaybackControls({ previewMode = false, previewPlaying = false, onPreviewToggle }) {
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const duration = usePlaybackStore((state) => state.duration);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const togglePlay = usePlaybackStore((state) => state.togglePlay);
  const seekStart = usePlaybackStore((state) => state.seekStart);
  const seekEnd = usePlaybackStore((state) => state.seekEnd);
  const stepFrame = usePlaybackStore((state) => state.stepFrame);
  const playing = previewMode ? previewPlaying : isPlaying;
  const playTitle = previewMode ? (previewPlaying ? "Stop preview" : "Play preview") : isPlaying ? "Pause" : "Play";
  const handlePlay = previewMode ? onPreviewToggle : togglePlay;

  return (
    <div className="flex h-12 items-center justify-between border-t border-[var(--border)] bg-[var(--bg-panel-soft)] px-4">
      <div className="w-36 font-mono text-xs text-[var(--text-secondary)]">{formatTimecode(currentTime)}</div>
      <div className="flex items-center gap-1">
        <ControlButton title="Skip to start" onClick={seekStart}>
          <SkipBack size={17} />
        </ControlButton>
        <ControlButton title="Frame back" onClick={() => stepFrame(-1)}>
          <StepBack size={17} />
        </ControlButton>
        <ControlButton title={playTitle} onClick={handlePlay} active={playing}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </ControlButton>
        <ControlButton title="Frame forward" onClick={() => stepFrame(1)}>
          <StepForward size={17} />
        </ControlButton>
        <ControlButton title="Skip to end" onClick={seekEnd}>
          <SkipForward size={17} />
        </ControlButton>
      </div>
      <div className="flex w-36 items-center justify-end gap-1">
        <span className="mr-2 font-mono text-xs text-[var(--text-secondary)]">{formatTimecode(duration)}</span>
        <ControlButton title="Ratio">
          <Rewind size={16} />
        </ControlButton>
        <ControlButton title="Fullscreen">
          <Expand size={16} />
        </ControlButton>
      </div>
    </div>
  );
}
