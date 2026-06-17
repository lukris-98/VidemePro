import React, { useEffect, useRef, useState } from "react";
import { LeftPanel } from "../components/layout/LeftPanel.jsx";
import { PreviewPlayer } from "../components/layout/PreviewPlayer.jsx";
import { RightPanel } from "../components/layout/RightPanel.jsx";
import { Timeline } from "../components/layout/Timeline.jsx";
import { TopBar } from "../components/layout/TopBar.jsx";
import { usePlaybackStore } from "../store/playbackStore.js";
import { useProjectStore } from "../store/projectStore.js";
import { useMediaStore } from "../store/mediaStore.js";
import { useAudioPlayback } from "../hooks/useAudioPlayback.js";
import { ExportModal } from "../components/modals/ExportModal.jsx";
import { AiImageModal } from "../components/modals/AiImageModal.jsx";
import { AutoCaptionModal } from "../components/modals/AutoCaptionModal.jsx";
import { FreezeFrameModal } from "../components/modals/FreezeFrameModal.jsx";
import { ShortcutHelp } from "../components/modals/ShortcutHelp.jsx";
import { SmartCutModal } from "../components/modals/SmartCutModal.jsx";
import { StabilizeModal } from "../components/modals/StabilizeModal.jsx";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.js";

export default function App() {
  const [layout, setLayout] = useState({ left: 480, right: 435, timeline: 275 });
  const layoutRef = useRef(layout);
  const tracks = useProjectStore((state) => state.tracks);
  const mediaItems = useMediaStore((state) => state.items);
  const currentTime = usePlaybackStore((state) => state.currentTime);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);

  useKeyboardShortcuts();

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const blockContextMenu = (event) => {
      event.preventDefault();
    };
    const blockWheelZoom = (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const blockTouchZoom = (event) => {
      if (event.touches?.length > 1) event.preventDefault();
    };
    const blockGestureZoom = (event) => {
      event.preventDefault();
    };
    const blockBlockedShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const isModifier = event.ctrlKey || event.metaKey;
      const isBlocked =
        isModifier &&
        (key === "z" || key === "+" || key === "=" || key === "-" || key === "0");
      if (!isBlocked) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    document.addEventListener("contextmenu", blockContextMenu);
    document.addEventListener("wheel", blockWheelZoom, { passive: false });
    document.addEventListener("touchmove", blockTouchZoom, { passive: false });
    document.addEventListener("gesturestart", blockGestureZoom);
    document.addEventListener("gesturechange", blockGestureZoom);
    document.addEventListener("keydown", blockBlockedShortcuts, true);
    return () => {
      document.removeEventListener("contextmenu", blockContextMenu);
      document.removeEventListener("wheel", blockWheelZoom);
      document.removeEventListener("touchmove", blockTouchZoom);
      document.removeEventListener("gesturestart", blockGestureZoom);
      document.removeEventListener("gesturechange", blockGestureZoom);
      document.removeEventListener("keydown", blockBlockedShortcuts, true);
    };
  }, []);

  useAudioPlayback({ isPlaying, currentTime, tracks, mediaItems });

  const beginResize = (mode, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = layoutRef.current;
    const minLeft = 260;
    const minRight = 280;
    const minCenter = 420;
    const minTimeline = 140;
    const minMain = 320;
    const gutterWidth = 8;

    document.body.style.cursor = mode === "timeline" ? "row-resize" : "col-resize";

    const onMove = (moveEvent) => {
      const appWidth = Math.max(1120, window.innerWidth);
      const appHeight = window.innerHeight - 48;
      if (mode === "left") {
        const maxLeft = Math.max(minLeft, appWidth - start.right - minCenter - gutterWidth);
        setLayout((state) => ({
          ...state,
          left: clamp(start.left + moveEvent.clientX - startX, minLeft, maxLeft)
        }));
      } else if (mode === "right") {
        const maxRight = Math.max(minRight, appWidth - start.left - minCenter - gutterWidth);
        setLayout((state) => ({
          ...state,
          right: clamp(start.right - (moveEvent.clientX - startX), minRight, maxRight)
        }));
      } else {
        const maxTimeline = Math.max(minTimeline, appHeight - minMain - 4);
        setLayout((state) => ({
          ...state,
          timeline: clamp(start.timeline - (moveEvent.clientY - startY), minTimeline, maxTimeline)
        }));
      }
    };

    const onUp = () => {
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
  };

  return (
    <div className="h-[100dvh] min-w-[1120px] overflow-hidden bg-[var(--bg-root)] text-[var(--text-primary)]">
      <TopBar leftWidth={layout.left} rightWidth={layout.right} />
      <div
        className="grid h-[calc(100dvh-48px)]"
        style={{ gridTemplateRows: `minmax(320px, 1fr) 4px ${layout.timeline}px` }}
      >
        <main
          className="grid min-h-0"
          style={{ gridTemplateColumns: `${layout.left}px 4px minmax(420px, 1fr) 4px ${layout.right}px` }}
        >
          <LeftPanel />
          <ResizeHandle axis="x" onMouseDown={(event) => beginResize("left", event)} />
          <section className="min-h-0 border-x border-[var(--border)] bg-[var(--bg-preview)]">
            <PreviewPlayer />
          </section>
          <ResizeHandle axis="x" onMouseDown={(event) => beginResize("right", event)} />
          <RightPanel />
        </main>
        <ResizeHandle axis="y" onMouseDown={(event) => beginResize("timeline", event)} />
        <Timeline />
      </div>
      <ExportModal />
      <AiImageModal />
      <AutoCaptionModal />
      <SmartCutModal />
      <FreezeFrameModal />
      <ShortcutHelp />
      <StabilizeModal />
    </div>
  );
}

function ResizeHandle({ axis, onMouseDown }) {
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      onMouseDown={onMouseDown}
      className={`relative z-30 bg-[var(--border)] transition hover:bg-[var(--accent)] ${
        axis === "x" ? "cursor-col-resize" : "cursor-row-resize"
      }`}
    />
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
