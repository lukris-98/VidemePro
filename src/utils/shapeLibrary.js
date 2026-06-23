import Konva from "konva";
import { getTextAnimation } from "./animationPresets.js";

export const shapePresets = [
  { id: "rectangle", name: "Rectangle", shapeType: "rectangle", fill: "#4d9eff", stroke: "#ffffff", strokeWidth: 0, cornerRadius: 18, scaleX: 0.34, scaleY: 0.2 },
  { id: "circle", name: "Circle", shapeType: "circle", fill: "#f1c94c", stroke: "#ffffff", strokeWidth: 0, scaleX: 0.22, scaleY: 0.22 },
  { id: "triangle", name: "Triangle", shapeType: "triangle", fill: "#3ddc84", stroke: "#ffffff", strokeWidth: 0, scaleX: 0.28, scaleY: 0.28 },
  { id: "diamond", name: "Diamond", shapeType: "diamond", fill: "#ff6b6b", stroke: "#ffffff", strokeWidth: 0, scaleX: 0.26, scaleY: 0.26 },
  { id: "star", name: "Star", shapeType: "star", fill: "#b78cff", stroke: "#ffffff", strokeWidth: 0, scaleX: 0.25, scaleY: 0.25 },
  { id: "line", name: "Line", shapeType: "line", fill: "#ffffff", stroke: "#ffffff", strokeWidth: 10, scaleX: 0.38, scaleY: 0.06 }
];

export function createShapeClip(trackId, preset, start) {
  const shape = preset ?? shapePresets[0];
  return {
    id: crypto.randomUUID(),
    trackId,
    type: "shape",
    name: shape.name,
    start,
    end: start + 4,
    inPoint: 0,
    outPoint: 4,
    mediaDuration: 4,
    shapeType: shape.shapeType,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    cornerRadius: shape.cornerRadius ?? 0,
    posX: 0.5,
    posY: 0.5,
    scaleX: shape.scaleX,
    scaleY: shape.scaleY,
    rotation: 0,
    opacity: 0.92,
    animation: "none",
    animDuration: 0,
    timelineColor: "var(--clip-text)"
  };
}

export function drawShapeClip(ctx, width, height, clip, time) {
  const elapsed = Math.max(0, time - clip.start);
  const duration = Math.max(0.01, clip.animDuration ?? 0.35);
  const progress = Math.min(elapsed / duration, 1);
  const anim = getTextAnimation(clip.animation || "none")(progress, clip.name || "");
  const x = (clip.posX ?? 0.5) * width;
  const y = (clip.posY ?? 0.5) * height + (anim.offsetY ?? 0);
  const baseSize = Math.min(width, height);
  const shapeWidth = Math.max(1, baseSize * (clip.scaleX ?? 0.25));
  const shapeHeight = Math.max(1, baseSize * (clip.scaleY ?? 0.25));
  const radius = Math.min(shapeWidth, shapeHeight) / 2;
  const fill = clip.fill ?? clip.color ?? "#4d9eff";
  const stroke = clip.stroke ?? "transparent";
  const strokeWidth = Number(clip.strokeWidth) || 0;

  ctx.save();
  ctx.globalAlpha = (clip.opacity ?? 1) * (anim.opacity ?? 1);
  ctx.translate(x, y);
  ctx.rotate(((clip.rotation ?? 0) * Math.PI) / 180);
  ctx.scale(anim.scale ?? 1, anim.scale ?? 1);
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;

  if (clip.shapeType === "circle") {
    ctx.beginPath();
    ctx.ellipse(0, 0, shapeWidth / 2, shapeHeight / 2, 0, 0, Math.PI * 2);
    fillAndStroke(ctx, strokeWidth);
  } else if (clip.shapeType === "triangle") {
    polygon(ctx, 3, radius, -Math.PI / 2);
    fillAndStroke(ctx, strokeWidth);
  } else if (clip.shapeType === "diamond") {
    polygon(ctx, 4, radius, Math.PI / 4);
    fillAndStroke(ctx, strokeWidth);
  } else if (clip.shapeType === "star") {
    star(ctx, 5, radius * 0.45, radius);
    fillAndStroke(ctx, strokeWidth);
  } else if (clip.shapeType === "line") {
    ctx.lineCap = "round";
    ctx.strokeStyle = stroke || fill;
    ctx.lineWidth = Math.max(2, strokeWidth || shapeHeight);
    ctx.beginPath();
    ctx.moveTo(-shapeWidth / 2, 0);
    ctx.lineTo(shapeWidth / 2, 0);
    ctx.stroke();
  } else {
    roundedRect(ctx, -shapeWidth / 2, -shapeHeight / 2, shapeWidth, shapeHeight, clip.cornerRadius ?? 0);
    fillAndStroke(ctx, strokeWidth);
  }

  ctx.restore();
}

export function createKonvaPreviewNode(preset, stageSize = 132) {
  const common = {
    x: stageSize / 2,
    y: stageSize / 2,
    fill: preset.fill,
    stroke: preset.stroke,
    strokeWidth: preset.strokeWidth,
    opacity: 0.94,
    shadowBlur: 8,
    shadowColor: "rgba(0,0,0,0.45)"
  };
  const size = stageSize * 0.45;
  if (preset.shapeType === "circle") return new Konva.Circle({ ...common, radius: size * 0.55 });
  if (preset.shapeType === "triangle") return new Konva.RegularPolygon({ ...common, sides: 3, radius: size * 0.7, rotation: -90 });
  if (preset.shapeType === "diamond") return new Konva.RegularPolygon({ ...common, sides: 4, radius: size * 0.7, rotation: 45 });
  if (preset.shapeType === "star") return new Konva.Star({ ...common, numPoints: 5, innerRadius: size * 0.28, outerRadius: size * 0.62 });
  if (preset.shapeType === "line") return new Konva.Line({ ...common, points: [-stageSize * 0.28, 0, stageSize * 0.28, 0], stroke: preset.stroke, strokeWidth: 9, lineCap: "round" });
  return new Konva.Rect({ ...common, width: size * 1.35, height: size * 0.82, offsetX: (size * 1.35) / 2, offsetY: (size * 0.82) / 2, cornerRadius: preset.cornerRadius ?? 0 });
}

function fillAndStroke(ctx, strokeWidth) {
  ctx.fill();
  if (strokeWidth > 0) ctx.stroke();
}

function polygon(ctx, sides, radius, offset = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = offset + (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function star(ctx, points, innerRadius, outerRadius) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
