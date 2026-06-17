import React, { useState } from "react";
import { Copy, RefreshCw, FolderOpen, Film, Image } from "lucide-react";
import { probeMediaItem, formatBitRate, formatFileSize } from "../../utils/ffprobeService.js";
import { useMediaStore } from "../../store/mediaStore.js";

const TABS = ["Info", "Streams", "Codec", "Raw"];

export function MediaMetadataTabs({ media }) {
  const [tab, setTab] = useState("Info");
  const [refreshing, setRefreshing] = useState(false);
  const updateMediaItem = useMediaStore((state) => state.updateMediaItem);
  const ffprobe = media?.metadata?.ffprobe;

  const handleRefresh = async () => {
    if (!media || refreshing) return;
    setRefreshing(true);
    try {
      const result = await probeMediaItem(media);
      if (result) updateMediaItem(media.id, { metadata: { ffprobe: result } });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopy = () => {
    if (!ffprobe) return;
    navigator.clipboard.writeText(JSON.stringify(ffprobe.raw || ffprobe, null, 2)).catch(() => {});
  };

  const handleReveal = () => {
    const p = media?.file?.path || media?.filePath;
    if (!p && window.videmeNative?.shell?.showItemInFolder) window.videmeNative.shell.showItemInFolder(p);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[#0e0e0e] p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1 text-[11px] font-medium transition ${tab === t ? "bg-[var(--accent)] text-[#07111f]" : "text-[var(--text-muted)] hover:text-white"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-[80px] rounded-md border border-[var(--border)] bg-[#141414] p-3 text-xs">
        {tab === "Info" && <InfoTab media={media} ffprobe={ffprobe} />}
        {tab === "Streams" && <StreamsTab ffprobe={ffprobe} />}
        {tab === "Codec" && <CodecTab ffprobe={ffprobe} />}
        {tab === "Raw" && <RawTab ffprobe={ffprobe} />}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <CmdBtn icon={<Copy size={12} />} label="Copy JSON" onClick={handleCopy} disabled={!ffprobe} />
        <CmdBtn icon={<RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />} label="Refresh" onClick={handleRefresh} disabled={refreshing} />
        <CmdBtn icon={<FolderOpen size={12} />} label="Reveal" onClick={handleReveal} disabled={!media?.file?.path} />
        <CmdBtn icon={<Film size={12} />} label="Proxy" onClick={() => {}} disabled />
        <CmdBtn icon={<Image size={12} />} label="Thumb" onClick={() => {}} disabled />
      </div>
    </div>
  );
}

function InfoTab({ media, ffprobe }) {
  const fmt = ffprobe?.format;
  const rows = [
    ["Nama", media?.name || "-"],
    ["Jenis", media?.type || "-"],
    ["Format", fmt?.longName || fmt?.name || "-"],
    ["Durasi", fmt?.duration != null ? `${fmt.duration.toFixed(3)}s` : (media?.duration ? `${media.duration.toFixed(3)}s` : "-")],
    ["Ukuran", fmt?.size != null ? formatFileSize(fmt.size) : formatFileSize(media?.size)],
    ["Bitrate", fmt?.bitRate ? formatBitRate(fmt.bitRate) : "-"],
    ["Dibuat", fmt?.tags?.creation_time ? new Date(fmt.tags.creation_time).toLocaleString("id-ID") : "-"],
    ["Path", media?.file?.path || media?.filePath || "-"]
  ];
  return <MetaRows rows={rows} />;
}

function StreamsTab({ ffprobe }) {
  if (!ffprobe) return <NoData />;
  const { video, audio, subtitles } = ffprobe;
  return (
    <div className="space-y-3">
      {video && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--accent)]">Video</div>
          <MetaRows rows={[
            ["Codec", video.codec || "-"],
            ["Resolusi", video.width && video.height ? `${video.width}x${video.height}` : "-"],
            ["FPS", video.fps != null ? `${video.fps} fps` : "-"],
            ["Pixel Fmt", video.pixFmt || "-"],
            ["Bitrate", video.bitRate ? formatBitRate(video.bitRate) : "-"],
            ["Color", [video.colorSpace, video.colorRange].filter(Boolean).join(", ") || "-"],
            ["Rotasi", video.rotation ? `${video.rotation}°` : "0°"]
          ]} />
        </div>
      )}
      {audio && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--accent)]">Audio</div>
          <MetaRows rows={[
            ["Codec", audio.codec || "-"],
            ["Sample Rate", audio.sampleRate ? `${audio.sampleRate} Hz` : "-"],
            ["Channels", audio.channels != null ? `${audio.channels} ch` : "-"],
            ["Layout", audio.channelLayout || "-"],
            ["Bitrate", audio.bitRate ? formatBitRate(audio.bitRate) : "-"],
            ["Sample Fmt", audio.sampleFmt || "-"]
          ]} />
        </div>
      )}
      {subtitles?.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase text-[var(--accent)]">Subtitle</div>
          {subtitles.map((s, i) => (
            <div key={i} className="text-[var(--text-secondary)]">
              [{s.index}] {s.codec} {s.language ? `(${s.language})` : ""} {s.title || ""}
            </div>
          ))}
        </div>
      )}
      {!video && !audio && <NoData />}
    </div>
  );
}

function CodecTab({ ffprobe }) {
  if (!ffprobe) return <NoData />;
  const rows = [
    ["Video Codec", ffprobe.video?.codec || "-"],
    ["Video Long", ffprobe.video?.codecLong || "-"],
    ["Profile", ffprobe.video?.profile || "-"],
    ["Level", ffprobe.video?.level != null ? String(ffprobe.video.level) : "-"],
    ["Audio Codec", ffprobe.audio?.codec || "-"],
    ["Audio Long", ffprobe.audio?.codecLong || "-"],
    ["Subtitle", ffprobe.subtitles?.map((s) => s.codec).join(", ") || "-"]
  ];
  return <MetaRows rows={rows} />;
}

function RawTab({ ffprobe }) {
  if (!ffprobe) return <NoData />;
  return (
    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-[var(--text-secondary)]">
      {JSON.stringify(ffprobe.raw || ffprobe, null, 2)}
    </pre>
  );
}

function MetaRows({ rows }) {
  return (
    <dl className="grid gap-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
          <dt className="text-[var(--text-muted)]">{label}</dt>
          <dd className="min-w-0 break-words text-[var(--text-secondary)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NoData() {
  return <p className="text-center text-[var(--text-muted)]">Tidak ada data metadata. Jalankan FFprobe untuk mendapatkan info lengkap.</p>;
}

function CmdBtn({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 transition"
    >
      {icon}
      {label}
    </button>
  );
}
