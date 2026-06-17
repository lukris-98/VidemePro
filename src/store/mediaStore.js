import { create } from "zustand";
import { emitEvent } from "../utils/eventBus.js";

function getMediaType(file) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return "file";
}

export const useMediaStore = create((set) => ({
  items: [],
  selectedItems: [],
  previewMediaId: null,
  importStatus: "idle",
  importMessage: "",
  addMediaItems: (items) =>
    set((state) => {
      const existingNames = new Set(state.items.map((item) => item.name));
      const nextItems = items.filter((item) => !existingNames.has(item.name));
      nextItems.forEach((item) => emitEvent("media:loaded", { media: item }));
      return {
        items: [...nextItems, ...state.items],
        previewMediaId: state.previewMediaId ?? nextItems[0]?.id ?? null
      };
    }),
  addMediaItem: (item) =>
    set((state) => {
      emitEvent("media:loaded", { media: item });
      return {
        items: [item, ...state.items],
        previewMediaId: item.id
      };
    }),
  updateMediaItem: (id, patch) =>
    set((state) => {
      if (patch.thumbnailUrl || patch.thumbnail) emitEvent("media:thumbnail-ready", { mediaId: id });
      if (patch.waveformData) emitEvent("media:waveform-ready", { mediaId: id });
      return {
        items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item))
      };
    }),
  createMediaDraft: (file, extra = {}) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: getMediaType(file),
    file,
    url: URL.createObjectURL(file),
    thumbnailUrl: "",
    duration: file.type.startsWith("image/") ? 3 : 5,
    width: 0,
    height: 0,
    size: file.size,
    addedToTimeline: false,
    isProxy: file.size > 50 * 1024 * 1024,
    metadata: { ffprobe: null },
    capabilities: {},
    proxy: null,
    waveform: null,
    thumbnails: [],
    ...extra
  }),
  setImportStatus: (importStatus, importMessage = "") => set({ importStatus, importMessage }),
  toggleSelect: (id) =>
    set((state) => ({
      selectedItems: state.selectedItems.includes(id)
        ? state.selectedItems.filter((itemId) => itemId !== id)
        : [...state.selectedItems, id]
    })),
  setPreviewMedia: (previewMediaId) => set({ previewMediaId }),
  markAdded: (id) =>
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, addedToTimeline: true } : item))
    }))
}));
