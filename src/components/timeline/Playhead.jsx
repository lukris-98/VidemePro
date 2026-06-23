import React from "react";
export function Playhead({ currentTime, pixelsPerSecond, height, scrollTop = 0, fps = 30, onMouseDown }) {
  const safeFps = Math.max(1, Math.round(fps));
  const currentFrame = Math.max(0, Math.round(currentTime * safeFps));
  const frameLeft = currentFrame * (pixelsPerSecond / safeFps);

  return (
    <div
      data-timeline-playhead
      className="pointer-events-none absolute top-0 z-30"
      style={{ left: frameLeft }}
    >
      <div
        data-timeline-playhead
        className="pointer-events-auto absolute -left-2 top-0 z-10 w-5 cursor-ew-resize"
        style={{ height }}
        onMouseDown={onMouseDown}
      />
      <div
        data-timeline-playhead
        className="absolute h-0 w-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[var(--danger)]"
        style={{ top: scrollTop }}
      />
      <div className="ml-[6px] w-px bg-[var(--danger)]" style={{ height }} />
    </div>
  );
}
