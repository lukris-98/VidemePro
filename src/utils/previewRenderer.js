import { getTextAnimation } from "./animationPresets.js";
import { applyAutoReframe, applyBackgroundRemove, applyFaceBlur } from "./aiEffects.js";
import { applyColorData, buildCSSFilter, drawVignette, drawWithTransform } from "./visualEffects.js";

const imageCache = new Map();

export function renderPreviewFrame(ctx, canvas, { time, tracks, mediaItems, videoElement, imageElement, previewMedia }) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, width, height);

  const hasTimelineContent = tracks.some((track) => track.clips.length);
  if (previewMedia) {
    renderPreviewMedia(ctx, width, height, previewMedia, videoElement, imageElement);
  } else if (hasTimelineContent) {
    renderTimeline(ctx, width, height, time, tracks, mediaItems, videoElement);
  } else {
    renderPreviewMedia(ctx, width, height, previewMedia, videoElement, imageElement);
  }

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText("VidemePro+", width - 18, height - 16);
}

export function getActiveTextClips(tracks, time) {
  return tracks
    .filter((track) => track.type === "text" && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => time >= clip.start && time <= clip.end);
}

function renderTimeline(ctx, width, height, time, tracks, mediaItems, videoElement) {
  const visualTracks = tracks.filter((track) => track.visible !== false && !track.muted);
  for (const track of visualTracks.filter((item) => item.type === "video")) {
    const clips = [...track.clips].sort((a, b) => a.start - b.start);
    const transitionPair = findTransitionPair(clips, time);
    if (transitionPair) {
      drawTransition(ctx, width, height, transitionPair, mediaItems, videoElement, time);
      continue;
    }
    const clip = clips.find((item) => time >= item.start && time <= item.end);
    if (clip) drawClipFrame(ctx, width, height, clip, mediaItems, videoElement, time);
  }
  for (const clip of getActiveTextClips(visualTracks, time)) {
    drawTextClip(ctx, width, height, clip, time);
  }
  for (const clip of getActiveStickerClips(visualTracks, time)) {
    drawStickerClip(ctx, width, height, clip, time);
  }
}

function renderPreviewMedia(ctx, width, height, previewMedia, videoElement, imageElement) {
  if (previewMedia?.type === "video" && videoElement?.readyState >= 2) {
    ctx.drawImage(videoElement, 0, 0, width, height);
  } else if (previewMedia?.type === "image" || previewMedia?.type === "photo") {
    if (imageElement?.dataset?.mediaId === previewMedia.id && imageElement.complete && imageElement.naturalWidth) {
      drawContained(ctx, imageElement, width, height);
    }
  } else if (previewMedia?.type === "audio") {
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#4d9eff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Audio Preview", width / 2, height / 2 - 8);
    ctx.fillStyle = "#cccccc";
    ctx.font = "14px Arial";
    ctx.fillText(previewMedia.name, width / 2, height / 2 + 22);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#2a2a2a";
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    ctx.fillStyle = "#9a9a9a";
    ctx.font = "34px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Preview Canvas", width / 2, height / 2 - 14);
    ctx.font = "20px Arial";
    ctx.fillStyle = "#777";
    ctx.fillText("Import media untuk mulai melihat frame", width / 2, height / 2 + 28);
  }
}

function drawClipFrame(ctx, width, height, clip, mediaItems, videoElement, time, alpha = 1, offsetX = 0) {
  const media = mediaItems.find((item) => item.id === clip.mediaId);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = buildCSSFilter(clip.filters, clip.effects);
  if (media?.type === "video" && videoElement?.readyState >= 2 && videoElement.dataset.mediaId === media.id) {
    drawWithTransform(ctx, videoElement, clip, width, height, offsetX);
  } else if (media?.thumbnailUrl || media?.url) {
    const imageSrc = media?.type === "image" || media?.type === "photo" ? media.url : media.thumbnailUrl;
    const image = getCachedImage(imageSrc, () => {
      ctx.save();
      ctx.filter = buildCSSFilter(clip.filters, clip.effects);
      drawWithTransform(ctx, image, clip, width, height, offsetX);
      ctx.filter = "none";
      applyColorData(ctx, width, height, clip.filters);
      drawVignette(ctx, width, height, clip.filters, clip.effects);
      applyBackgroundRemove(ctx, width, height, clip);
      applyFaceBlur(ctx, width, height, clip);
      applyAutoReframe(ctx, width, height, clip);
      ctx.restore();
    });
    if (image.complete && image.naturalWidth) {
      drawWithTransform(ctx, image, clip, width, height, offsetX);
    }
  } else {
    ctx.fillStyle = clip.color || "#4d9eff";
    ctx.fillRect(width * 0.1 + offsetX, height * 0.35, width * 0.8, height * 0.3);
    ctx.fillStyle = "#fff";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(clip.name || "Clip", width / 2 + offsetX, height / 2);
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
  const preset = getTextAnimation(clip.animation || "none");
  const anim = preset(progress, clip.text || "");
  const x = (clip.posX ?? 0.5) * width;
  const y = (clip.posY ?? 0.85) * height + (anim.offsetY ?? 0);
  const displayText = anim.visibleChars !== undefined ? (clip.text || "").slice(0, anim.visibleChars) : clip.text || "";

  ctx.save();
  ctx.globalAlpha = anim.opacity ?? 1;
  ctx.translate(x, y);
  ctx.scale(anim.scale ?? 1, anim.scale ?? 1);
  ctx.font = `${clip.fontWeight ?? "bold"} ${clip.fontSize ?? 48}px ${clip.fontFamily ?? "Arial"}`;
  ctx.fillStyle = clip.color ?? "#ffffff";
  ctx.textAlign = clip.align ?? "center";
  if (clip.backgroundColor && clip.backgroundColor !== "transparent") {
    const metrics = ctx.measureText(displayText);
    const padding = clip.padding ?? 8;
    ctx.fillStyle = clip.backgroundColor;
    ctx.fillRect(-metrics.width / 2 - padding, -(clip.fontSize ?? 48), metrics.width + padding * 2, (clip.fontSize ?? 48) + padding * 2);
    ctx.fillStyle = clip.color ?? "#ffffff";
  }
  ctx.fillText(displayText, 0, 0);
  ctx.restore();
}

export function getActiveStickerClips(tracks, time) {
  return tracks
    .filter((track) => track.type === "overlay" && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => time >= clip.start && time <= clip.end);
}

function drawStickerClip(ctx, width, height, clip, time) {
  const elapsed = Math.max(0, time - clip.start);
  const duration = Math.max(0.01, clip.animDuration ?? 0.5);
  const progress = Math.min(elapsed / duration, 1);
  const anim = getTextAnimation(clip.animation || "none")(progress, clip.name || "");
  const image = new Image();
  image.onload = () => {
    ctx.save();
    ctx.globalAlpha = (clip.opacity ?? 1) * (anim.opacity ?? 1);
    ctx.translate((clip.posX ?? 0.5) * width, (clip.posY ?? 0.5) * height + (anim.offsetY ?? 0));
    ctx.rotate(((clip.rotation ?? 0) * Math.PI) / 180);
    const scale = anim.scale ?? 1;
    ctx.scale((clip.scaleX ?? 0.2) * scale, (clip.scaleY ?? 0.2) * scale);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
  };
  image.src = clip.src;
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
      return { current, next, transition, start, end };
    }
  }
  return null;
}

function drawTransition(ctx, width, height, pair, mediaItems, videoElement, time) {
  const progress = Math.max(0, Math.min(1, (time - pair.start) / pair.transition.duration));
  if (pair.transition.type === "fadeToBlack") {
    drawClipFrame(ctx, width, height, pair.current, mediaItems, videoElement, time);
    ctx.fillStyle = `rgba(0,0,0,${progress < 0.5 ? progress * 2 : 1})`;
    ctx.fillRect(0, 0, width, height);
    if (progress >= 0.5) drawClipFrame(ctx, width, height, pair.next, mediaItems, videoElement, time, (progress - 0.5) * 2);
    return;
  }
  if (pair.transition.type === "slideLeft") {
    drawClipFrame(ctx, width, height, pair.current, mediaItems, videoElement, time, 1, -progress * width);
    drawClipFrame(ctx, width, height, pair.next, mediaItems, videoElement, time, 1, (1 - progress) * width);
    return;
  }
  if (pair.transition.type === "wipeLeft") {
    drawClipFrame(ctx, width, height, pair.current, mediaItems, videoElement, time);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, progress * width, height);
    ctx.clip();
    drawClipFrame(ctx, width, height, pair.next, mediaItems, videoElement, time);
    ctx.restore();
    return;
  }
  drawClipFrame(ctx, width, height, pair.current, mediaItems, videoElement, time, 1 - progress);
  drawClipFrame(ctx, width, height, pair.next, mediaItems, videoElement, time, progress);
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

function getCachedImage(src, onLoad) {
  if (!src) return new Image();
  const cached = imageCache.get(src);
  if (cached) {
    if (!cached.complete || !cached.naturalWidth) cached.addEventListener("load", onLoad, { once: true });
    return cached;
  }
  const image = new Image();
  image.addEventListener("load", onLoad, { once: true });
  image.src = src;
  imageCache.set(src, image);
  return image;
}
