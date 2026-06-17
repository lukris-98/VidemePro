export const textAnimationPresets = {
  none: () => ({ opacity: 1, offsetY: 0, scale: 1 }),
  fadeIn: (progress) => ({ opacity: progress }),
  fadeOut: (progress) => ({ opacity: 1 - progress }),
  slideUp: (progress) => ({ opacity: progress, offsetY: (1 - progress) * 50 }),
  slideDown: (progress) => ({ opacity: progress, offsetY: -(1 - progress) * 50 }),
  typewriter: (progress, text) => ({ visibleChars: Math.floor(progress * text.length), opacity: 1 }),
  bounce: (progress) => ({ opacity: 1, scale: 1 + Math.sin(progress * Math.PI) * 0.1 }),
  zoomIn: (progress) => ({ opacity: progress, scale: Math.max(0.05, progress) })
};

export function getTextAnimation(name) {
  return textAnimationPresets[name] ?? textAnimationPresets.none;
}
