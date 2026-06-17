import React, { useState } from "react";
import { Search, X } from "lucide-react";
import { COMMANDS, getCommandsByCategory } from "../../utils/ffmpegCommands.js";
import { CommandButton } from "./CommandButton.jsx";

export function CommandPalettePanel({ mediaType, onRunCommand, capabilities, loadingCommandId }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Semua");

  const categoryMap = getCommandsByCategory();
  const categories = ["Semua", ...Object.keys(categoryMap)];

  const filtered = COMMANDS.filter((cmd) => {
    const matchesMedia = !mediaType || cmd.mediaTypes.includes(mediaType);
    const matchesCategory = activeCategory === "Semua" || cmd.category === activeCategory;
    const matchesSearch = !search || cmd.label.toLowerCase().includes(search.toLowerCase()) || cmd.category.toLowerCase().includes(search.toLowerCase());
    return matchesMedia && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Cari command..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 w-full rounded-md border border-[var(--border)] bg-[#151515] pl-7 pr-7 text-xs text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
        />
        {search && (
          <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white">
            <X size={12} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${activeCategory === cat ? "bg-[var(--accent)] text-[#07111f]" : "border border-[var(--border)] text-[var(--text-muted)] hover:text-white"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {filtered.map((cmd) => {
          const unavailableNative = cmd.requiresNative && capabilities && !capabilities.available;
          return (
            <CommandButton
              key={cmd.id}
              command={cmd}
              onClick={() => onRunCommand?.(cmd)}
              disabled={unavailableNative}
              isLoading={loadingCommandId === cmd.id}
              disabledReason={unavailableNative ? "Butuh FFmpeg native" : ""}
            />
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-[11px] text-[var(--text-muted)] py-4">
            Tidak ada command yang cocok.
          </p>
        )}
      </div>
    </div>
  );
}
