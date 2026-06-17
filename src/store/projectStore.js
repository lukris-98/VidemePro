import { create } from "zustand";
import { defaultAutoReframe, defaultBgRemove, defaultFaceBlur } from "../utils/aiEffects.js";
import { emitEvent } from "../utils/eventBus.js";
import {
  DEFAULT_TIMELINE_FPS,
  MAIN_TRACK_ID,
  ensureTimelineBuffers,
  normalizeClipFrames,
  normalizeTracks,
  secondsToFrames,
  selectAutoTrack,
  timelineItemsFromTracks
} from "../utils/timelineEngine.js";
import { builtinStickers, defaultEffects, defaultFilters, defaultTransform } from "../utils/visualEffects.js";

const initialTracks = normalizeTracks([]);
const initialTimeline = buildTimeline(initialTracks, 12);

function snapshot(state) {
  return {
    tracks: structuredClone(state.tracks),
    timeline: structuredClone(state.timeline),
    markers: structuredClone(state.markers),
    keyframes: structuredClone(state.keyframes),
    duration: state.duration,
    selectedClipId: state.selectedClipId,
    selectedClipIds: state.selectedClipIds
  };
}

function recalcDuration(tracks) {
  return tracks.reduce((max, track) => {
    const trackMax = track.clips.reduce((clipMax, clip) => Math.max(clipMax, clip.end), 0);
    return Math.max(max, trackMax);
  }, 12);
}

export const useProjectStore = create((set, get) => ({
  projectName: "0525",
  projectThumbnailUrl: "",
  tracks: initialTracks,
  timeline: initialTimeline,
  markers: [],
  keyframes: [],
  duration: 12,
  selectedClipId: null,
  selectedClipIds: [],
  ffmpegRuntime: null,
  ffmpegCapabilities: null,
  exportPresets: {},
  customFFmpegPresets: [],
  setFFmpegCapabilities: (capabilities) => set({ ffmpegCapabilities: capabilities, ffmpegRuntime: capabilities?.available ? "native" : "unavailable" }),
  history: [{ tracks: initialTracks, timeline: initialTimeline, markers: [], keyframes: [], duration: 12, selectedClipId: null, selectedClipIds: [] }],
  historyIndex: 0,
  canUndo: false,
  canRedo: false,
  copiedClip: null,
  addTrack: (type = "overlay") =>
    set((state) => {
      if (type === "video") return state;
      const count = state.tracks.filter((track) => track.type === type).length + 1;
      const nextTrack = {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        name: `${type.charAt(0).toUpperCase()}${type.slice(1)} ${count}`,
        muted: false,
        locked: false,
        visible: true,
        clips: []
      };
      emitEvent("timeline:track-added", { track: nextTrack });
      return commitState(state, { tracks: ensureTimelineBuffers([...state.tracks, nextTrack]) });
    }),
  renameTrack: (trackId, name) =>
    set((state) =>
      commitState(state, {
        tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, buffer: false, userTrack: true, name: name.trim() || track.name } : track))
      })
    ),
  setTrackLocked: (trackId, locked) =>
    set((state) =>
      commitState(state, {
        tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, buffer: false, userTrack: true, locked } : track))
      })
    ),
  setTrackVisible: (trackId, visible) =>
    set((state) =>
      commitState(state, {
        tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, buffer: false, userTrack: true, visible } : track))
      })
    ),
  toggleTrackExpanded: (trackId) =>
    set((state) =>
      commitState(state, {
        tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, buffer: false, userTrack: true, expanded: !track.expanded } : track))
      })
    ),
  reorderTrack: (sourceTrackId, targetTrackId) =>
    set((state) => {
      const source = state.tracks.find((track) => track.id === sourceTrackId);
      const target = state.tracks.find((track) => track.id === targetTrackId);
      if (!source || !target || source.role === "main" || target.role === "main") return state;
      if (!["overlay", "audio", "text"].includes(source.type) || source.type !== target.type) return state;
      const tracks = state.tracks.filter((track) => track.id !== sourceTrackId);
      const targetIndex = tracks.findIndex((track) => track.id === targetTrackId);
      tracks.splice(Math.max(0, targetIndex), 0, source);
      return commitState(state, { tracks: ensureTimelineBuffers(tracks) });
    }),
  setProjectThumbnail: (projectThumbnailUrl) => set({ projectThumbnailUrl }),
  removeTrack: (id) =>
    set((state) => {
      const target = state.tracks.find((track) => track.id === id);
      if (!target || target.role === "main" || target.id === MAIN_TRACK_ID || target.clips.length) return state;
      const tracks = state.tracks.filter((track) => track.id !== id);
      emitEvent("timeline:track-removed", { trackId: id });
      return commitState(state, { tracks, duration: recalcDuration(tracks) });
    }),
  addClip: (trackId, clip) =>
    set((state) => {
      const resolvedTrackId = selectAutoTrack(state.tracks, clip.type ?? clip.mediaType, trackId);
      const targetTrack = state.tracks.find((track) => track.id === resolvedTrackId);
      if (!targetTrack) return state;
      const inferredDuration = Math.max(0.1, (clip.end ?? 0) - (clip.start ?? 0));
      const mediaDuration = clip.mediaDuration ?? clip.duration ?? inferredDuration ?? 5;
      const start = Math.max(0, clip.start ?? 0);
      const requestedEnd = clip.end ?? start + mediaDuration;
      const end = Math.max(start + 0.1, requestedEnd);
      const safeStart = findAvailableStart(targetTrack.clips, start, end - start);
      const nextClip = {
        id: clip.id ?? crypto.randomUUID(),
        trackId: resolvedTrackId,
        start: safeStart,
        end: safeStart + (end - start),
        offset: clip.offset ?? 0,
        inPoint: clip.inPoint ?? 0,
        outPoint: clip.outPoint ?? mediaDuration,
        mediaDuration,
        volume: clip.volume ?? 1,
        fadeIn: clip.fadeIn ?? 0,
        fadeOut: clip.fadeOut ?? 0,
        speed: clip.speed ?? 1,
        preservePitch: clip.preservePitch ?? true,
        transition: clip.transition ?? { type: "none", duration: 0 },
        filters: clip.filters ?? structuredClone(defaultFilters),
        colorGrading: clip.colorGrading ?? {},
        effects: clip.effects ?? structuredClone(defaultEffects),
        transform: clip.transform ?? structuredClone(defaultTransform),
        bgRemove: clip.bgRemove ?? structuredClone(defaultBgRemove),
        faceBlur: clip.faceBlur ?? structuredClone(defaultFaceBlur),
        autoReframe: clip.autoReframe ?? structuredClone(defaultAutoReframe),
        voiceEffect: clip.voiceEffect ?? { enabled: false, type: "none", pitchShift: 0, intensity: 0.5 },
        noiseReduction: clip.noiseReduction ?? { enabled: false, intensity: 0 },
        audioFx: clip.audioFx ?? {},
        ffmpegFilters: clip.ffmpegFilters ?? { video: [], audio: [] },
        ffmpegCommands: clip.ffmpegCommands ?? [],
        renderCacheKey: clip.renderCacheKey ?? null,
        proxyMediaId: clip.proxyMediaId ?? null,
        metadataVersion: clip.metadataVersion ?? 0,
        color: clip.color,
        ...clip
      };
      nextClip.start = safeStart;
      nextClip.end = safeStart + (end - start);
      const normalizedClip = normalizeClipFrames(nextClip, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      const tracks = state.tracks.map((track) =>
        track.id === resolvedTrackId ? { ...track, buffer: false, clips: [...track.clips, normalizedClip] } : track
      );
      const tracksWithAudio = addLinkedAudioCompanion(tracks, normalizedClip, clip, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      emitEvent("timeline:item-added", { item: normalizedClip, trackId: resolvedTrackId });
      return commitState(state, { tracks: tracksWithAudio, duration: recalcDuration(tracksWithAudio), selectedClipId: normalizedClip.id });
    }),
  removeClip: (clipId) =>
    set((state) => {
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => clip.id !== clipId)
      }));
      emitEvent("timeline:item-deleted", { itemIds: [clipId] });
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: null });
    }),
  removeClips: (clipIds) =>
    set((state) => {
      const ids = new Set(clipIds ?? []);
      if (!ids.size) return state;
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => !ids.has(clip.id))
      }));
      emitEvent("timeline:item-deleted", { itemIds: [...ids] });
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: null, selectedClipIds: [] });
    }),
  removeSelectedClip: () => {
    const state = get();
    const ids = state.selectedClipIds?.length ? state.selectedClipIds : state.selectedClipId ? [state.selectedClipId] : [];
    if (ids.length) get().removeClips(ids);
  },
  moveClip: (clipId, newStart, newTrackId) =>
    set((state) => {
      let movedClip = null;
      const tracksWithoutClip = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.filter((clip) => {
          if (clip.id === clipId) {
            movedClip = clip;
            return false;
          }
          return true;
        })
      }));
      if (!movedClip) return state;
      const length = movedClip.end - movedClip.start;
      const targetTrackId = selectAutoTrack(tracksWithoutClip, movedClip.type ?? movedClip.mediaType, newTrackId ?? movedClip.trackId);
      const targetTrack = tracksWithoutClip.find((track) => track.id === targetTrackId);
      const safeStart = findAvailableStart(targetTrack?.clips ?? [], Math.max(0, newStart), length);
      const tracks = tracksWithoutClip.map((track) =>
        track.id === targetTrackId
          ? { ...track, buffer: false, clips: [...track.clips, normalizeClipFrames({ ...movedClip, trackId: targetTrackId, start: safeStart, end: safeStart + length }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)] }
          : track
      );
      emitEvent("timeline:item-moved", { itemId: clipId, trackId: targetTrackId, start: safeStart });
      return commitState(state, { tracks, duration: recalcDuration(tracks) });
    }),
  moveSelectedClips: (anchorClipId, newAnchorStart) =>
    set((state) => {
      const selectedIds = state.selectedClipIds?.length ? state.selectedClipIds : anchorClipId ? [anchorClipId] : [];
      if (selectedIds.length <= 1) return state;
      const selected = selectedIds.map((id) => findClipById(state.tracks, id)).filter(Boolean);
      const anchor = selected.find((clip) => clip.id === anchorClipId);
      if (!anchor) return state;
      const minStart = Math.min(...selected.map((clip) => clip.start));
      const requestedDelta = newAnchorStart - anchor.start;
      const delta = minStart + requestedDelta < 0 ? -minStart : requestedDelta;
      const ids = new Set(selected.map((clip) => clip.id));
      const movedById = new Map(selected.map((clip) => [clip.id, normalizeClipFrames({ ...clip, start: clip.start + delta, end: clip.end + delta }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)]));
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (ids.has(clip.id) ? movedById.get(clip.id) : clip))
      }));
      emitEvent("timeline:item-moved", { itemIds: [...ids], delta, anchorClipId });
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: anchorClipId, selectedClipIds: selected.map((clip) => clip.id) });
    }),
  trimClip: (clipId, payload, maybeEnd) =>
    set((state) => {
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => {
          if (clip.id !== clipId) return clip;
          if (typeof payload === "object") {
            return normalizeClipFrames(clampTrim({ ...clip, ...payload }), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
          }
          return normalizeClipFrames(clampTrim({ ...clip, start: payload, end: maybeEnd }), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
        })
      }));
      emitEvent("timeline:item-trimmed", { itemId: clipId, payload });
      return commitState(state, { tracks, duration: recalcDuration(tracks) });
    }),
  splitClip: (clipId, atTime) =>
    set((state) => {
      let didSplit = false;
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.flatMap((clip) => {
          if (clip.id !== clipId || atTime <= clip.start || atTime >= clip.end) return clip;
          didSplit = true;
          const splitOffset = atTime - clip.start;
          const inPoint = clip.inPoint ?? 0;
          const splitPoint = inPoint + splitOffset;
          return [
            normalizeClipFrames({ ...clip, end: atTime, outPoint: splitPoint }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS),
            normalizeClipFrames({ ...clip, id: crypto.randomUUID(), start: atTime, inPoint: splitPoint, offset: (clip.offset ?? 0) + splitOffset }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)
          ];
        })
      }));
      if (!didSplit) return state;
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: null });
    }),
  splitSelectedAt: (atTime) => {
    const state = get();
    const selectedIds = state.selectedClipIds?.length ? state.selectedClipIds : state.selectedClipId ? [state.selectedClipId] : [];
    const selectedClips = selectedIds
      .map((id) => findClipById(state.tracks, id))
      .filter((clip) => clip && atTime > clip.start && atTime < clip.end);
    const clips = selectedClips.length
      ? selectedClips
      : state.tracks.flatMap((track) => track.clips).filter((item) => atTime > item.start && atTime < item.end);
    clips.forEach((clip) => get().splitClip(clip.id, atTime));
  },
  findClipAtTime: (trackId, time) => {
    const state = get();
    const track = state.tracks.find((item) => item.id === trackId);
    return track?.clips.find((clip) => time > clip.start && time < clip.end) ?? null;
  },
  freezeInsert: (trackId, clip) =>
    set((state) => {
      const insertDuration = clip.end - clip.start;
      const tracks = state.tracks.map((track) => {
        if (track.id !== trackId) return track;
        return {
          ...track,
          clips: [
            ...track.clips.map((item) =>
              item.start >= clip.start
                ? normalizeClipFrames({ ...item, start: item.start + insertDuration, end: item.end + insertDuration }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)
                : item
            ),
            normalizeClipFrames(clip, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)
          ]
        };
      });
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clip.id });
    }),
  selectClip: (clipId, mode = "replace") =>
    set((state) => {
      if (!clipId) return { selectedClipId: null, selectedClipIds: [] };
      if (mode === "range") {
        const selectedClipIds = expandLinkedSelection(state.tracks, selectClipRange(state.tracks, state.selectedClipId, clipId));
        emitEvent("timeline:selection-changed", { selection: selectedClipIds });
        return { selectedClipIds, selectedClipId: clipId };
      }
      const groupIds = expandLinkedSelection(state.tracks, [clipId]);
      if (mode === "toggle") {
        const existing = new Set(state.selectedClipIds?.length ? state.selectedClipIds : state.selectedClipId ? [state.selectedClipId] : []);
        const shouldRemove = groupIds.every((id) => existing.has(id));
        groupIds.forEach((id) => {
          if (shouldRemove) existing.delete(id);
          else existing.add(id);
        });
        const selectedClipIds = [...existing];
        emitEvent("timeline:selection-changed", { selection: selectedClipIds });
        return { selectedClipIds, selectedClipId: selectedClipIds.at(-1) ?? null };
      }
      if (mode === "add") {
        const selectedClipIds = [...new Set([...(state.selectedClipIds ?? []), ...groupIds])];
        emitEvent("timeline:selection-changed", { selection: selectedClipIds });
        return { selectedClipIds, selectedClipId: clipId };
      }
      emitEvent("timeline:selection-changed", { selection: groupIds });
      return { selectedClipId: clipId, selectedClipIds: groupIds };
    }),
  selectClips: (clipIds) => {
    set((state) => {
      const selectedClipIds = expandLinkedSelection(state.tracks, clipIds ?? []);
      emitEvent("timeline:selection-changed", { selection: selectedClipIds });
      return { selectedClipIds, selectedClipId: selectedClipIds[0] ?? null };
    });
  },
  updateClip: (clipId, patch) =>
    set((state) => {
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? normalizeClipFrames(normalizeClipTiming({ ...clip, ...patch }), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS) : clip))
      }));
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clipId });
    }),
  updateClipLive: (clipId, patch) =>
    set((state) => ({
      tracks: state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) => (clip.id === clipId ? normalizeClipFrames(normalizeClipTiming({ ...clip, ...patch }), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS) : clip))
      }))
    })),
  addTextClip: (start = 0) =>
    set((state) => {
      const textTrack = state.tracks.find((track) => track.type === "text") ?? state.tracks[0];
      if (!textTrack) return state;
      const clip = normalizeClipFrames(createTextClip(textTrack.id, start), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      const tracks = state.tracks.map((track) =>
        track.id === textTrack.id ? { ...track, clips: [...track.clips, clip] } : track
      );
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clip.id });
    }),
  addStickerClip: (stickerId, start = 0) =>
    set((state) => {
      const overlayTrack = state.tracks.find((track) => track.type === "overlay") ?? state.tracks[0];
      const sticker = builtinStickers.find((item) => item.id === stickerId) ?? builtinStickers[0];
      if (!overlayTrack || !sticker) return state;
      const clip = normalizeClipFrames(createStickerClip(overlayTrack.id, sticker, start), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      const tracks = state.tracks.map((track) =>
        track.id === overlayTrack.id ? { ...track, clips: [...track.clips, clip] } : track
      );
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clip.id });
    }),
  addOverlayTemplate: (templateType = "shape", start = 0) =>
    set((state) => {
      const overlayTrack = state.tracks.find((track) => track.type === "overlay") ?? state.tracks[0];
      if (!overlayTrack) return state;
      const clip = normalizeClipFrames(createOverlayTemplateClip(overlayTrack.id, templateType, start), state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      const tracks = state.tracks.map((track) =>
        track.id === overlayTrack.id ? { ...track, buffer: false, clips: [...track.clips, clip] } : track
      );
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clip.id });
    }),
  addCaptionClips: (captionClips) =>
    set((state) => {
      if (!captionClips?.length) return state;
      const existing = state.tracks.find((track) => track.name === "Auto Caption");
      const captionTrack =
        existing ?? { id: `text-${crypto.randomUUID()}`, type: "text", name: "Auto Caption", muted: false, locked: false, visible: true, clips: [] };
      const clips = captionClips.map((clip) =>
        normalizeClipFrames({ ...clip, id: clip.id ?? crypto.randomUUID(), trackId: captionTrack.id, caption: true }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)
      );
      const tracks = existing
        ? state.tracks.map((track) => (track.id === captionTrack.id ? { ...track, clips: [...track.clips, ...clips] } : track))
        : [...state.tracks, { ...captionTrack, clips }];
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clips[0]?.id ?? state.selectedClipId });
    }),
  applySmartCut: (clipId, ranges) =>
    set((state) => {
      const sourceClip = findClipById(state.tracks, clipId);
      if (!sourceClip || !ranges?.length) return state;
      const sortedRanges = ranges
        .map((range) => ({ start: Math.max(sourceClip.start, range.start), end: Math.min(sourceClip.end, range.end) }))
        .filter((range) => range.end - range.start > 0.05)
        .sort((a, b) => a.start - b.start);
      if (!sortedRanges.length) return state;
      const removedBefore = (time) => sortedRanges.reduce((sum, range) => sum + Math.max(0, Math.min(time, range.end) - range.start), 0);
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips
          .flatMap((clip) => {
            if (clip.id !== clipId) {
              const shift = removedBefore(clip.start);
              return [normalizeClipFrames({ ...clip, start: Math.max(0, clip.start - shift), end: Math.max(0.1, clip.end - shift) }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS)];
            }
            const keepSegments = [];
            let cursor = clip.start;
            for (const range of sortedRanges) {
              if (range.start > cursor) keepSegments.push({ start: cursor, end: range.start });
              cursor = Math.max(cursor, range.end);
            }
            if (cursor < clip.end) keepSegments.push({ start: cursor, end: clip.end });
            return keepSegments.map((segment, index) => {
              const newStart = segment.start - removedBefore(segment.start);
              const length = segment.end - segment.start;
              return normalizeClipFrames({
                ...clip,
                id: index === 0 ? clip.id : crypto.randomUUID(),
                start: newStart,
                end: newStart + length,
                inPoint: (clip.inPoint ?? 0) + (segment.start - clip.start) * (clip.speed ?? 1),
                outPoint: (clip.inPoint ?? 0) + (segment.end - clip.start) * (clip.speed ?? 1)
              }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
            });
          })
          .filter((clip) => clip.end - clip.start > 0.05)
      }));
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: clipId });
    }),
  addMarker: (frame, label = "Marker", color = "#4d9eff", type = "standard") =>
    set((state) => {
      const marker = { id: crypto.randomUUID(), frame: Math.max(0, Math.round(frame)), label, color, type };
      emitEvent("timeline:marker-added", { marker });
      return commitState(state, { markers: [...state.markers, marker] });
    }),
  addKeyframe: (clipId, propertyName, frame, value, easing = "linear") =>
    set((state) => {
      const keyframe = { id: crypto.randomUUID(), clipId, propertyName, frame: Math.max(0, Math.round(frame)), value, easing };
      emitEvent("timeline:keyframe-added", { keyframe });
      return commitState(state, { keyframes: [...state.keyframes, keyframe] });
    }),
  applyEffect: (clipId, effectId, params = {}) =>
    set((state) => {
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((clip) =>
          clip.id === clipId
            ? { ...clip, effects: { ...(clip.effects ?? {}), [effectId]: params } }
            : clip
        )
      }));
      emitEvent("timeline:effect-applied", { clipId, effectId, params });
      return commitState(state, { tracks, selectedClipId: clipId });
    }),
  duplicateSelectedClip: () =>
    set((state) => {
      const selected = findClipById(state.tracks, state.selectedClipId);
      if (!selected) return state;
      const copy = normalizeClipFrames({ ...structuredClone(selected), id: crypto.randomUUID(), start: selected.end, end: selected.end + (selected.end - selected.start) }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      const tracks = state.tracks.map((track) =>
        track.id === selected.trackId ? { ...track, clips: [...track.clips, copy] } : track
      );
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: copy.id });
    }),
  copySelectedClip: () => {
    const state = get();
    const selected = findClipById(state.tracks, state.selectedClipId);
    if (selected) set({ copiedClip: structuredClone(selected) });
  },
  pasteClip: (startTime = 0) =>
    set((state) => {
      if (!state.copiedClip) return state;
      const source = state.copiedClip;
      const duration = source.end - source.start;
      const copy = normalizeClipFrames({ ...structuredClone(source), id: crypto.randomUUID(), start: Math.max(0, startTime), end: Math.max(0, startTime) + duration }, state.timeline?.fps ?? DEFAULT_TIMELINE_FPS);
      const tracks = state.tracks.map((track) =>
        track.id === source.trackId ? { ...track, clips: [...track.clips, copy] } : track
      );
      return commitState(state, { tracks, duration: recalcDuration(tracks), selectedClipId: copy.id });
    }),
  trimSelectedIn: (time) => {
    const state = get();
    const clip = findClipById(state.tracks, state.selectedClipId);
    if (clip && time > clip.start && time < clip.end) {
      get().trimClip(clip.id, { start: time, inPoint: (clip.inPoint ?? 0) + (time - clip.start) * (clip.speed ?? 1) });
    }
  },
  trimSelectedOut: (time) => {
    const state = get();
    const clip = findClipById(state.tracks, state.selectedClipId);
    if (clip && time > clip.start && time < clip.end) {
      get().trimClip(clip.id, { end: time, outPoint: (clip.inPoint ?? 0) + (time - clip.start) * (clip.speed ?? 1) });
    }
  },
  muteSelectedTrack: () =>
    set((state) => {
      const clip = findClipById(state.tracks, state.selectedClipId);
      if (!clip) return state;
      const tracks = state.tracks.map((track) => (track.id === clip.trackId ? { ...track, muted: !track.muted } : track));
      return commitState(state, { tracks });
    }),
  stabilizeSelectedClip: (strength = 50, crop = 8) =>
    set((state) => {
      const clip = findClipById(state.tracks, state.selectedClipId);
      if (!clip) return state;
      const tracks = state.tracks.map((track) => ({
        ...track,
        clips: track.clips.map((item) =>
          item.id === clip.id
            ? { ...item, stabilized: true, stabilization: { strength, crop }, transform: { ...defaultTransform, ...(item.transform ?? {}), scaleX: 1 + crop / 100, scaleY: 1 + crop / 100 } }
            : item
        )
      }));
      return commitState(state, { tracks, selectedClipId: clip.id });
    }),
  selectAllClips: () =>
    set((state) => {
      const selectedClipIds = state.tracks.flatMap((track) => track.clips.map((clip) => clip.id));
      return { selectedClipId: selectedClipIds[0] ?? null, selectedClipIds };
    }),
  deselectAll: () => {
    emitEvent("timeline:selection-changed", { selection: [] });
    set({ selectedClipId: null, selectedClipIds: [] });
  },
  setTrackMuted: (trackId, muted) =>
    set((state) => commitState(state, { tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, muted } : track)) })),
  setTrackSolo: (trackId) =>
    set((state) =>
      commitState(state, {
        tracks: state.tracks.map((track) => ({ ...track, solo: track.id === trackId ? !track.solo : false }))
      })
    ),
  setTrackVolume: (trackId, volume) =>
    set((state) =>
      commitState(state, {
        tracks: state.tracks.map((track) => (track.id === trackId ? { ...track, volume } : track))
      })
    ),
  undo: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const nextIndex = state.historyIndex - 1;
    const target = state.history[nextIndex];
    set(deriveHistoryFlags({ ...target, historyIndex: nextIndex, history: state.history }));
  },
  redo: () => {
    const state = get();
    const nextIndex = state.historyIndex + 1;
    if (nextIndex >= state.history.length) return;
    const target = state.history[nextIndex];
    if (!target) return;
    set(deriveHistoryFlags({ ...target, historyIndex: nextIndex, history: state.history }));
  }
}));

function deriveHistoryFlags(patch) {
  const history = patch.history ?? [];
  const historyIndex = patch.historyIndex ?? 0;
  return {
    ...patch,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}

function commitState(state, patch) {
  const fps = patch.timeline?.fps ?? state.timeline?.fps ?? DEFAULT_TIMELINE_FPS;
  const tracks = ensureTimelineBuffers((patch.tracks ?? state.tracks).map((track) => ({
    ...track,
    clips: (track.clips ?? []).map((clip) => normalizeClipFrames({ ...clip, trackId: track.id }, fps))
  })));
  const duration = patch.duration ?? recalcDuration(tracks);
  const nextState = {
    tracks,
    markers: patch.markers ?? state.markers ?? [],
    keyframes: patch.keyframes ?? state.keyframes ?? [],
    timeline: buildTimeline(tracks, duration, fps, patch.markers ?? state.markers ?? [], patch.keyframes ?? state.keyframes ?? []),
    duration,
    selectedClipId: Object.prototype.hasOwnProperty.call(patch, "selectedClipId") ? patch.selectedClipId : state.selectedClipId,
    selectedClipIds: Object.prototype.hasOwnProperty.call(patch, "selectedClipIds")
      ? patch.selectedClipIds
      : Object.prototype.hasOwnProperty.call(patch, "selectedClipId")
        ? patch.selectedClipId ? [patch.selectedClipId] : []
        : state.selectedClipIds?.length
          ? state.selectedClipIds
          : state.selectedClipId
            ? [state.selectedClipId]
            : []
  };
  const history = state.history.slice(0, state.historyIndex + 1);
  history.push(structuredClone(nextState));
  const trimmed = history.slice(-100);
  const historyIndex = trimmed.length - 1;
  return deriveHistoryFlags({
    ...patch,
    ...nextState,
    history: trimmed,
    historyIndex
  });
}

function buildTimeline(tracks, duration = 12, fps = DEFAULT_TIMELINE_FPS, markers = [], keyframes = []) {
  const durationFrames = secondsToFrames(duration, fps);
  return {
    tracks,
    items: timelineItemsFromTracks(tracks),
    duration: durationFrames,
    durationSeconds: duration,
    durationFrames,
    fps,
    resolution: { width: 1920, height: 1080 },
    markers,
    keyframes
  };
}

function findClipById(tracks, clipId) {
  if (!clipId) return null;
  return tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId) ?? null;
}

function timelineClipOrder(tracks) {
  return tracks.flatMap((track, trackIndex) =>
    track.clips.map((clip) => ({ id: clip.id, trackIndex, startFrame: clip.startFrame ?? secondsToFrames(clip.start ?? 0), start: clip.start ?? 0 }))
  ).sort((a, b) => a.trackIndex - b.trackIndex || a.startFrame - b.startFrame || a.start - b.start);
}

function selectClipRange(tracks, fromId, toId) {
  const order = timelineClipOrder(tracks);
  const toIndex = order.findIndex((clip) => clip.id === toId);
  if (toIndex < 0) return [toId];
  const fromIndex = order.findIndex((clip) => clip.id === fromId);
  if (fromIndex < 0) return [toId];
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return order.slice(start, end + 1).map((clip) => clip.id);
}

function expandLinkedSelection(tracks, clipIds) {
  const ids = new Set(clipIds.filter(Boolean));
  let changed = true;
  while (changed) {
    changed = false;
    for (const clip of tracks.flatMap((track) => track.clips)) {
      if (ids.has(clip.id) && clip.linkedItemId && !ids.has(clip.linkedItemId)) {
        ids.add(clip.linkedItemId);
        changed = true;
      }
      if (clip.linkedItemId && ids.has(clip.linkedItemId) && !ids.has(clip.id)) {
        ids.add(clip.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

function clampTrim(clip) {
  const minLength = 0.1;
  const mediaDuration = clip.mediaDuration ?? clip.outPoint ?? clip.end - clip.start;
  const inPoint = Math.max(0, Math.min(clip.inPoint ?? 0, mediaDuration - minLength));
  const outPoint = Math.max(inPoint + minLength, Math.min(clip.outPoint ?? mediaDuration, mediaDuration));
  const start = Math.max(0, clip.start);
  const end = Math.max(start + minLength, clip.end);
  return { ...clip, inPoint, outPoint, start, end };
}

function normalizeClipTiming(clip) {
  if (clip.speed && clip.speed > 0 && clip.inPoint !== undefined && clip.outPoint !== undefined) {
    return { ...clip, end: clip.start + (clip.outPoint - clip.inPoint) / clip.speed };
  }
  return clip;
}

function createTextClip(trackId, start) {
  return {
    id: crypto.randomUUID(),
    trackId,
    mediaId: null,
    type: "text",
    name: "Text",
    start,
    end: start + 4,
    inPoint: 0,
    outPoint: 4,
    mediaDuration: 4,
    color: "#ffffff",
    timelineColor: "var(--clip-text)",
    text: "Hello World",
    fontFamily: "Arial",
    fontSize: 48,
    fontWeight: "bold",
    backgroundColor: "transparent",
    padding: 8,
    align: "center",
    posX: 0.5,
    posY: 0.85,
    animation: "fadeIn",
    animDuration: 0.5
  };
}

function createStickerClip(trackId, sticker, start) {
  return {
    id: crypto.randomUUID(),
    trackId,
    type: "sticker",
    name: sticker.name,
    start,
    end: start + 4,
    src: sticker.src,
    posX: 0.5,
    posY: 0.5,
    scaleX: 0.22,
    scaleY: 0.22,
    rotation: 0,
    opacity: 1,
    animation: "bounce",
    animDuration: 0.5,
    timelineColor: "var(--clip-text)"
  };
}

function createOverlayTemplateClip(trackId, templateType, start) {
  const presets = {
    shape: { name: "Shape", shape: "rectangle", color: "#4d9eff", opacity: 0.8, scaleX: 0.35, scaleY: 0.2 },
    watermark: { name: "Watermark", text: "VidmePro+", opacity: 0.35, posX: 0.78, posY: 0.84, fontSize: 28 },
    lowerThird: { name: "Lower Third", text: "Title\\nSubtitle", posX: 0.28, posY: 0.78, fontSize: 36 },
    titleCard: { name: "Title Card", text: "Title", posX: 0.5, posY: 0.5, fontSize: 64 },
    endScreen: { name: "End Screen", text: "Thanks for watching", posX: 0.5, posY: 0.5, fontSize: 48 }
  };
  const preset = presets[templateType] ?? presets.shape;
  return {
    id: crypto.randomUUID(),
    trackId,
    type: "overlay",
    overlayType: templateType,
    start,
    end: start + 4,
    inPoint: 0,
    outPoint: 4,
    mediaDuration: 4,
    blendMode: "normal",
    timelineColor: "var(--clip-text)",
    ...preset
  };
}

function overlaps(clip, start, end) {
  return start < clip.end && end > clip.start;
}

function findAvailableStart(clips, desiredStart, duration) {
  let start = Math.max(0, desiredStart);
  let end = start + duration;
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  for (const clip of sorted) {
    if (overlaps(clip, start, end)) {
      start = clip.end;
      end = start + duration;
    }
  }
  return start;
}

function addLinkedAudioCompanion(tracks, videoClip, sourceClip, fps) {
  if (videoClip.type !== "video" || sourceClip.hasAudio !== true || videoClip.linkedItemId) return tracks;
  const audioTrackId = selectAutoTrack(tracks, "audio");
  const companionId = crypto.randomUUID();
  const linkedVideo = { ...videoClip, linkedItemId: companionId };
  const companion = normalizeClipFrames({
    id: companionId,
    trackId: audioTrackId,
    mediaId: videoClip.mediaId,
    type: "audio",
    name: `${videoClip.name} Audio`,
    start: videoClip.start,
    end: videoClip.end,
    inPoint: videoClip.inPoint,
    outPoint: videoClip.outPoint,
    mediaDuration: videoClip.mediaDuration,
    volume: videoClip.volume ?? 1,
    speed: videoClip.speed ?? 1,
    linkedItemId: videoClip.id,
    color: "var(--clip-audio)",
    timelineColor: "var(--clip-audio)"
  }, fps);

  return tracks.map((track) => {
    if (track.id === linkedVideo.trackId) {
      return { ...track, clips: track.clips.map((clip) => (clip.id === linkedVideo.id ? linkedVideo : clip)) };
    }
    if (track.id === audioTrackId) {
      return { ...track, buffer: false, clips: [...track.clips, companion] };
    }
    return track;
  });
}
