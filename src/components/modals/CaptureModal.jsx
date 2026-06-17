import React, { useState, useEffect } from "react";
import { X, Video, Mic, Monitor, Loader2 } from "lucide-react";
import { getNativeFFmpegCapabilities } from "../../utils/ffmpegRuntime.js";

const RESOLUTIONS = [
  { label: "1920x1080 (FHD)", value: "1920x1080" },
  { label: "1280x720 (HD)", value: "1280x720" },
  { label: "854x480 (SD)", value: "854x480" },
  { label: "Full screen", value: "screen" }
];

const FPS_OPTIONS = ["15", "24", "30", "60"];

export function CaptureModal({ onClose, onCapture }) {
  const [caps, setCaps] = useState(null);
  const [source, setSource] = useState("screen");
  const [resolution, setResolution] = useState("1280x720");
  const [fps, setFps] = useState("30");
  const [audioSource, setAudioSource] = useState("none");
  const [outputFolder, setOutputFolder] = useState("");
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    getNativeFFmpegCapabilities().then(setCaps);
  }, []);

  const nativeAvailable = caps?.available;
  const canCapture = nativeAvailable && (
    (caps?.formatsText?.includes("gdigrab") || caps?.formatsText?.includes("dshow"))
  );

  const buildCaptureArgs = () => {
    const args = [];
    if (source === "screen") {
      const [w, h] = resolution === "screen" ? ["1920", "1080"] : resolution.split("x");
      args.push(
        "-f", "gdigrab",
        "-framerate", fps,
        "-video_size", `${w}x${h}`,
        "-i", "desktop"
      );
    } else if (source === "webcam") {
      args.push(
        "-f", "dshow",
        "-framerate", fps,
        "-i", "video=default"
      );
    }

    if (audioSource === "mic") {
      args.push("-f", "dshow", "-i", "audio=default");
    }

    args.push(
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "23",
      "-movflags", "+faststart"
    );

    const outPath = outputFolder
      ? `${outputFolder}/capture_${Date.now()}.mp4`
      : `capture_${Date.now()}.mp4`;
    args.push(outPath);
    return args;
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[480px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Video size={16} />
            Capture
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-4 text-xs">
          <div className="flex gap-2">
            {[
              { id: "screen", label: "Layar", icon: <Monitor size={14} /> },
              { id: "webcam", label: "Webcam", icon: <Video size={14} /> }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md border py-2 transition ${source === s.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:text-white"}`}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <span className="text-[var(--text-muted)]">Resolusi</span>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="h-8 rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white">
              {RESOLUTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <span className="text-[var(--text-muted)]">FPS</span>
            <select value={fps} onChange={(e) => setFps(e.target.value)} className="h-8 rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white">
              {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f} fps</option>)}
            </select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <span className="text-[var(--text-muted)]">Audio</span>
            <select value={audioSource} onChange={(e) => setAudioSource(e.target.value)} className="h-8 rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white">
              <option value="none">Tanpa audio</option>
              <option value="mic">Mikrofon (dshow)</option>
              <option value="system">System audio (jika tersedia)</option>
            </select>
          </div>

          <div className="grid grid-cols-[100px_1fr] items-center gap-3">
            <span className="text-[var(--text-muted)]">Output folder</span>
            <input
              type="text"
              value={outputFolder}
              onChange={(e) => setOutputFolder(e.target.value)}
              placeholder="Biarkan kosong = folder default"
              className="h-8 rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white placeholder:text-[var(--text-muted)] outline-none"
            />
          </div>

          {!canCapture && (
            <div className="rounded-md border border-yellow-700 bg-yellow-950/30 p-3 text-[11px] text-yellow-300">
              {!nativeAvailable
                ? "FFmpeg native tidak tersedia. Install FFmpeg terlebih dahulu."
                : "gdigrab/dshow tidak tersedia di build FFmpeg ini. Diperlukan FFmpeg yang dikompilasi dengan dukungan Windows capture."}
            </div>
          )}

          <div className="rounded-md border border-[var(--border)] bg-[#0e0e0e] p-2 font-mono text-[10px] text-[var(--text-muted)] break-all">
            ffmpeg {buildCaptureArgs().join(" ")}
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--border)] p-3">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--bg-hover)]">
            Tutup
          </button>
          <button
            type="button"
            disabled={!canCapture}
            onClick={() => onCapture?.(buildCaptureArgs())}
            className="flex-1 h-9 flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Video size={15} />
            Mulai Capture
          </button>
        </div>
      </div>
    </div>
  );
}
