export function formatTime(seconds = 0) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatTimecode(seconds = 0, fps = 30) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const frames = Math.floor((safeSeconds - Math.floor(safeSeconds)) * fps);
  return [hours, minutes, secs, frames].map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatAdaptiveTimecode(seconds = 0, fps = 30) {
  const safeSeconds = Math.max(0, seconds);
  if (safeSeconds < 3600) {
    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    const frames = Math.floor((safeSeconds - Math.floor(safeSeconds)) * fps);
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
  }
  return formatTimecode(safeSeconds, fps);
}

export function parseTimecodeInput(input, currentSeconds = 0, fps = 30) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  if (/^[+-]\d+$/.test(raw)) {
    return Math.max(0, currentSeconds + Number(raw) / fps);
  }

  if (raw.includes(":")) {
    const parts = raw.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
    const [hours = 0, minutes = 0, seconds = 0, frames = 0] =
      parts.length === 4 ? parts : parts.length === 3 ? [0, ...parts] : [0, 0, ...parts];
    return hours * 3600 + minutes * 60 + seconds + frames / fps;
  }

  if (/^\d+$/.test(raw)) {
    const padded = raw.padStart(4, "0");
    const frames = Number(padded.slice(-2));
    const seconds = Number(padded.slice(-4, -2));
    const minutesHours = padded.slice(0, -4);
    const minutes = minutesHours.length > 2 ? Number(minutesHours.slice(-2)) : Number(minutesHours || 0);
    const hours = minutesHours.length > 2 ? Number(minutesHours.slice(0, -2) || 0) : 0;
    return hours * 3600 + minutes * 60 + seconds + frames / fps;
  }

  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}
