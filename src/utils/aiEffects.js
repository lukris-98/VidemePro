export const defaultBgRemove = {
  enabled: false,
  bgType: "blur",
  bgColor: "#00ff66",
  blurAmount: 18,
  softness: 0.18,
  maskUrl: null
};

export const defaultFaceBlur = {
  enabled: false,
  intensity: 18,
  boxes: [{ x: 0.36, y: 0.18, w: 0.28, h: 0.28 }]
};

export const defaultAutoReframe = {
  enabled: false,
  targetAspect: "9:16",
  centerX: 0.5,
  centerY: 0.42
};

const maskCache = new Map();

export function applyBackgroundRemove(ctx, width, height, clip) {
  const bg = { ...defaultBgRemove, ...(clip.bgRemove ?? {}) };
  if (!bg.enabled) return;
  const frame = ctx.getImageData(0, 0, width, height);
  ctx.save();
  if (bg.bgType === "color") {
    ctx.fillStyle = bg.bgColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.filter = `blur(${bg.blurAmount}px) saturate(0.75)`;
    ctx.putImageData(frame, 0, 0);
    ctx.drawImage(ctx.canvas, -bg.blurAmount, -bg.blurAmount, width + bg.blurAmount * 2, height + bg.blurAmount * 2);
    ctx.filter = "none";
  }
  const subject = document.createElement("canvas");
  subject.width = width;
  subject.height = height;
  const subjectCtx = subject.getContext("2d");
  subjectCtx.putImageData(frame, 0, 0);
  subjectCtx.globalCompositeOperation = "destination-in";
  const mask = getMaskImage(bg.maskUrl);
  if (mask?.complete) {
    subjectCtx.drawImage(mask, 0, 0, width, height);
  } else {
    const gradient = subjectCtx.createRadialGradient(width * 0.5, height * 0.35, width * 0.08, width * 0.5, height * 0.44, width * (0.28 + bg.softness));
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.58, "rgba(255,255,255,1)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    subjectCtx.fillStyle = gradient;
    subjectCtx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(subject, 0, 0);
  ctx.restore();
}

function getMaskImage(maskUrl) {
  if (!maskUrl) return null;
  if (maskCache.has(maskUrl)) return maskCache.get(maskUrl);
  const image = new Image();
  image.src = maskUrl;
  maskCache.set(maskUrl, image);
  return image;
}

export function applyFaceBlur(ctx, width, height, clip) {
  const faceBlur = { ...defaultFaceBlur, ...(clip.faceBlur ?? {}) };
  if (!faceBlur.enabled) return;
  ctx.save();
  for (const box of faceBlur.boxes ?? defaultFaceBlur.boxes) {
    const x = box.x * width;
    const y = box.y * height;
    const w = box.w * width;
    const h = box.h * height;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = `blur(${faceBlur.intensity}px)`;
    ctx.drawImage(ctx.canvas, x, y, w, h, x, y, w, h);
    ctx.filter = "none";
    ctx.strokeStyle = "rgba(77,158,255,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export function applyAutoReframe(ctx, width, height, clip) {
  const reframe = { ...defaultAutoReframe, ...(clip.autoReframe ?? {}) };
  if (!reframe.enabled) return;
  const [aspectW, aspectH] = reframe.targetAspect.split(":").map(Number);
  const targetRatio = aspectW / aspectH;
  const currentRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = width;
  let sh = height;
  if (targetRatio < currentRatio) {
    sw = height * targetRatio;
    sx = Math.max(0, Math.min(width - sw, reframe.centerX * width - sw / 2));
  } else {
    sh = width / targetRatio;
    sy = Math.max(0, Math.min(height - sh, reframe.centerY * height - sh / 2));
  }
  const frame = document.createElement("canvas");
  frame.width = width;
  frame.height = height;
  frame.getContext("2d").drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(frame, 0, 0);
}
