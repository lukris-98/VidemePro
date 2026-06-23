export const DEFAULT_TIMELINE_FPS = 30;
export const BUFFER_TRACK_COUNT = 3;
export const MAIN_TRACK_ID = "main-video";

const TRACK_TITLES = {
  video: "Main",
  overlay: "Overlay",
  audio: "Audio",
  text: "Subtitle"
};

export function secondsToFrames(seconds, fps = DEFAULT_TIMELINE_FPS) {
  return Math.max(0, Math.round((Number(seconds) || 0) * fps));
}

export function framesToSeconds(frames, fps = DEFAULT_TIMELINE_FPS) {
  return Math.max(0, Math.round(Number(frames) || 0) / fps);
}

export function snapSecondsToFrame(seconds, fps = DEFAULT_TIMELINE_FPS) {
  return framesToSeconds(secondsToFrames(seconds, fps), fps);
}

export function snapClipStartToTargets({ rawStart, duration, clips = [], playheadTime = 0, fps = DEFAULT_TIMELINE_FPS, thresholdSeconds = 0, enabled = true }) {
  const frameStart = snapSecondsToFrame(rawStart, fps);
  if (!enabled) return frameStart;

  const frameDuration = snapSecondsToFrame(duration, fps);
  const points = [0, playheadTime, ...clips.flatMap((clip) => [clip.start, clip.end])].map((point) => snapSecondsToFrame(point, fps));
  let best = frameStart;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const startDistance = Math.abs(frameStart - point);
    if (startDistance <= thresholdSeconds && startDistance < bestDistance) {
      best = point;
      bestDistance = startDistance;
    }

    const endDistance = Math.abs(frameStart + frameDuration - point);
    if (endDistance <= thresholdSeconds && endDistance < bestDistance) {
      best = point - frameDuration;
      bestDistance = endDistance;
    }
  }

  return Math.max(0, snapSecondsToFrame(best, fps));
}

export function normalizeClipFrames(clip, fps = DEFAULT_TIMELINE_FPS) {
  const startFrame = resolveFrameField(clip, "start", "startFrame", 0, fps);
  const endFrame = resolveFrameField(clip, "end", "endFrame", clip.start ?? 0, fps);
  const durationFrames = Math.max(1, endFrame - startFrame);
  const nextStartFrame = Math.max(0, startFrame);
  const nextEndFrame = Math.max(nextStartFrame + 1, nextStartFrame + durationFrames);
  const inPointFrame = resolveFrameField(clip, "inPoint", "inPointFrame", 0, fps);
  const outPointFrame = resolveFrameField(clip, "outPoint", "outPointFrame", clip.inPoint ?? 0, fps);

  return {
    ...clip,
    id: clip.id ?? crypto.randomUUID(),
    trackId: clip.trackId ?? null,
    mediaId: clip.mediaId ?? null,
    startFrame: nextStartFrame,
    endFrame: nextEndFrame,
    durationFrames: nextEndFrame - nextStartFrame,
    inPointFrame,
    outPointFrame: Math.max(inPointFrame + 1, outPointFrame),
    start: framesToSeconds(nextStartFrame, fps),
    end: framesToSeconds(nextEndFrame, fps),
    inPoint: framesToSeconds(inPointFrame, fps),
    outPoint: framesToSeconds(Math.max(inPointFrame + 1, outPointFrame), fps),
    speed: clip.speed ?? 1,
    volume: clip.volume ?? 1,
    opacity: clip.opacity ?? 1,
    blendMode: clip.blendMode ?? "normal",
    keyframes: clip.keyframes ?? {},
    linkedItemId: clip.linkedItemId ?? null,
    locked: clip.locked ?? false,
    muted: clip.muted ?? false,
    label: clip.label ?? "blue",
    name: clip.name ?? "Clip",
    metadata: clip.metadata ?? {}
  };
}

function resolveFrameField(clip, secondsKey, frameKey, fallbackSeconds, fps) {
  const secondsValue = clip[secondsKey];
  const frameValue = clip[frameKey];
  if (!Number.isFinite(secondsValue) && Number.isFinite(frameValue)) return frameValue;
  if (!Number.isFinite(secondsValue)) return secondsToFrames(fallbackSeconds, fps);
  const secondsFrame = secondsToFrames(secondsValue, fps);
  if (!Number.isFinite(frameValue)) return secondsFrame;
  return Math.abs(framesToSeconds(frameValue, fps) - secondsValue) < 1 / fps / 2 ? frameValue : secondsFrame;
}

export function createTrack(type, index = 1, patch = {}) {
  const id = patch.id ?? (type === "video" ? MAIN_TRACK_ID : `${type}-${crypto.randomUUID()}`);
  return {
    id,
    type,
    role: type === "video" ? "main" : type,
    name: patch.name ?? `${TRACK_TITLES[type] ?? type} ${type === "video" ? "Track" : index}`,
    muted: false,
    locked: false,
    visible: true,
    solo: false,
    volume: type === "audio" ? 1 : undefined,
    clips: [],
    ...patch
  };
}

export function normalizeTracks(inputTracks = []) {
  const existing = inputTracks.map((track) => ({
    ...track,
    role: track.role ?? (track.id === MAIN_TRACK_ID || track.type === "video" ? "main" : track.type),
    clips: track.clips ?? []
  }));
  const mainTrack = existing.find((track) => track.role === "main" || track.type === "video");
  const overlays = existing.filter((track) => track.type === "overlay" || track.type === "text");
  const audios = existing.filter((track) => track.type === "audio");

  return ensureTimelineBuffers([
    ...(overlays.length ? overlays : [createTrack("overlay", 1)]),
    mainTrack ? { ...mainTrack, id: MAIN_TRACK_ID, type: "video", role: "main", name: "Main Track" } : createTrack("video", 1),
    ...(audios.length ? audios : [createTrack("audio", 1)])
  ]);
}

export function ensureTimelineBuffers(tracks = []) {
  const overlayTracks = tracks.filter((track) => track.type === "overlay" || track.type === "text");
  const mainTrack = tracks.find((track) => track.role === "main" || track.type === "video") ?? createTrack("video", 1);
  const audioTracks = tracks.filter((track) => track.type === "audio");

  const activeOverlays = overlayTracks.filter((track) => track.clips.length > 0 || !track.buffer || track.userTrack);
  const activeAudios = audioTracks.filter((track) => track.clips.length > 0 || !track.buffer || track.userTrack);

  return [
    ...withBufferTracks(activeOverlays, "overlay"),
    { ...mainTrack, id: MAIN_TRACK_ID, type: "video", role: "main", buffer: false, locked: mainTrack.locked ?? false },
    ...withBufferTracks(activeAudios, "audio")
  ];
}

export function selectAutoTrack(tracks, mediaType, requestedTrackId) {
  if (requestedTrackId) {
    const requested = tracks.find((track) => track.id === requestedTrackId);
    if (requested && acceptsMediaType(requested, mediaType)) return requested.id;
  }
  if (mediaType === "audio") return emptiestTrackId(tracks, "audio");
  if (mediaType === "overlay" || mediaType === "sticker") {
    return emptiestTrackId(tracks, "overlay");
  }
  return MAIN_TRACK_ID;
}

export function acceptsMediaType(track, mediaType) {
  if (!track) return false;
  if (!mediaType) return true;
  if (track.role === "main") return mediaType === "video" || mediaType === "image" || mediaType === "photo";
  if (track.type === "audio") return mediaType === "audio";
  if (track.type === "overlay" || track.type === "text") return mediaType !== "audio";
  return true;
}

export function timelineItemsFromTracks(tracks) {
  return tracks.flatMap((track) => track.clips.map((clip) => ({ ...clip, trackId: track.id })));
}

export function migrateTimelineProject(project = {}) {
  const fps = project.timeline?.fps ?? project.fps ?? DEFAULT_TIMELINE_FPS;
  const tracks = normalizeTracks(project.timeline?.tracks ?? project.tracks ?? []);
  const normalizedTracks = tracks.map((track) => ({
    ...track,
    clips: (track.clips ?? []).map((clip) => normalizeClipFrames({ ...clip, trackId: track.id }, fps))
  }));
  const items = timelineItemsFromTracks(normalizedTracks);
  const durationSeconds = Math.max(project.duration ?? project.timeline?.durationSeconds ?? 12, ...items.map((clip) => clip.end ?? 0));

  return {
    ...project,
    tracks: normalizedTracks,
    duration: durationSeconds,
    timeline: {
      ...(project.timeline ?? {}),
      tracks: normalizedTracks,
      items,
      duration: secondsToFrames(durationSeconds, fps),
      durationSeconds,
      durationFrames: secondsToFrames(durationSeconds, fps),
      fps,
      resolution: project.timeline?.resolution ?? { width: 1920, height: 1080 },
      markers: project.timeline?.markers ?? project.markers ?? [],
      keyframes: project.timeline?.keyframes ?? project.keyframes ?? []
    }
  };
}

function withBufferTracks(activeTracks, type) {
  const filledTracks = activeTracks.filter((track) => track.clips.length > 0);
  const emptyTracks = activeTracks.filter((track) => track.clips.length === 0).slice(0, BUFFER_TRACK_COUNT);
  const missing = Math.max(0, BUFFER_TRACK_COUNT - emptyTracks.length);
  const count = filledTracks.length + emptyTracks.length;
  const buffers = Array.from({ length: missing }, (_, index) =>
    createTrack(type, count + index + 1, { buffer: true, name: `${TRACK_TITLES[type]} Buffer ${index + 1}` })
  );
  if (type === "overlay") {
    return [
      ...emptyTracks.map((track, index) => ({ ...track, buffer: !track.userTrack, name: track.name ?? `${TRACK_TITLES[type]} Buffer ${index + 1}` })),
      ...buffers,
      ...filledTracks.map((track) => ({ ...track, buffer: false }))
    ];
  }
  return [
    ...filledTracks.map((track) => ({ ...track, buffer: false })),
    ...emptyTracks.map((track, index) => ({ ...track, buffer: !track.userTrack, name: track.name ?? `${TRACK_TITLES[type]} Buffer ${index + 1}` })),
    ...buffers
  ];
}

function emptiestTrackId(tracks, type) {
  const candidates = tracks.filter((track) => track.type === type);
  return [...candidates].sort((a, b) => a.clips.length - b.clips.length)[0]?.id ?? createTrack(type).id;
}
