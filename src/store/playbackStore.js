import { create } from "zustand";
import { emitEvent } from "../utils/eventBus.js";
import { snapSecondsToFrame } from "../utils/timelineEngine.js";

export const usePlaybackStore = create((set, get) => ({
  currentTime: 0,
  isPlaying: false,
  duration: 12,
  fps: 30,
  setCurrentTime: (currentTime) => {
    const { duration, fps } = get();
    const nextTime = Math.min(Math.max(0, snapSecondsToFrame(currentTime, fps)), duration);
    emitEvent("timeline:playhead-moved", { time: nextTime, frame: Math.round(nextTime * fps) });
    set({ currentTime: nextTime });
  },
  setDuration: (duration) => set({ duration: Math.max(0, duration) }),
  play: () => {
    emitEvent("playback:started");
    set({ isPlaying: true });
  },
  pause: () => {
    emitEvent("playback:paused");
    set({ isPlaying: false });
  },
  togglePlay: () => set((state) => {
    emitEvent(state.isPlaying ? "playback:paused" : "playback:started");
    return { isPlaying: !state.isPlaying };
  }),
  stop: () => {
    emitEvent("playback:stopped");
    set({ currentTime: 0, isPlaying: false });
  },
  seekStart: () => set({ currentTime: 0, isPlaying: false }),
  seekEnd: () => set((state) => ({ currentTime: state.duration, isPlaying: false })),
  stepFrame: (direction = 1) => {
    const { currentTime, fps, duration } = get();
    const next = currentTime + direction * (1 / fps);
    set({ currentTime: Math.min(Math.max(0, snapSecondsToFrame(next, fps)), duration) });
  }
}));
