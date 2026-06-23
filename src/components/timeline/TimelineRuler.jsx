import React from "react";

export function TimelineRuler({ duration, pixelsPerSecond, width, fps = 30 }) {
  const tickConfig = getTickConfig(pixelsPerSecond, fps);
  const ticks = buildTicks(duration, tickConfig, fps);

  return (
    <div data-timeline-ruler className="sticky top-0 z-10 h-8 border-b border-[var(--border)] bg-[#101010]" style={{ width }}>
      {ticks.map((tick) => (
        <div
          key={tick.key}
          className={`absolute top-0 border-l ${tick.major ? "h-full border-[var(--border)]" : "h-3 border-[var(--border-soft)]"}`}
          style={{ left: tick.time * pixelsPerSecond }}
        >
          {tick.major ? <span className="ml-1 font-mono text-[10px] text-[var(--text-muted)]">{formatRulerTick(tick, fps)}</span> : null}
        </div>
      ))}
    </div>
  );
}

function buildTicks(duration, config, fps) {
  if (config.mode === "frames") {
    const safeFps = Math.max(1, Math.round(fps));
    const totalFrames = Math.ceil(duration * safeFps);
    return Array.from({ length: Math.ceil(totalFrames / config.minorFrames) + 1 }, (_, index) => {
      const frame = index * config.minorFrames;
      return {
        key: `f-${frame}`,
        frame,
        time: frame / safeFps,
        major: frame % config.majorFrames === 0
      };
    });
  }

  return Array.from({ length: Math.ceil(duration / config.minorStep) + 1 }, (_, index) => {
    const time = index * config.minorStep;
    return { key: `s-${time}`, time, major: index % 2 === 0 };
  });
}

function formatRulerTick(tick, fps) {
  if (Number.isFinite(tick.frame)) {
    const safeFps = Math.max(1, Math.round(fps));
    const frameInSecond = tick.frame % safeFps;
    if (frameInSecond !== 0) return `${frameInSecond}f`;
  }
  return formatRulerTime(tick.time);
}

function formatRulerTime(seconds = 0) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getTickConfig(pixelsPerSecond, fps) {
  const safeFps = Math.max(1, Math.round(fps));
  if (pixelsPerSecond < 18) return { mode: "seconds", minorStep: 30 };
  if (pixelsPerSecond < 36) return { mode: "seconds", minorStep: 5 };
  if (pixelsPerSecond < 72) return { mode: "seconds", minorStep: 2.5 };
  if (pixelsPerSecond < 160) return { mode: "seconds", minorStep: 0.5 };
  if (pixelsPerSecond < 300) return { mode: "frames", majorFrames: Math.max(1, Math.round(safeFps / 3)), minorFrames: Math.max(1, Math.round(safeFps / 6)) };
  if (pixelsPerSecond < 520) return { mode: "frames", majorFrames: Math.max(1, Math.round(safeFps / 6)), minorFrames: 1 };
  return { mode: "frames", majorFrames: 1, minorFrames: 1 };
}
