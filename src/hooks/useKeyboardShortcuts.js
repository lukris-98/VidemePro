import { useEffect } from "react";
import { usePlaybackStore } from "../store/playbackStore.js";
import { useProjectStore } from "../store/projectStore.js";
import { useUiStore } from "../store/uiStore.js";

export const shortcutRows = [
  ["Space", "Play/Pause"],
  [".", "Stop"],
  ["Ctrl + K", "Split di playhead"],
  ["S", "Toggle snap"],
  ["Delete", "Hapus klip"],
  ["Arrow Left/Right", "Geser 1 frame"],
  ["Shift + Arrow", "Geser 10 frame"],
  ["Home / End", "Awal / akhir timeline"],
  ["Ctrl + D", "Duplicate clip"],
  ["Ctrl + C / V", "Copy / paste clip"],
  ["Ctrl + A", "Select clip pertama"],
  ["M", "Mute track klip terpilih"],
  ["I / O", "Trim in / out di playhead"],
  ["?", "Shortcut help"]
];

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTyping(event.target)) return;
      const playback = usePlaybackStore.getState();
      const project = useProjectStore.getState();
      const ui = useUiStore.getState();
      const key = event.key.toLowerCase();

      if (event.key === "?") {
        event.preventDefault();
        ui.openShortcutHelp();
      } else if (event.code === "Space") {
        event.preventDefault();
        playback.togglePlay();
      } else if (event.code === "Period") {
        event.preventDefault();
        playback.stop();
      } else if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
        event.preventDefault();
        project.splitSelectedAt(playback.currentTime);
      } else if (event.code === "KeyS" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        ui.toggleSnap();
      } else if (event.code === "Delete" || event.code === "Backspace") {
        event.preventDefault();
        project.removeSelectedClip();
      } else if (event.code === "ArrowLeft") {
        event.preventDefault();
        playback.setCurrentTime(playback.currentTime - (event.shiftKey ? 10 / playback.fps : 1 / playback.fps));
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        playback.setCurrentTime(playback.currentTime + (event.shiftKey ? 10 / playback.fps : 1 / playback.fps));
      } else if (event.code === "Home") {
        event.preventDefault();
        playback.seekStart();
      } else if (event.code === "End") {
        event.preventDefault();
        playback.seekEnd();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "z") {
        event.preventDefault();
        project.redo();
      } else if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        project.undo();
      } else if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        project.redo();
      } else if ((event.ctrlKey || event.metaKey) && key === "d") {
        event.preventDefault();
        project.duplicateSelectedClip();
      } else if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        project.copySelectedClip();
      } else if ((event.ctrlKey || event.metaKey) && key === "v") {
        event.preventDefault();
        project.pasteClip(playback.currentTime);
      } else if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();
        project.selectAllClips();
      } else if (event.code === "KeyM" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        project.muteSelectedTrack();
      } else if (event.code === "KeyI" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        project.trimSelectedIn(playback.currentTime);
      } else if (event.code === "KeyO" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        project.trimSelectedOut(playback.currentTime);
      } else if (event.code === "Escape") {
        project.deselectAll();
        ui.closeShortcutHelp();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        ui.zoomIn();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "-") {
        event.preventDefault();
        ui.zoomOut();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "0") {
        event.preventDefault();
        ui.fitToWindow();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

function isTyping(target) {
  const tag = target?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;
}
