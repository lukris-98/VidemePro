import React from "react";
import { ArrowDownZA, ArrowUpAZ, Filter, Grid2X2, Rows3, Upload, Video } from "lucide-react";
import { useMediaImport } from "../../hooks/useMediaImport.js";

export function MediaImporter({ filter, filters = [], onFilterChange, sortOrder, onSortOrderChange, viewMode, onViewModeChange }) {
  const { inputProps, openPicker, importFiles } = useMediaImport();
  const SortIcon = sortOrder === "za" ? ArrowDownZA : ArrowUpAZ;
  const ViewIcon = viewMode === "tiles" ? Rows3 : Grid2X2;

  return (
    <div
      className="rounded-md border border-dashed border-[var(--border)] bg-[#151515] p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        importFiles(event.dataTransfer.files);
      }}
    >
      <input {...inputProps} />
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          title="Impor"
          onClick={openPicker}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-[#07111f] hover:bg-[var(--accent-strong)] active:translate-y-px"
        >
          <Upload size={15} />
        </button>
        <button
          type="button"
          title="Rekam"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/25 text-white hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <Video size={15} />
        </button>
        <label className="relative min-w-0 flex-1">
          <Filter className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <select
            aria-label="Filter media"
            value={filter}
            onChange={(event) => onFilterChange?.(event.target.value)}
            className="h-10 w-full rounded-md border border-[var(--border)] bg-[#111] pl-8 pr-2 text-xs text-[var(--text-secondary)] outline-none hover:bg-[var(--bg-hover)]"
          >
            {filters.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          title={sortOrder === "za" ? "Sort Z-A" : "Sort A-Z"}
          onClick={() => onSortOrderChange?.(sortOrder === "az" ? "za" : "az")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <SortIcon size={15} />
        </button>
        <button
          type="button"
          title={viewMode === "tiles" ? "Tampilan tiles" : "Tampilan thumbnail"}
          onClick={() => onViewModeChange?.(viewMode === "thumbnail" ? "tiles" : "thumbnail")}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <ViewIcon size={15} />
        </button>
      </div>
      <p className="text-xs leading-5 text-[var(--text-muted)]">Drag file ke sini atau klik Impor untuk menambahkan media lokal.</p>
    </div>
  );
}
