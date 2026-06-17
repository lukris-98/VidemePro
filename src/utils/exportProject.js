import { convertWebmToMp4 } from "./ffmpegHelper.js";
import { getTextAnimation } from "./animationPresets.js";
import { applyAutoReframe, applyBackgroundRemove, applyFaceBlur } from "./aiEffects.js";
import { applyColorData, buildCSSFilter, drawVignette, drawWithTransform } from "./visualEffects.js";

const resolutionMap = {
  "480p": [854, 480],
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "4K": [3840, 2160]
};

export async function exportProject({ projectName, tracks, mediaItems, options, onProgress }) {
  const [width, height] = resolutionMap[options.resolution] ?? resolutionMap["720p"];
  const fps = Number(options.fps);
  const duration = Math.max(1, ...tracks.flatMap((track) => track.clips.map((clip) => clip.end)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(fps);
  const chunks = [];
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder tidak tersedia di browser ini.");
  }
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType });
  const imageCache = await preloadImages(mediaItems);
  const videoCache = await preloadVideos(mediaItems);
  const stickerCache = await preloadStickers(tracks);

  const done = new Promise((resolve) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();
  const videoTracks = tracks.filter((track) => ["video", "text", "overlay"].includes(track.type) && track.visible !== false && !track.muted);
  const frameCount = Math.ceil(duration * fps);

  for (let frame = 0; frame <= frameCount; frame += 1) {
    const time = frame / fps;
    await renderFrame(ctx, width, height, time, videoTracks, mediaItems, imageCache, videoCache, stickerCache);
    onProgress?.(Math.min(0.75, frame / frameCount));
    await wait(1000 / fps);
  }

  recorder.stop();
  const webmBlob = await done;
  if (options.format === "mp4") {
    const crf = qualityToCrf(options.quality);
    const mp4Blob = await convertWebmToMp4(webmBlob, crf, (progress) => onProgress?.(0.75 + progress * 0.25));
    downloadBlob(mp4Blob, `${projectName}.mp4`);
    return mp4Blob;
  }
  downloadBlob(webmBlob, `${projectName}.webm`);
  onProgress?.(1);
  return webmBlob;
}

async function renderFrame(ctx, width, height, time, tracks, mediaItems, imageCache, videoCache, stickerCache) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, width, height);
  for (const track of tracks) {
    if (track.type === "text") {
      for (const clip of track.clips.filter((item) => time >= item.start && time <= item.end)) {
        drawTextClip(ctx, width, height, clip, time);
      }
      continue;
    }
    if (track.type === "overlay") {
      for (const clip of track.clips.filter((item) => time >= item.start && time <= item.end)) {
        drawStickerClip(ctx, width, height, clip, time, stickerCache);
      }
      continue;
    }
    const transitionPair = findTransitionPair([...track.clips].sort((a, b) => a.start - b.start), time);
    if (transitionPair) {
      await drawTransitionFrame(ctx, width, height, transitionPair, time, mediaItems, imageCache, videoCache);
      continue;
    }
    const clip = track.clips.find((item) => time >= item.start && time <= item.end);
    if (!clip) continue;
    await drawSingleClip(ctx, width, height, clip, time, mediaItems, imageCache, videoCache);
  }
}

function findTransitionPair(clips, time) {
  for (let index = 0; index < clips.length - 1; index += 1) {
    const current = clips[index];
    const next = clips[index + 1];
    const transition = current.transition;
    if (!transition || transition.type === "none" || !transition.duration) continue;
    const start = current.end - transition.duration;
    const end = current.end;
    if (time >= start && time <= end && Math.abs(next.start - current.end) < 0.2) {
      return { current, next, transition, start };
    }
  }
  return null;
}

async function drawTransitionFrame(ctx, width, height, pair, time, mediaItems, imageCache, videoCache) {
  const progress = Math.max(0, Math.min(1, (time - pair.start) / pair.transition.duration));
  if (pair.transition.type === "fadeToBlack") {
    await drawSingleClip(ctx, width, height, pair.current, time, mediaItems, imageCache, videoCache, 1);
    ctx.fillStyle = `rgba(0,0,0,${progress < 0.5 ? progress * 2 : 1})`;
    ctx.fillRect(0, 0, width, height);
    if (progress >= 0.5) await drawSingleClip(ctx, width, height, pair.next, time, mediaItems, imageCache, videoCache, (progress - 0.5) * 2);
    return;
  }
  await drawSingleClip(ctx, width, height, pair.current, time, mediaItems, imageCache, videoCache, 1 - progress);
  await drawSingleClip(ctx, width, height, pair.next, time, mediaItems, imageCache, videoCache, progress);
}

async function drawSingleClip(ctx, width, height, clip, time, mediaItems, imageCache, videoCache, alpha = 1) {
  const media = mediaItems.find((item) => item.id === clip.mediaId);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = buildCSSFilter(clip.filters, clip.effects);
  const video = videoCache.get(media?.id);
  if (video) {
    const mediaTime = Math.max(0, (clip.inPoint ?? 0) + (time - clip.start) * (clip.speed ?? 1));
    await seekVideo(video, mediaTime);
    drawWithTransform(ctx, video, clip, width, height);
  } else {
    const image = imageCache.get(media?.id);
    if (image) {
      drawWithTransform(ctx, image, clip, width, height);
    } else {
      ctx.fillStyle = clip.color || "#4d9eff";
      ctx.fillRect(width * 0.1, height * 0.35, width * 0.8, height * 0.3);
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(20, width / 42)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(clip.name || "Clip", width / 2, height / 2);
    }
  }
  ctx.filter = "none";
  applyColorData(ctx, width, height, clip.filters);
  drawVignette(ctx, width, height, clip.filters, clip.effects);
  applyBackgroundRemove(ctx, width, height, clip);
  applyFaceBlur(ctx, width, height, clip);
  applyAutoReframe(ctx, width, height, clip);
  ctx.restore();
}

function drawTextClip(ctx, width, height, clip, time) {
  const elapsed = Math.max(0, time - clip.start);
  const duration = Math.max(0.01, clip.animDuration ?? 0.5);
  const progress = Math.min(elapsed / duration, 1);
  const anim = getTextAnimation(clip.animation || "none")(progress, clip.text || "");
  const text = anim.visibleChars !== undefined ? (clip.text || "").slice(0, anim.visibleChars) : clip.text || "";
  const x = (clip.posX ?? 0.5) * width;
  const y = (clip.posY ?? 0.85) * height + (anim.offsetY ?? 0);
  ctx.save();
  ctx.globalAlpha = anim.opacity ?? 1;
  ctx.translate(x, y);
  ctx.scale(anim.scale ?? 1, anim.scale ?? 1);
  ctx.font = `${clip.fontWeight ?? "bold"} ${scaleFont(clip.fontSize ?? 48, height)}px ${clip.fontFamily ?? "Arial"}`;
  ctx.textAlign = clip.align ?? "center";
  ctx.fillStyle = clip.color ?? "#ffffff";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawStickerClip(ctx, width, height, clip, time, stickerCache) {
  const image = stickerCache.get(clip.id);
  if (!image) return;
  const elapsed = Math.max(0, time - clip.start);
  const duration = Math.max(0.01, clip.animDuration ?? 0.5);
  const progress = Math.min(elapsed / duration, 1);
  const anim = getTextAnimation(clip.animation || "none")(progress, clip.name || "");
  ctx.save();
  ctx.globalAlpha = (clip.opacity ?? 1) * (anim.opacity ?? 1);
  ctx.translate((clip.posX ?? 0.5) * width, (clip.posY ?? 0.5) * height + (anim.offsetY ?? 0));
  ctx.rotate(((clip.rotation ?? 0) * Math.PI) / 180);
  const scale = anim.scale ?? 1;
  ctx.scale((clip.scaleX ?? 0.2) * scale, (clip.scaleY ?? 0.2) * scale);
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  ctx.restore();
}

function scaleFont(fontSize, outputHeight) {
  return Math.round((fontSize / 720) * outputHeight);
}

async function preloadVideos(mediaItems) {
  const entries = await Promise.all(
    mediaItems
      .filter((item) => item.type === "video")
      .map(
        (item) =>
          new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "auto";
            video.muted = true;
            video.playsInline = true;
            video.onloadedmetadata = () => resolve([item.id, video]);
            video.onerror = () => resolve(null);
            video.src = item.url;
          })
      )
  );
  return new Map(entries.filter(Boolean));
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const safeTime = Math.min(Math.max(0, time), Math.max(0, (video.duration || time) - 0.02));
    if (Math.abs(video.currentTime - safeTime) < 0.02 && video.readyState >= 2) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", finish);
      video.removeEventListener("loadeddata", finish);
      resolve();
    };
    const timeout = window.setTimeout(finish, 700);
    video.addEventListener("seeked", finish, { once: true });
    video.addEventListener("loadeddata", finish, { once: true });
    try {
      video.currentTime = safeTime;
    } catch {
      finish();
    }
  });
}

async function preloadImages(mediaItems) {
  const entries = await Promise.all(
    mediaItems
      .filter((item) => item.thumbnailUrl)
      .map(
        (item) =>
          new Promise((resolve) => {
            const image = new Image();
            image.onload = () => resolve([item.id, image]);
            image.onerror = () => resolve(null);
            image.src = item.thumbnailUrl;
          })
      )
  );
  return new Map(entries.filter(Boolean));
}

async function preloadStickers(tracks) {
  const clips = tracks.filter((track) => track.type === "overlay").flatMap((track) => track.clips).filter((clip) => clip.src);
  const entries = await Promise.all(
    clips.map(
      (clip) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve([clip.id, image]);
          image.onerror = () => resolve(null);
          image.src = clip.src;
        })
    )
  );
  return new Map(entries.filter(Boolean));
}

function qualityToCrf(quality) {
  const safe = Math.max(1, Math.min(100, Number(quality)));
  return Math.round(51 - (safe / 100) * 33);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
