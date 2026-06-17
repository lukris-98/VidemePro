import { useCallback, useMemo } from "react";
import { usePlaybackStore } from "../store/playbackStore.js";
import { useUiStore } from "../store/uiStore.js";
import { snapSecondsToFrame } from "../utils/timelineEngine.js";

export function useTimeline() {
  const zoom = useUiStore((state) => state.timelineZoom);
  const setCurrentTime = usePlaybackStore((state) => state.setCurrentTime);
  const fps = usePlaybackStore((state) => state.fps);
  const pixelsPerSecond = useMemo(() => Math.round(100 * zoom), [zoom]);

  const timeFromPointer = useCallback(
    (event, element) => {
      const rect = element.getBoundingClientRect();
      return snapSecondsToFrame(Math.max(0, (event.clientX - rect.left + element.scrollLeft) / pixelsPerSecond), fps);
    },
    [fps, pixelsPerSecond]
  );

  const seekFromPointer = useCallback(
    (event, element) => {
      setCurrentTime(timeFromPointer(event, element));
    },
    [setCurrentTime, timeFromPointer]
  );

  return { pixelsPerSecond, seekFromPointer, timeFromPointer };
}
