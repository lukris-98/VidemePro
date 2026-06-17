import { defaultEffects, defaultFilters, defaultTransform } from "./visualEffects.js";

export function migrateClip(clip) {
  return {
    ffmpegFilters: { video: [], audio: [] },
    ffmpegCommands: [],
    renderCacheKey: null,
    proxyMediaId: null,
    metadataVersion: 0,
    ...clip,
    filters: { ...defaultFilters, ...(clip.filters ?? {}) },
    effects: { ...defaultEffects, ...(clip.effects ?? {}) },
    transform: { ...defaultTransform, ...(clip.transform ?? {}) },
    audioFx: clip.audioFx ?? {}
  };
}

export function migrateMedia(media) {
  return {
    metadata: { ffprobe: null },
    capabilities: {},
    proxy: null,
    waveform: null,
    thumbnails: [],
    ...media
  };
}

export function migrateProject(project) {
  if (!project) return project;
  const tracks = (project.tracks ?? []).map((track) => ({
    ...track,
    clips: (track.clips ?? []).map(migrateClip)
  }));
  return {
    ffmpegRuntime: null,
    ffmpegCapabilities: null,
    exportPresets: {},
    customFFmpegPresets: [],
    ...project,
    tracks
  };
}
