import React, { useEffect, useRef, useState } from "react";
import { Download, Menu, Share2 } from "lucide-react";
import vidmeLogo from "../../assets/vidme-logo.png";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { FFmpegStatusBadge } from "../ui/FFmpegStatusBadge.jsx";

function IconButton({ title, children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 place-items-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

export function TopBar({ leftWidth = 420, rightWidth = 420 }) {
  const projectName = useProjectStore((state) => state.projectName);
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const openExport = useUiStore((state) => state.openExport);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const projectNameInputRef = useRef(null);

  useEffect(() => {
    if (!editingProjectName) setProjectNameDraft(projectName);
  }, [editingProjectName, projectName]);

  useEffect(() => {
    if (!editingProjectName) return;
    projectNameInputRef.current?.focus();
    projectNameInputRef.current?.select();
  }, [editingProjectName]);

  const commitProjectName = () => {
    setProjectName(projectNameDraft);
    setEditingProjectName(false);
  };

  return (
    <header
      className="grid h-12 items-center border-b border-[var(--border)] bg-[var(--bg-topbar)] px-3"
      style={{ gridTemplateColumns: `${leftWidth}px 4px minmax(420px, 1fr) 4px ${rightWidth}px` }}
    >
      <div className="flex items-center gap-2">
        <img
          src={vidmeLogo}
          alt="Vidme Pro"
          className="h-8 w-8 rounded-lg object-cover"
        />
        <span className="text-sm font-semibold">Vidme Pro</span>
        <IconButton title="Menu">
          <Menu size={18} />
        </IconButton>
      </div>
      <div className="col-start-3 flex min-w-0 items-center justify-center">
        {editingProjectName ? (
          <input
            ref={projectNameInputRef}
            value={projectNameDraft}
            onChange={(event) => setProjectNameDraft(event.target.value)}
            onBlur={commitProjectName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitProjectName();
              if (event.key === "Escape") {
                setProjectNameDraft(projectName);
                setEditingProjectName(false);
              }
            }}
            className="h-8 max-w-[240px] rounded-md border border-[var(--accent)] bg-[#121212] px-3 text-center text-xs text-white outline-none"
            aria-label="Rename project"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingProjectName(true)}
            className="h-8 max-w-[240px] truncate rounded-md px-3 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-white"
            title="Klik untuk rename project"
          >
            {projectName}
          </button>
        )}
      </div>
      <div className="col-start-5 flex items-center justify-end gap-2">
        <FFmpegStatusBadge />
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <Share2 size={16} />
          Bagikan
        </button>
        <button
          type="button"
          onClick={openExport}
          className="flex h-8 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-sm font-semibold text-[#07111f] hover:bg-[var(--accent-strong)] active:translate-y-px"
        >
          <Download size={16} />
          Ekspor
        </button>
      </div>
    </header>
  );
}
