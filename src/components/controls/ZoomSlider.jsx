import React from "react";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useUiStore } from "../../store/uiStore.js";

export function ZoomSlider() {
  const zoom = useUiStore((state) => state.timelineZoom);
  const setTimelineZoom = useUiStore((state) => state.setTimelineZoom);

  return (
    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
      <ZoomOut size={16} />
      <input
        aria-label="Timeline zoom"
        type="range"
        min="0.5"
        max="3"
        step="0.1"
        value={zoom}
        onChange={(event) => setTimelineZoom(Number(event.target.value))}
        className="h-1 w-28 accent-[var(--accent)]"
      />
      <ZoomIn size={16} />
      <button
        type="button"
        title="Fit to window"
        onClick={() => setTimelineZoom(1)}
        className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)] active:translate-y-px"
      >
        <Maximize2 size={16} />
      </button>
    </div>
  );
}
