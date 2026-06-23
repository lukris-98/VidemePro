import React from "react";
export function Playhead({ currentTime, pixelsPerSecond, height, scrollTop = 0 }) {
  return (
    <div
      className="pointer-events-none absolute top-0 z-20"
      style={{ left: currentTime * pixelsPerSecond }}
    >
      <div
        className="absolute h-0 w-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[var(--danger)]"
        style={{ top: scrollTop }}
      />
      <div className="ml-[6px] w-px bg-[var(--danger)]" style={{ height }} />
    </div>
  );
}
