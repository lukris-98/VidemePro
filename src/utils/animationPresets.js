export const textAnimationPresets = {
  none: () => ({ opacity: 1, offsetY: 0, scale: 1 }),
  fadeIn: (progress) => ({ opacity: progress }),
  fadeOut: (progress) => ({ opacity: 1 - progress }),
  slideUp: (progress) => ({ opacity: progress, offsetY: (1 - progress) * 50 }),
  slideDown: (progress) => ({ opacity: progress, offsetY: -(1 - progress) * 50 }),
  typewriter: (progress, text) => ({ visibleChars: Math.floor(progress * text.length), opacity: 1 }),
  bounce: (progress) => ({ opacity: 1, scale: 1 + Math.sin(progress * Math.PI) * 0.1 }),
  zoomIn: (progress) => ({ opacity: progress, scale: Math.max(0.05, progress) }),
  zoomOut: (progress) => ({ opacity: 1 - progress, scale: Math.max(0.05, 1 - progress) }),
  slideUpOut: (progress) => ({ opacity: 1 - progress, offsetY: -progress * 50 }),
  slideDownOut: (progress) => ({ opacity: 1 - progress, offsetY: progress * 50 }),
  pulse: (progress) => ({ opacity: 1, scale: 1 + Math.sin(progress * Math.PI * 2) * 0.08 }),
  float: (progress) => ({ opacity: 1, offsetY: Math.sin(progress * Math.PI * 2) * 10 }),
  flicker: (progress) => ({ opacity: 0.65 + Math.abs(Math.sin(progress * Math.PI * 8)) * 0.35 })
};

export function getTextAnimation(name) {
  return textAnimationPresets[name] ?? textAnimationPresets.none;
}
