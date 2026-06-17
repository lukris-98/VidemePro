export function getCaptionClips(tracks) {
  return tracks
    .filter((track) => track.type === "text")
    .flatMap((track) => track.clips)
    .filter((clip) => clip.caption)
    .sort((a, b) => a.start - b.start);
}

export function exportSRT(textClips) {
  return textClips
    .map((clip, index) => `${index + 1}\n${formatSubtitleTime(clip.start, ",")} --> ${formatSubtitleTime(clip.end, ",")}\n${clip.text ?? ""}\n`)
    .join("\n");
}

export function exportVTT(textClips) {
  return `WEBVTT\n\n${textClips
    .map((clip) => `${formatSubtitleTime(clip.start, ".")} --> ${formatSubtitleTime(clip.end, ".")}\n${clip.text ?? ""}\n`)
    .join("\n")}`;
}

export function downloadTextFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatSubtitleTime(seconds, separator) {
  const safe = Math.max(0, seconds || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}${separator}${pad(ms, 3)}`;
}

function pad(value, size = 2) {
  return String(value).padStart(size, "0");
}
