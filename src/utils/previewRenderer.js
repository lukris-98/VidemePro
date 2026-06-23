import { getTextAnimation } from "./animationPresets.js";
import { applyAutoReframe, applyBackgroundRemove, applyFaceBlur } from "./aiEffects.js";
import { applyColorData, buildCSSFilter, drawVignette, drawWithTransform } from "./visualEffects.js";
import { drawShapeClip } from "./shapeLibrary.js";

const imageCache = new Map();

export function renderPreviewFrame(ctx, canvas, { time, tracks, mediaItems, videoElement, imageElement, previewMedia, audioPreviewTime = 0, audioPreviewDuration = 0 }) {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, width, height);

  const hasTimelineContent = tracks.some((track) => track.clips.length);
  if (previewMedia) {
    renderPreviewMedia(ctx, width, height, previewMedia, videoElement, imageElement, audioPreviewTime, audioPreviewDuration);
  } else if (hasTimelineContent) {
    renderTimeline(ctx, width, height, time, tracks, mediaItems, videoElement);
  } else {
    renderPreviewMedia(ctx, width, height, previewMedia, videoElement, imageElement, audioPreviewTime, audioPreviewDuration);
  }

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "12px Arial";
  ctx.textAlign = "right";
  ctx.fillText("Vidme Pro", width - 18, height - 16);
}

export function getActiveTextClips(tracks, time) {
  return tracks
    .filter((track) => !track.muted && track.visible !== false)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.type === "text" && time >= clip.start && time <= clip.end);
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
  for (const clip of getActiveOverlayMediaClips(visualTracks, time)) {
    drawClipFrame(ctx, width, height, clip, mediaItems, videoElement, time);
  }
  for (const clip of getActiveTextClips(visualTracks, time)) {
    drawTextClip(ctx, width, height, clip, time);
  }
  for (const clip of getActiveShapeClips(visualTracks, time)) {
    drawShapeClip(ctx, width, height, clip, time);
  }
  for (const clip of getActiveStickerClips(visualTracks, time)) {
    drawStickerClip(ctx, width, height, clip, time);
  }
}

function renderPreviewMedia(ctx, width, height, previewMedia, videoElement, imageElement, audioPreviewTime = 0, audioPreviewDuration = 0) {
  if (previewMedia?.type === "video" && videoElement?.readyState >= 2) {
    drawContained(ctx, videoElement, width, height, previewMedia);
  } else if (previewMedia?.type === "image" || previewMedia?.type === "photo") {
    if (imageElement?.dataset?.mediaId === previewMedia.id && imageElement.complete && imageElement.naturalWidth) {
      drawContained(ctx, imageElement, width, height, previewMedia);
    }
  } else if (previewMedia?.type === "audio") {
    ctx.fillStyle = "#0b0f12";
    ctx.fillRect(0, 0, width, height);
    drawAudioWaveformPreview(ctx, width, height, previewMedia, audioPreviewTime, audioPreviewDuration);
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

function drawAudioWaveformPreview(ctx, width, height, media, currentTime = 0, duration = 0) {
  const bars = Array.isArray(media.waveformData) && media.waveformData.length
    ? media.waveformData
    : Array.from({ length: 96 }, (_, index) => 0.18 + Math.abs(Math.sin(index * 0.47)) * 0.72);
  const padX = Math.max(28, width * 0.08);
  const waveWidth = Math.max(80, width - padX * 2);
  const centerY = height * 0.48;
  const maxBarHeight = Math.max(36, height * 0.34);
  const barGap = Math.max(2, (waveWidth / bars.length) * 0.32);
  const barWidth = Math.max(2, waveWidth / bars.length - barGap);
  const gradient = ctx.createLinearGradient(padX, centerY - maxBarHeight, padX + waveWidth, centerY + maxBarHeight);
  gradient.addColorStop(0, "#1ed760");
  gradient.addColorStop(0.55, "#4d9eff");
  gradient.addColorStop(1, "#9b5cff");

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(padX, centerY);
  ctx.lineTo(padX + waveWidth, centerY);
  ctx.stroke();
  ctx.fillStyle = gradient;
  bars.forEach((value, index) => {
    const normalized = Math.max(0.06, Math.min(1, Number(value) || 0));
    const x = padX + index * (barWidth + barGap);
    const barHeight = normalized * maxBarHeight;
    ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
  });
  const totalDuration = Math.max(0.01, Number(duration) || Number(media.duration) || 0.01);
  const progress = Math.max(0, Math.min(1, (Number(currentTime) || 0) / totalDuration));
  const playheadX = padX + waveWidth * progress;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playheadX, centerY - maxBarHeight / 2 - 18);
  ctx.lineTo(playheadX, centerY + maxBarHeight / 2 + 18);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(playheadX, centerY + maxBarHeight / 2 + 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(padX, centerY + maxBarHeight / 2 + 31, waveWidth, 4);
  ctx.fillStyle = "#4d9eff";
  ctx.fillRect(padX, centerY + maxBarHeight / 2 + 31, waveWidth * progress, 4);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 15px Arial";
  ctx.textAlign = "center";
  ctx.fillText(media.metadata?.title || media.name || "Audio", width / 2, Math.min(height - 46, centerY + maxBarHeight / 2 + 34));
  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "12px Arial";
  ctx.fillText(`${formatPreviewDuration(media.duration)} - ${media.metadata?.source || "audio"}`, width / 2, Math.min(height - 26, centerY + maxBarHeight / 2 + 54));
  ctx.restore();
}

function formatPreviewDuration(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
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
  const anim = resolveTextAnimation(clip, elapsed);
  const x = (clip.posX ?? 0.5) * width;
  const y = (clip.posY ?? 0.85) * height + (anim.offsetY ?? 0);
  const displayText = anim.visibleChars !== undefined ? (clip.text || "").slice(0, anim.visibleChars) : clip.text || "";

  ctx.save();
  ctx.globalAlpha = (anim.opacity ?? 1) * (clip.opacity ?? 1);
  ctx.translate(x, y);
  ctx.rotate(((clip.rotation ?? 0) * Math.PI) / 180);
  ctx.scale((clip.scaleX ?? 1) * (anim.scale ?? 1), (clip.scaleY ?? 1) * (anim.scale ?? 1));
  const fontSize = clip.fontSize ?? 48;
  const fontFamily = clip.fontFamily ?? "Arial";
  const fontWeight = clip.fontWeight ?? "bold";
  const fontStyle = clip.italic ? "italic" : "normal";
  const letterSpacing = clip.letterSpacing ?? 0;
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = clip.color ?? "#ffffff";
  ctx.textAlign = clip.align ?? "center";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = clip.shadowColor ?? "transparent";
  ctx.shadowBlur = clip.shadowBlur ?? 0;
  ctx.shadowOffsetX = clip.shadowOffsetX ?? 0;
  ctx.shadowOffsetY = clip.shadowOffsetY ?? 0;
  if (Number.isFinite(clip.shadowOpacity) && clip.shadowColor && clip.shadowColor !== "transparent") {
    ctx.shadowColor = colorWithAlpha(clip.shadowColor, clip.shadowOpacity);
  }
  const textWidth = measureSpacedText(ctx, displayText, letterSpacing);
  if (clip.backgroundColor && clip.backgroundColor !== "transparent") {
    const padding = clip.padding ?? 8;
    const alignOffset = textAlignOffset(ctx.textAlign, textWidth);
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = clip.backgroundColor;
    ctx.fillRect(alignOffset - padding, -fontSize, textWidth + padding * 2, fontSize + padding * 2);
    ctx.restore();
    ctx.fillStyle = clip.color ?? "#ffffff";
  }
  if ((clip.strokeWidth ?? 0) > 0) {
    ctx.strokeStyle = clip.stroke ?? "#000000";
    ctx.lineWidth = clip.strokeWidth;
    ctx.lineJoin = "round";
    drawSpacedText(ctx, displayText, 0, 0, letterSpacing, true);
  }
  drawSpacedText(ctx, displayText, 0, 0, letterSpacing, false);
  if (clip.underline) drawTextUnderline(ctx, textWidth, fontSize);
  ctx.restore();
}

function resolveTextAnimation(clip, elapsed) {
  const text = clip.text || "";
  const inName = clip.animationIn ?? clip.animation ?? "none";
  const inDuration = Math.max(0.01, clip.animationInDuration ?? clip.animDuration ?? 0.5);
  if (inName !== "none" && elapsed < inDuration) {
    return getTextAnimation(inName)(Math.min(elapsed / inDuration, 1), text);
  }

  const outName = clip.animationOut ?? "none";
  const outDuration = Math.max(0.01, clip.animationOutDuration ?? 0.5);
  const remaining = Math.max(0, (clip.end ?? 0) - (clip.start ?? 0) - elapsed);
  if (outName !== "none" && remaining < outDuration) {
    return getTextAnimation(outName)(Math.min(1 - remaining / outDuration, 1), text);
  }

  const loopName = clip.animationLoop ?? "none";
  if (loopName !== "none") {
    const loopDuration = Math.max(0.01, clip.animationLoopDuration ?? 1.2);
    const progress = ((elapsed - inDuration) % loopDuration) / loopDuration;
    const anim = getTextAnimation(loopName)(progress, text);
    const intensity = clip.animationLoopIntensity ?? 1;
    return {
      ...anim,
      offsetY: (anim.offsetY ?? 0) * intensity,
      scale: 1 + ((anim.scale ?? 1) - 1) * intensity
    };
  }

  return { opacity: 1, offsetY: 0, scale: 1 };
}

function measureSpacedText(ctx, text, letterSpacing = 0) {
  if (!letterSpacing || text.length < 2) return ctx.measureText(text).width;
  return [...text].reduce((total, character, index, characters) => total + ctx.measureText(character).width + (index < characters.length - 1 ? letterSpacing : 0), 0);
}

function textAlignOffset(align, width) {
  if (align === "left" || align === "start") return 0;
  if (align === "right" || align === "end") return -width;
  return -width / 2;
}

function drawSpacedText(ctx, text, x, y, letterSpacing, stroke) {
  if (!letterSpacing || text.length < 2) {
    if (stroke) ctx.strokeText(text, x, y);
    else ctx.fillText(text, x, y);
    return;
  }
  const totalWidth = measureSpacedText(ctx, text, letterSpacing);
  let cursor = x + textAlignOffset(ctx.textAlign, totalWidth);
  ctx.save();
  ctx.textAlign = "left";
  for (const character of text) {
    if (stroke) ctx.strokeText(character, cursor, y);
    else ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + letterSpacing;
  }
  ctx.restore();
}

function drawTextUnderline(ctx, width, fontSize) {
  const offset = textAlignOffset(ctx.textAlign, width);
  const y = Math.max(2, fontSize * 0.12);
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = Math.max(1, fontSize * 0.06);
  ctx.beginPath();
  ctx.moveTo(offset, y);
  ctx.lineTo(offset + width, y);
  ctx.stroke();
  ctx.restore();
}

function colorWithAlpha(color, alpha) {
  const safeAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }
  return color;
}

export function getActiveStickerClips(tracks, time) {
  return tracks
    .filter((track) => track.type === "overlay" && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.type !== "shape" && clip.type !== "text" && !isMediaClip(clip) && time >= clip.start && time <= clip.end);
}

export function getActiveShapeClips(tracks, time) {
  return tracks
    .filter((track) => track.type === "overlay" && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => clip.type === "shape" && time >= clip.start && time <= clip.end);
}

function getActiveOverlayMediaClips(tracks, time) {
  return tracks
    .filter((track) => track.type === "overlay" && !track.muted)
    .flatMap((track) => track.clips)
    .filter((clip) => isMediaClip(clip) && time >= clip.start && time <= clip.end);
}

function isMediaClip(clip) {
  return clip.type === "video" || clip.type === "image" || clip.type === "photo";
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

function drawContained(ctx, source, width, height, media = null) {
  const mediaWidth = Number(media?.width) || 0;
  const mediaHeight = Number(media?.height) || 0;
  const sourceWidth = mediaWidth || source.videoWidth || source.naturalWidth || width;
  const sourceHeight = mediaHeight || source.videoHeight || source.naturalHeight || height;
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
