import { useEffect, useRef } from "react";
import { usePlaybackStore } from "../store/playbackStore.js";
import { getAudioContext } from "../utils/audioHelper.js";
import { emitEvent } from "../utils/eventBus.js";

export function usePlayback() {
  const frameRef = useRef(null);
  const clockRef = useRef(null);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const duration = usePlaybackStore((state) => state.duration);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);
  const pause = usePlaybackStore((state) => state.pause);

  useEffect(() => {
    if (!isPlaying) {
      clockRef.current = null;
      return undefined;
    }

    const audioContext = getAudioContext();
    clockRef.current = {
      audioStart: audioContext.currentTime,
      timelineStart: usePlaybackStore.getState().currentTime
    };

    const tick = () => {
      const clock = clockRef.current;
      if (!clock) return;
      const nextTime = Math.min(clock.timelineStart + (audioContext.currentTime - clock.audioStart), duration);
      setCurrentTime(nextTime);
      if (nextTime >= duration) {
        emitEvent("playback:ended", { time: nextTime });
        pause();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [duration, isPlaying, pause, setCurrentTime]);

  return { currentTime, isPlaying, duration };
}
