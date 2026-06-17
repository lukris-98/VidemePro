export const filterPresets = {
  none: { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 0 },
  vivid: { brightness: 10, contrast: 20, saturation: 30, hue: 0, temperature: 0 },
  matte: { brightness: 5, contrast: -10, saturation: -20, hue: 0, temperature: 0 },
  bw: { brightness: 0, contrast: 0, saturation: -100, hue: 0, temperature: 0 },
  vintage: { brightness: -5, contrast: 5, saturation: -30, hue: 20, temperature: -20 },
  cool: { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: 30 },
  warm: { brightness: 0, contrast: 0, saturation: 0, hue: 0, temperature: -30 },
  cinematic: { brightness: -5, contrast: 15, saturation: -15, hue: 0, temperature: 0 },
  fade: { brightness: 15, contrast: -15, saturation: -30, hue: 0, temperature: 0 }
};

export const defaultFilters = {
  preset: "none",
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  sharpness: 0,
  vignette: 0,
  temperature: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  clarity: 0,
  vibrance: 0
};

export const defaultTransform = {
  cropX: 0,
  cropY: 0,
  cropW: 1,
  cropH: 1,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  flipH: false,
  flipV: false,
  posX: 0,
  posY: 0
};

export const defaultEffects = {
  blur: 0,
  vignette: { intensity: 0, softness: 0.5 },
  glitch: 0,
  grain: 0
};

export const builtinStickers = [
  { id: "spark", name: "Spark", src: svgSticker("#f1c94c", "M50 4 62 36 96 50 62 64 50 96 38 64 4 50 38 36Z") },
  { id: "arrow", name: "Arrow", src: svgSticker("#4d9eff", "M10 44h58L48 24l8-8 34 34-34 34-8-8 20-20H10Z") },
  { id: "badge", name: "Badge", src: svgSticker("#3ddc84", "M50 6a44 44 0 1 0 0 88 44 44 0 0 0 0-88Zm-6 62L25 49l7-7 12 12 25-25 7 7Z") },
  { id: "circle", name: "Circle", src: svgSticker("#ff5a7a", "M50 8a42 42 0 1 0 0 84 42 42 0 0 0 0-84Z") }
];

export function mergePreset(filters = defaultFilters, presetName = "none") {
  return { ...defaultFilters, ...filters, preset: presetName, ...(filterPresets[presetName] ?? {}) };
}

export function buildCSSFilter(filters = defaultFilters, effects = defaultEffects) {
  const preset = filterPresets[filters.preset] ?? {};
  const merged = { ...defaultFilters, ...preset, ...filters };
  const brightness = 1 + (merged.brightness + merged.exposure * 12) / 100;
  const contrast = 1 + merged.contrast / 100;
  const saturation = 1 + (merged.saturation + merged.vibrance * 0.5) / 100;
  const hue = merged.hue || 0;
  const blur = effects.blur || 0;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${Math.max(0, saturation)}) hue-rotate(${hue}deg) blur(${blur}px)`;
}

export function drawVignette(ctx, width, height, filters = {}, effects = {}) {
  const filterVignette = (filters.vignette ?? 0) / 100;
  const effectVignette = effects.vignette?.intensity ?? 0;
  const intensity = Math.max(filterVignette, effectVignette);
  if (!intensity) return;
  const softness = effects.vignette?.softness ?? 0.5;
  const radius = Math.max(width, height);
  const gradient = ctx.createRadialGradient(width / 2, height / 2, radius * (0.15 + softness * 0.25), width / 2, height / 2, radius * 0.72);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, intensity)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

export function applyColorData(ctx, width, height, filters = defaultFilters) {
  const temp = filters.temperature ?? 0;
  const tint = filters.tint ?? 0;
  const exposure = filters.exposure ?? 0;
  const shadows = filters.shadows ?? 0;
  const highlights = filters.highlights ?? 0;
  if (!temp && !tint && !exposure && !shadows && !highlights) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luma = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const shadowBoost = luma < 96 ? shadows * 0.4 : 0;
    const highlightBoost = luma > 170 ? highlights * 0.4 : 0;
    data[i] = clamp(data[i] + exposure * 8 - temp * 0.8 + tint * 0.25 + shadowBoost + highlightBoost);
    data[i + 1] = clamp(data[i + 1] - tint * 0.6 + shadowBoost + highlightBoost);
    data[i + 2] = clamp(data[i + 2] + temp * 0.8 + tint * 0.25 + shadowBoost + highlightBoost);
  }
  ctx.putImageData(imageData, 0, 0);
}

export function drawWithTransform(ctx, source, clip, width, height, offsetX = 0) {
  const transform = { ...defaultTransform, ...(clip.transform ?? {}) };
  const sourceWidth = source.videoWidth || source.naturalWidth || width;
  const sourceHeight = source.videoHeight || source.naturalHeight || height;
  const sx = transform.cropX * sourceWidth;
  const sy = transform.cropY * sourceHeight;
  const sw = transform.cropW * sourceWidth;
  const sh = transform.cropH * sourceHeight;
  ctx.save();
  ctx.translate(width / 2 + transform.posX * width * 0.5 + offsetX, height / 2 + transform.posY * height * 0.5);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale((transform.flipH ? -1 : 1) * transform.scaleX, (transform.flipV ? -1 : 1) * transform.scaleY);
  ctx.drawImage(source, sx, sy, sw, sh, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export function svgSticker(color, path) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="${color}" d="${path}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}
