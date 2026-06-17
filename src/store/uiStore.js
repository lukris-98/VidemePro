import { create } from "zustand";
import { emitEvent } from "../utils/eventBus.js";

const initialTimelineUi = {
  zoom: 1,
  scrollX: 0,
  scrollY: 0,
  playheadFrame: 0,
  selection: [],
  dragging: null,
  trimming: null,
  marquee: null
};

export const useUiStore = create((set) => ({
  leftTab: "media",
  selectedClip: null,
  timeline: initialTimelineUi,
  timelineZoom: 1,
  snapEnabled: true,
  exportOpen: false,
  autoCaptionOpen: false,
  aiImageOpen: false,
  smartCutOpen: false,
  freezeOpen: false,
  shortcutHelpOpen: false,
  stabilizeOpen: false,
  cropMode: false,
  setLeftTab: (leftTab) => set({ leftTab }),
  setSelectedClip: (selectedClip) => set({ selectedClip }),
  setTimelineZoom: (timelineZoom) => set((state) => {
    emitEvent("timeline:zoom-changed", { zoom: timelineZoom });
    return { timelineZoom, timeline: { ...state.timeline, zoom: timelineZoom } };
  }),
  setTimelineScroll: (scrollX, scrollY) => set((state) => {
    emitEvent("timeline:scroll-changed", { scrollX, scrollY });
    return { timeline: { ...state.timeline, scrollX, scrollY } };
  }),
  setTimelinePlayheadFrame: (playheadFrame) => set((state) => ({ timeline: { ...state.timeline, playheadFrame } })),
  setTimelineSelection: (selection) => set((state) => ({ timeline: { ...state.timeline, selection } })),
  setTimelineDragging: (dragging) => set((state) => ({ timeline: { ...state.timeline, dragging } })),
  setTimelineTrimming: (trimming) => set((state) => ({ timeline: { ...state.timeline, trimming } })),
  setTimelineMarquee: (marquee) => set((state) => ({ timeline: { ...state.timeline, marquee } })),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  openExport: () => set({ exportOpen: true }),
  closeExport: () => set({ exportOpen: false }),
  openAutoCaption: () => set({ autoCaptionOpen: true }),
  closeAutoCaption: () => set({ autoCaptionOpen: false }),
  openAiImage: () => set({ aiImageOpen: true }),
  closeAiImage: () => set({ aiImageOpen: false }),
  openSmartCut: () => set({ smartCutOpen: true }),
  closeSmartCut: () => set({ smartCutOpen: false }),
  openFreeze: () => set({ freezeOpen: true }),
  closeFreeze: () => set({ freezeOpen: false }),
  openShortcutHelp: () => set({ shortcutHelpOpen: true }),
  closeShortcutHelp: () => set({ shortcutHelpOpen: false }),
  openStabilize: () => set({ stabilizeOpen: true }),
  closeStabilize: () => set({ stabilizeOpen: false }),
  toggleCropMode: () => set((state) => ({ cropMode: !state.cropMode })),
  setCropMode: (cropMode) => set({ cropMode }),
  zoomIn: () => set((state) => {
    const timelineZoom = Math.min(3, state.timelineZoom + 0.1);
    emitEvent("timeline:zoom-changed", { zoom: timelineZoom });
    return { timelineZoom, timeline: { ...state.timeline, zoom: timelineZoom } };
  }),
  zoomOut: () => set((state) => {
    const timelineZoom = Math.max(0.5, state.timelineZoom - 0.1);
    emitEvent("timeline:zoom-changed", { zoom: timelineZoom });
    return { timelineZoom, timeline: { ...state.timeline, zoom: timelineZoom } };
  }),
  fitToWindow: () => set((state) => {
    emitEvent("timeline:zoom-changed", { zoom: 1 });
    return { timelineZoom: 1, timeline: { ...state.timeline, zoom: 1 } };
  })
}));
