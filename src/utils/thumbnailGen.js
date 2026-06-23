export function generateImageThumbnail(url, width = 160, height = 90) {
  return new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = (value = "") => {
      if (finished) return;
      finished = true;
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(""), 8000);
    image.onload = () => {
      window.clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, width, height);
      drawContained(ctx, image, width, height);
      finish(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      finish("");
    };
    image.src = url;
  });
}

export function generateVideoThumbnail(url, duration = 0, width = 160, height = 90) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    let finished = false;
    const timeout = window.setTimeout(() => finish(""), 10000);

    const finish = (value = "") => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };

    const draw = () => {
      if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, width, height);
      drawContained(ctx, video, width, height);
      finish(canvas.toDataURL("image/jpeg", 0.82));
    };

    video.addEventListener(
      "loadedmetadata",
      () => {
        const mediaDuration = safeDuration(video.duration, duration || 0);
        const target = mediaDuration > 0.3 ? Math.min(Math.max(mediaDuration * 0.1, 0.1), Math.max(mediaDuration - 0.05, 0)) : 0;
        video.addEventListener("loadeddata", draw, { once: true });
        video.addEventListener("canplay", draw, { once: true });
        if (target > 0.02) {
          video.currentTime = target;
        }
      },
      { once: true }
    );

    video.addEventListener("seeked", draw, { once: true });

    video.onerror = () => finish("");
    video.src = url;
  });
}

export function readMediaMetadata(file, url) {
  if (file.type.startsWith("video/")) {
    return readVideoMetadata(url);
  }
  if (file.type.startsWith("audio/")) {
    return readAudioMetadata(url);
  }
  if (file.type.startsWith("image/")) {
    return readImageMetadata(url);
  }
  return Promise.resolve({ duration: 5, width: 0, height: 0 });
}

function readVideoMetadata(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish({ duration: 5, width: 0, height: 0 }), 8000);
    video.onloadedmetadata = () => {
      finish({
        duration: safeDuration(video.duration, 5),
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    video.onerror = () => finish({ duration: 5, width: 0, height: 0 });
    video.src = url;
  });
}

function readAudioMetadata(url) {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      audio.removeAttribute("src");
      audio.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish({ duration: 5, width: 0, height: 0 }), 8000);
    audio.onloadedmetadata = () => {
      finish({ duration: safeDuration(audio.duration, 5), width: 0, height: 0 });
    };
    audio.onerror = () => finish({ duration: 5, width: 0, height: 0 });
    audio.src = url;
  });
}

function readImageMetadata(url) {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish({ duration: 5, width: 0, height: 0 }), 8000);
    image.onload = () => finish({ duration: 5, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => finish({ duration: 5, width: 0, height: 0 });
    image.src = url;
  });
}

function safeDuration(duration, fallback) {
  return Number.isFinite(duration) && duration > 0 ? duration : fallback;
}

function drawContained(ctx, source, width, height) {
  const sourceWidth = source.videoWidth || source.naturalWidth || width;
  const sourceHeight = source.videoHeight || source.naturalHeight || height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
}
