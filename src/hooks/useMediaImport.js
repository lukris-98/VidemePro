import { useCallback, useRef } from "react";
import { useMediaStore } from "../store/mediaStore.js";
import { generateWaveform } from "../utils/audioHelper.js";
import { generateImageThumbnail, generateVideoThumbnail, readMediaMetadata } from "../utils/thumbnailGen.js";
import { probeMediaItem } from "../utils/ffprobeService.js";

export function useMediaImport() {
  const inputRef = useRef(null);
  const addMediaItems = useMediaStore((state) => state.addMediaItems);
  const createMediaDraft = useMediaStore((state) => state.createMediaDraft);
  const setImportStatus = useMediaStore((state) => state.setImportStatus);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const importFiles = useCallback(
    async (files) => {
      if (!files?.length) return;
      const fileArray = Array.from(files);
      const existingNames = new Set(useMediaStore.getState().items.map((item) => item.name));
      const seenNames = new Set();
      const uniqueFiles = fileArray.filter((file) => {
        if (existingNames.has(file.name) || seenNames.has(file.name)) return false;
        seenNames.add(file.name);
        return true;
      });
      const skippedCount = fileArray.length - uniqueFiles.length;
      if (!uniqueFiles.length) {
        setImportStatus("idle", "");
        return;
      }
      setImportStatus("loading", `Mengimpor ${uniqueFiles.length} file`);
      try {
        const items = await Promise.all(
          uniqueFiles.map(async (file) => {
            const draft = createMediaDraft(file);
            const metadata = await readMediaMetadata(file, draft.url);
            let thumbnailUrl = "";
            if (draft.type === "video") {
              thumbnailUrl = await generateVideoThumbnail(draft.url, metadata.duration);
            } else if (draft.type === "image") {
              thumbnailUrl = await generateImageThumbnail(draft.url);
            }
            const waveformData = draft.type === "audio" || draft.type === "video" ? await generateWaveform(file) : [];
            const ffprobe = await probeMediaItem({ ...draft, ...metadata }).catch(() => null);
            return {
              ...draft,
              ...metadata,
              duration: ffprobe?.format?.duration || metadata.duration || draft.duration,
              thumbnailUrl,
              waveformData,
              isProxy: draft.isProxy || metadata.width > 1920 || metadata.height > 1080,
              metadata: { ffprobe }
            };
          })
        );
        addMediaItems(items);
        if (skippedCount > 0) {
          setImportStatus("idle", `${skippedCount} file duplikat dilewati`);
          window.setTimeout(() => {
            if (useMediaStore.getState().importMessage === `${skippedCount} file duplikat dilewati`) {
              setImportStatus("idle", "");
            }
          }, 2500);
        } else {
          setImportStatus("idle", "");
        }
      } catch (error) {
        setImportStatus("error", error instanceof Error ? error.message : "Import gagal");
      }
    },
    [addMediaItems, createMediaDraft, setImportStatus]
  );

  const inputProps = {
    ref: inputRef,
    className: "hidden",
    type: "file",
    accept: "video/*,image/*,audio/*",
    multiple: true,
    onChange: (event) => {
      importFiles(event.target.files);
      event.target.value = "";
    }
  };

  return { inputProps, openPicker, importFiles };
}
