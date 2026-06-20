const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("videmeNative", {
  ffmpeg: {
    getCapabilities: () => ipcRenderer.invoke("ffmpeg:get-capabilities"),
    transcodeBuffer: (payload) => ipcRenderer.invoke("ffmpeg:transcode-buffer", payload),
    transcodePaths: (payload) => ipcRenderer.invoke("ffmpeg:transcode-paths", payload),
    cancelJob: (jobId) => ipcRenderer.invoke("ffmpeg:cancel-job", jobId),
    getFilterHelp: (filterName) => ipcRenderer.invoke("ffmpeg:get-filter-help", filterName),
    getEncoderHelp: (encoderName) => ipcRenderer.invoke("ffmpeg:get-encoder-help", encoderName),
    onProgress: (jobId, callback) => {
      const channel = `ffmpeg:progress:${jobId}`;
      ipcRenderer.on(channel, (_event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners(channel);
    }
  },
  ffprobe: {
    getMetadata: (filePath) => ipcRenderer.invoke("ffprobe:metadata", { filePath })
  },
  cache: {
    getDir: (subdir) => ipcRenderer.invoke("cache:get-dir", subdir),
    clear: (subdir) => ipcRenderer.invoke("cache:clear", subdir),
    size: () => ipcRenderer.invoke("cache:size")
  },
  proxy: {
    make: (payload) => ipcRenderer.invoke("ffmpeg:make-proxy", payload)
  },
  asset: {
    download: (payload) => ipcRenderer.invoke("asset:download", payload)
  },
  pexels: {
    search: (payload) => ipcRenderer.invoke("pexels:search", payload)
  },
  pixabay: {
    search: (payload) => ipcRenderer.invoke("pixabay:search", payload)
  },
  spotify: {
    lyrics: (payload) => ipcRenderer.invoke("spotify:track-lyrics", payload)
  },
  apiframe: {
    generateMusic: (payload) => ipcRenderer.invoke("apiframe:music-generate", payload),
    getJob: (jobId) => ipcRenderer.invoke("apiframe:job", { jobId }),
    listKeys: (payload) => ipcRenderer.invoke("apiframe:keys-list", payload),
    addKeys: (keys) => ipcRenderer.invoke("apiframe:keys-add", { keys }),
    removeKey: (id) => ipcRenderer.invoke("apiframe:key-remove", { id })
  },
  openrouter: {
    listKeys: (payload) => ipcRenderer.invoke("openrouter:keys-list", payload),
    addKeys: (keys) => ipcRenderer.invoke("openrouter:keys-add", { keys }),
    removeKey: (id) => ipcRenderer.invoke("openrouter:key-remove", { id }),
    complete: (payload) => ipcRenderer.invoke("openrouter:chat-complete", payload)
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:open-external", { url })
  },
  file: {
    exists: (filePath) => ipcRenderer.invoke("file:exists", { filePath }),
    readAudio: (filePath) => ipcRenderer.invoke("file:read-audio", { filePath })
  }
});
