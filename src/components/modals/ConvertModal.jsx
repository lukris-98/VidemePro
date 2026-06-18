import React, { useState, useEffect } from "react";
import { RefreshCw, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { getNativeFFmpegCapabilities, chooseBestH264Encoder, hasEncoder, cancelNativeJob, calcProgressPercent } from "../../utils/ffmpegRuntime.js";
import { transcodeBlobNative } from "../../utils/ffmpegRuntime.js";
import { ModernSelect } from "../ui/ModernSelect.jsx";

const OUTPUT_FORMATS = [
  { value: "mp4", label: "MP4 (H.264)", ext: "mp4", type: "video" },
  { value: "mp4-h265", label: "MP4 (H.265/HEVC)", ext: "mp4", type: "video" },
  { value: "webm", label: "WebM (VP9)", ext: "webm", type: "video" },
  { value: "mov", label: "MOV", ext: "mov", type: "video" },
  { value: "mkv", label: "MKV", ext: "mkv", type: "video" },
  { value: "avi", label: "AVI", ext: "avi", type: "video" },
  { value: "gif", label: "GIF (Animasi)", ext: "gif", type: "video" },
  { value: "png-seq", label: "PNG Sequence", ext: "png", type: "sequence" },
  { value: "jpg-seq", label: "JPG Sequence", ext: "jpg", type: "sequence" },
  { value: "mp3", label: "MP3", ext: "mp3", type: "audio" },
  { value: "wav", label: "WAV (Lossless)", ext: "wav", type: "audio" },
  { value: "aac", label: "AAC (M4A)", ext: "m4a", type: "audio" },
  { value: "flac", label: "FLAC (Lossless)", ext: "flac", type: "audio" },
  { value: "ogg", label: "OGG Vorbis", ext: "ogg", type: "audio" },
  { value: "opus", label: "Opus", ext: "ogg", type: "audio" }
];

const PRESETS = ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "veryslow"];
const PROFILES = ["baseline", "main", "high"];
const TUNES = ["none", "film", "animation", "grain", "stillimage", "fastdecode", "zerolatency"];

export function ConvertModal({ media, onClose }) {
  const [caps, setCaps] = useState(null);
  const [format, setFormat] = useState("mp4");
  const [encoder, setEncoder] = useState("libx264");
  const [audioEncoder, setAudioEncoder] = useState("aac");
  const [crf, setCrf] = useState(23);
  const [bitrate, setBitrate] = useState("");
  const [preset, setPreset] = useState("veryfast");
  const [profile, setProfile] = useState("main");
  const [tune, setTune] = useState("none");
  const [gop, setGop] = useState(60);
  const [maxrate, setMaxrate] = useState("");
  const [bufsize, setBufsize] = useState("");
  const [twoPass, setTwoPass] = useState(false);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(null);
  const [jobId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    getNativeFFmpegCapabilities().then((c) => {
      setCaps(c);
      if (c?.available) setEncoder(chooseBestH264Encoder(c));
    });
  }, []);

  if (!media) return null;

  const selectedFmt = OUTPUT_FORMATS.find((f) => f.value === format) || OUTPUT_FORMATS[0];
  const isVideoFmt = selectedFmt.type === "video";
  const isAudioFmt = selectedFmt.type === "audio";
  const isSeqFmt = selectedFmt.type === "sequence";
  const nativeAvailable = caps?.available;

  function buildArgs(inputPath, outputPath) {
    const args = ["-i", inputPath];
    if (isSeqFmt) {
      const seqFps = 1;
      args.push("-vf", `fps=${seqFps}`, "-q:v", "2");
    } else if (isAudioFmt) {
      args.push("-vn");
      if (format === "mp3") args.push("-c:a", "libmp3lame", "-b:a", bitrate || "192k");
      else if (format === "wav") args.push("-c:a", "pcm_s16le");
      else if (format === "flac") args.push("-c:a", "flac");
      else if (format === "ogg") args.push("-c:a", "libvorbis");
      else if (format === "opus") args.push("-c:a", "libopus", "-b:a", bitrate || "128k");
      else args.push("-c:a", "aac", "-b:a", bitrate || "192k");
    } else if (format === "gif") {
      args.push("-vf", "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse");
    } else {
      const enc = format === "mp4-h265" ? (hasEncoder(caps, "hevc_nvenc") ? "hevc_nvenc" : "libx265")
        : format === "webm" ? "libvpx-vp9"
        : encoder;
      args.push("-c:v", enc);
      if (enc.includes("libx264") || enc.includes("libx265")) {
        args.push("-crf", String(crf));
        args.push("-preset", preset);
        if (profile !== "none") args.push("-profile:v", profile);
        if (tune !== "none") args.push("-tune", tune);
      } else if (enc.includes("nvenc")) {
        args.push("-cq:v", String(crf));
        args.push("-preset", "p4");
      } else if (enc.includes("qsv")) {
        args.push("-global_quality", String(crf));
      } else if (enc.includes("vpx")) {
        args.push("-crf", String(crf), "-b:v", "0");
      }
      if (bitrate) args.push("-b:v", bitrate);
      if (maxrate) args.push("-maxrate", maxrate);
      if (bufsize) args.push("-bufsize", bufsize);
      args.push("-g", String(gop));
      if (format === "mp4" || format === "mp4-h265" || format === "mov") {
        args.push("-c:a", audioEncoder, "-b:a", "192k", "-movflags", "+faststart");
      } else if (format === "mkv" || format === "avi") {
        args.push("-c:a", audioEncoder);
      }
    }
    args.push(outputPath);
    return args;
  }

  const handleConvert = async () => {
    if (!nativeAvailable || !media?.file) return;
    setStatus("loading");
    setProgress({ percent: 0 });
    try {
      const ext = selectedFmt.ext;
      const blob = await transcodeBlobNative(media.file, {
        inputExt: media.name.split(".").pop() || "mp4",
        outputExt: ext,
        args: buildArgs("{input}", "{output}"),
        jobId,
        onProgress: (data) => {
          const dur = media.duration || 1;
          const percent = calcProgressPercent(data, dur);
          setProgress({ ...data, percent });
        }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${media.name.replace(/\.[^.]+$/, "")}_converted.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Konversi gagal.");
    }
  };

  const handleCancel = async () => {
    const { cancelNativeJob: cancel } = await import("../../utils/ffmpegRuntime.js");
    await cancel(jobId);
    setStatus("idle");
    setProgress(null);
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[560px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <RefreshCw size={16} />
            Convert / Compress
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-xs">
          <div className="rounded-md border border-[var(--border)] bg-[#141414] p-3">
            <p className="font-medium text-white truncate">{media.name}</p>
            <p className="text-[var(--text-muted)] mt-0.5">{media.type} — {media.duration ? `${media.duration.toFixed(1)}s` : "-"}</p>
          </div>

          <FormRow label="Output Format">
            <ModernSelect
              value={format}
              onChange={setFormat}
              options={[
                { group: true, label: "Video" },
                ...OUTPUT_FORMATS.filter((f) => f.type === "video").map((f) => ({ value: f.value, label: f.label })),
                { group: true, label: "Audio" },
                ...OUTPUT_FORMATS.filter((f) => f.type === "audio").map((f) => ({ value: f.value, label: f.label }))
              ]}
              buttonClassName="h-8"
            />
          </FormRow>

          {isVideoFmt && format !== "gif" && (
            <>
              <FormRow label="Video Encoder">
                <ModernSelect
                  value={encoder}
                  onChange={setEncoder}
                  options={["libx264", "libx265", "libvpx-vp9", "h264_nvenc", "h264_qsv", "h264_amf"].map((enc) => ({
                    value: enc,
                    label: `${enc}${!hasEncoder(caps, enc) && enc !== "libx264" ? " (tidak tersedia)" : ""}`,
                    disabled: enc !== "libx264" && enc !== "libx265" && enc !== "libvpx-vp9" && !hasEncoder(caps, enc)
                  }))}
                  buttonClassName="h-8"
                />
              </FormRow>
              <FormRow label="Audio Encoder">
                <ModernSelect value={audioEncoder} onChange={setAudioEncoder} options={["aac", "libmp3lame", "libopus", "flac", "pcm_s16le"]} buttonClassName="h-8" />
              </FormRow>
              <FormRow label={`CRF: ${crf}`}>
                <input type="range" min="0" max="51" step="1" value={crf} onChange={(e) => setCrf(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
              </FormRow>
              <FormRow label="Bitrate (opsional)">
                <input type="text" value={bitrate} onChange={(e) => setBitrate(e.target.value)} placeholder="misal: 4M, 2000k (kosong = pakai CRF)" className="h-8 w-full rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white placeholder:text-[var(--text-muted)] outline-none" />
              </FormRow>
              <FormRow label="Preset">
                <ModernSelect value={preset} onChange={setPreset} options={PRESETS} buttonClassName="h-8" />
              </FormRow>
              <FormRow label="Profile">
                <ModernSelect value={profile} onChange={setProfile} options={PROFILES} buttonClassName="h-8" />
              </FormRow>
              <FormRow label="Tune">
                <ModernSelect value={tune} onChange={setTune} options={TUNES} buttonClassName="h-8" />
              </FormRow>
              <FormRow label="Maxrate (opsional)">
                <input type="text" value={maxrate} onChange={(e) => setMaxrate(e.target.value)} placeholder="misal: 6M, 4000k" className="h-8 w-full rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white placeholder:text-[var(--text-muted)] outline-none" />
              </FormRow>
              <FormRow label="Bufsize (opsional)">
                <input type="text" value={bufsize} onChange={(e) => setBufsize(e.target.value)} placeholder="misal: 12M, 8000k" className="h-8 w-full rounded-md border border-[var(--border)] bg-[#151515] px-2 text-white placeholder:text-[var(--text-muted)] outline-none" />
              </FormRow>
              <FormRow label={`GOP / Keyint: ${gop}`}>
                <input type="range" min="1" max="300" step="1" value={gop} onChange={(e) => setGop(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
              </FormRow>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={twoPass} onChange={(e) => setTwoPass(e.target.checked)} />
                Two-pass encoding (lebih lambat, kualitas lebih rata)
              </label>
            </>
          )}

          {!nativeAvailable && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-700 bg-yellow-950/30 p-3">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-yellow-400" />
              <p className="text-[11px] text-yellow-300">FFmpeg native tidak tersedia. Install FFmpeg dan jalankan sebagai aplikasi desktop untuk menggunakan fitur ini.</p>
            </div>
          )}

          {progress && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                <span>Mengkonversi... {progress.percent ?? 0}%</span>
                {progress.speed && <span>{progress.speed}x</span>}
                {progress.frame && <span>Frame {progress.frame}</span>}
              </div>
              <div className="h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${progress.percent ?? 0}%` }} />
              </div>
            </div>
          )}

          {status === "done" && (
            <div className="flex items-center gap-2 text-green-400 text-[11px]">
              <CheckCircle size={13} />
              Konversi selesai! File telah didownload.
            </div>
          )}
          {status !== "idle" && status !== "loading" && status !== "done" && (
            <p className="text-[11px] text-red-400">{status}</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-[var(--border)] p-3">
          <button type="button" onClick={onClose} className="flex-1 h-9 rounded-md border border-[var(--border)] text-sm hover:bg-[var(--bg-hover)]">
            Tutup
          </button>
          {status === "loading" ? (
            <button type="button" onClick={handleCancel} className="flex-1 h-9 flex items-center justify-center gap-2 rounded-md bg-red-700 text-sm text-white hover:bg-red-600">
              <X size={15} /> Batalkan
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConvert}
              disabled={!nativeAvailable || !media?.file}
              className="flex-1 h-9 flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "loading" ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Convert
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3">
      <span className="text-[var(--text-muted)]">{label}</span>
      {children}
    </div>
  );
}
