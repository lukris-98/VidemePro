import React from "react";
import { formatTimecode } from "../../utils/timeFormat.js";

export function TimelineRuler({ duration, pixelsPerSecond, width, fps = 30 }) {
  const majorStep = getMajorStep(pixelsPerSecond);
  const minorStep = majorStep / 2;
  const ticks = Array.from({ length: Math.ceil(duration / minorStep) + 1 }, (_, index) => {
    const time = index * minorStep;
    return { time, major: index % 2 === 0 };
  });

  return (
    <div data-timeline-ruler className="sticky top-0 z-10 h-8 border-b border-[var(--border)] bg-[#101010]" style={{ width }}>
      {ticks.map((tick) => (
        <div
          key={tick.time}
          className={`absolute top-0 border-l ${tick.major ? "h-full border-[var(--border)]" : "h-3 border-[var(--border-soft)]"}`}
          style={{ left: tick.time * pixelsPerSecond }}
        >
          {tick.major ? <span className="ml-1 font-mono text-[10px] text-[var(--text-muted)]">{formatTimecode(tick.time, fps)}</span> : null}
        </div>
      ))}
    </div>
  );
}

function getMajorStep(pixelsPerSecond) {
  if (pixelsPerSecond < 18) return 60;
  if (pixelsPerSecond < 36) return 10;
  if (pixelsPerSecond < 72) return 5;
  if (pixelsPerSecond < 160) return 1;
  return 1 / 30;
}
