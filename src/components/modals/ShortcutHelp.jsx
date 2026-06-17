import React from "react";
import { X } from "lucide-react";
import { shortcutRows } from "../../hooks/useKeyboardShortcuts.js";
import { useUiStore } from "../../store/uiStore.js";

export function ShortcutHelp() {
  const open = useUiStore((state) => state.shortcutHelpOpen);
  const close = useUiStore((state) => state.closeShortcutHelp);
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65">
      <div className="w-[520px] rounded-md border border-[var(--border)] bg-[var(--bg-panel)] shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-4 text-sm font-semibold">
          Shortcut
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-md hover:bg-[var(--bg-hover)]">
            <X size={17} />
          </button>
        </div>
        <div className="grid gap-1 p-4 text-sm">
          {shortcutRows.map(([keys, label]) => (
            <div key={keys} className="grid grid-cols-[160px_1fr] rounded-md px-3 py-2 hover:bg-[var(--bg-hover)]">
              <kbd className="font-mono text-xs text-[var(--accent)]">{keys}</kbd>
              <span className="text-[var(--text-secondary)]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
