import React from "react";
import {
  RefreshCw, Archive, Music, Camera, Info, ScanSearch, Crop,
  RotateCw, FlipHorizontal, Sun, Captions, Badge, AudioLines,
  Waves, Download, Terminal, Globe, Layers, Package, VolumeX,
  Headphones, Images, Loader2, Palette, Droplets, Focus, Contrast
} from "lucide-react";

const ICON_COMPONENTS = {
  RefreshCw, Archive, Music, Camera, Info, ScanSearch, Crop,
  RotateCw, FlipHorizontal, Sun, Captions, Badge, AudioLines,
  Waves, Download, Terminal, Globe, Layers, Package, VolumeX,
  Headphones, Images, Palette, Droplets, Focus, Contrast,
  CircleHalf: Contrast
};

export function CommandButton({
  command,
  onClick,
  disabled = false,
  isActive = false,
  isLoading = false,
  disabledReason = "",
  size = "md",
  showLabel = true
}) {
  const iconName = command?.icon || "Terminal";
  const IconComp = ICON_COMPONENTS[iconName] || Terminal;
  const label = command?.label || "Command";
  const title = disabledReason ? `${label} — ${disabledReason}` : label;

  const sizeClasses = {
    sm: "h-7 gap-1 px-2 text-[11px]",
    md: "h-8 gap-1.5 px-2.5 text-xs",
    lg: "h-9 gap-2 px-3 text-sm"
  }[size] || "h-8 gap-1.5 px-2.5 text-xs";

  const iconSize = size === "sm" ? 12 : size === "lg" ? 16 : 14;

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={[
        "flex items-center justify-center rounded-md border font-medium transition",
        sizeClasses,
        isActive
          ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
          : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white",
        disabled || isLoading ? "cursor-not-allowed opacity-40" : ""
      ].join(" ")}
    >
      {isLoading
        ? <Loader2 size={iconSize} className="animate-spin" />
        : <IconComp size={iconSize} />
      }
      {showLabel && <span className="leading-none">{label}</span>}
    </button>
  );
}
