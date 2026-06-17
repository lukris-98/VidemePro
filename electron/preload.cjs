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
  }
});
