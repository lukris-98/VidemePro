import React, { useState } from "react";
import { Activity, X } from "lucide-react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

export function StabilizeModal() {
  const open = useUiStore((state) => state.stabilizeOpen);
  const close = useUiStore((state) => state.closeStabilize);
  const stabilizeSelectedClip = useProjectStore((state) => state.stabilizeSelectedClip);
  const [strength, setStrength] = useState(50);
  const [crop, setCrop] = useState(8);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const apply = async () => {
    setLoading(true);
    setProgress(0);
    for (let i = 1; i <= 30; i += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      setProgress(i / 30);
    }
    stabilizeSelectedClip(strength, crop);
    setLoading(false);
    close();
  };

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[440px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4 text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Activity size={17} />
            Stabilize
          </span>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-4 p-4 text-sm">
          <Range label={`Kekuatan ${strength}`} value={strength} min="0" max="100" onChange={setStrength} />
          <Range label={`Crop tambahan ${crop}%`} value={crop} min="0" max="20" onChange={setCrop} />
          {loading ? (
            <div className="h-2 overflow-hidden rounded bg-[#252525]">
              <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
          ) : null}
          <p className="text-xs leading-5 text-[var(--text-muted)]">Placeholder: stabilisasi penuh butuh FFmpeg vidstab plugin. Untuk sekarang klip diberi badge Stab dan crop tambahan.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <button type="button" onClick={close} className="h-9 rounded-md border border-[var(--border)] px-4 text-sm hover:bg-[var(--bg-hover)]">
            Batal
          </button>
          <button type="button" disabled={loading} onClick={apply} className="h-9 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[#07111f] disabled:opacity-50">
            Analisis & Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}

function Range({ label, value, min, max, onChange }) {
  return (
    <label className="grid gap-2 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="accent-[var(--accent)]" />
    </label>
  );
}
