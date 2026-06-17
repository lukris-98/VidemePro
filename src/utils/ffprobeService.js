import { hasNativeFFprobeBridge } from "./ffmpegRuntime.js";

export async function probeFileMetadata(filePath) {
  if (!hasNativeFFprobeBridge() || !filePath) return null;
  try {
    const result = await window.videmeNative.ffprobe.getMetadata(filePath);
    if (!result?.ok || !result.data) return null;
    return normalizeProbeData(result.data);
  } catch {
    return null;
  }
}

export async function probeMediaItem(mediaItem) {
  if (!mediaItem?.file?.path && !mediaItem?.filePath) return null;
  const filePath = mediaItem.file?.path || mediaItem.filePath;
  return probeFileMetadata(filePath);
}

function normalizeProbeData(raw) {
  const fmt = raw.format || {};
  const streams = Array.isArray(raw.streams) ? raw.streams : [];
  const videoStream = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const coverArtStream = streams.find((s) => s.codec_type === "video" && s.disposition?.attached_pic);
  const audioStream = streams.find((s) => s.codec_type === "audio");
  const subtitleStreams = streams.filter((s) => s.codec_type === "subtitle");

  return {
    raw,
    format: {
      name: fmt.format_name || null,
      longName: fmt.format_long_name || null,
      duration: fmt.duration ? parseFloat(fmt.duration) : null,
      size: fmt.size ? parseInt(fmt.size) : null,
      bitRate: fmt.bit_rate ? parseInt(fmt.bit_rate) : null,
      startTime: fmt.start_time ? parseFloat(fmt.start_time) : null,
      tags: fmt.tags || {}
    },
    video: videoStream ? {
      codec: videoStream.codec_name || null,
      codecLong: videoStream.codec_long_name || null,
      width: videoStream.width || null,
      height: videoStream.height || null,
      fps: parseFPS(videoStream.r_frame_rate || videoStream.avg_frame_rate),
      pixFmt: videoStream.pix_fmt || null,
      colorRange: videoStream.color_range || null,
      colorSpace: videoStream.color_space || null,
      bitRate: videoStream.bit_rate ? parseInt(videoStream.bit_rate) : null,
      profile: videoStream.profile || null,
      level: videoStream.level || null,
      rotation: parseRotation(videoStream.side_data_list),
      duration: videoStream.duration ? parseFloat(videoStream.duration) : null,
      index: videoStream.index
    } : null,
    audio: audioStream ? {
      codec: audioStream.codec_name || null,
      codecLong: audioStream.codec_long_name || null,
      sampleRate: audioStream.sample_rate ? parseInt(audioStream.sample_rate) : null,
      channels: audioStream.channels || null,
      channelLayout: audioStream.channel_layout || null,
      bitRate: audioStream.bit_rate ? parseInt(audioStream.bit_rate) : null,
      sampleFmt: audioStream.sample_fmt || null,
      duration: audioStream.duration ? parseFloat(audioStream.duration) : null,
      index: audioStream.index
    } : null,
    subtitles: subtitleStreams.map((s) => ({
      codec: s.codec_name || null,
      language: s.tags?.language || null,
      title: s.tags?.title || null,
      index: s.index
    })),
    streams,
    coverArt: coverArtStream ? {
      codec: coverArtStream.codec_name || null,
      width: coverArtStream.width || null,
      height: coverArtStream.height || null,
      index: coverArtStream.index
    } : null,
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
    hasSubtitles: subtitleStreams.length > 0,
    hasCoverArt: Boolean(coverArtStream)
  };
}

function parseFPS(frStr) {
  if (!frStr) return null;
  const parts = frStr.split("/");
  if (parts.length === 2) {
    const num = parseFloat(parts[0]);
    const den = parseFloat(parts[1]);
    if (den > 0) return Math.round((num / den) * 1000) / 1000;
  }
  return parseFloat(frStr) || null;
}

function parseRotation(sideDataList) {
  if (!Array.isArray(sideDataList)) return 0;
  for (const data of sideDataList) {
    if (data.type === "Display Matrix" && typeof data.rotation === "number") {
      return data.rotation;
    }
  }
  return 0;
}

export function formatBitRate(bps) {
  if (!bps || bps <= 0) return "-";
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${bps} bps`;
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) { value /= 1024; idx++; }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}
