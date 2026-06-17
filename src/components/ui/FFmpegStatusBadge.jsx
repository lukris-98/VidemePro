import React, { useEffect, useState } from "react";
import { Cpu, Monitor, AlertCircle, CheckCircle } from "lucide-react";
import { getNativeFFmpegCapabilities } from "../../utils/ffmpegRuntime.js";

export function FFmpegStatusBadge() {
  const [caps, setCaps] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNativeFFmpegCapabilities().then((result) => {
      setCaps(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-[var(--text-muted)] border border-[var(--border)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--text-muted)]" />
        FFmpeg...
      </span>
    );
  }

  if (!caps?.available) {
    return (
      <span
        title={caps?.error || "FFmpeg native tidak tersedia"}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-yellow-400 border border-yellow-800 bg-yellow-950/30 cursor-help"
      >
        <AlertCircle size={11} />
        WASM
      </span>
    );
  }

  const gpuLabel = caps.gpu?.nvidia ? "NVENC" : caps.gpu?.intel ? "QSV" : caps.gpu?.amd ? "AMF" : null;

  return (
    <span
      title={`${caps.version}${caps.ffprobeAvailable ? " | FFprobe tersedia" : ""}${gpuLabel ? ` | GPU: ${gpuLabel}` : ""}`}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-green-400 border border-green-800 bg-green-950/30 cursor-help"
    >
      <CheckCircle size={11} />
      Native
      {gpuLabel && (
        <span className="flex items-center gap-0.5 text-blue-400">
          <Cpu size={10} />
          {gpuLabel}
        </span>
      )}
      {caps.ffprobeAvailable && (
        <span className="text-[var(--text-muted)]">
          <Monitor size={10} />
        </span>
      )}
    </span>
  );
}
