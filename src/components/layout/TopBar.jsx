import React, { useEffect, useRef, useState } from "react";
import { Download, FolderOpen, Menu, Share2, Video, X } from "lucide-react";
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

async function requestVidmeSettings(action, payload = {}) {
  const nativeSettings = window.videmeNative?.settings;
  if (nativeSettings?.[action]) {
    if (action === "save") return nativeSettings.save(payload.rootDir);
    return nativeSettings[action]();
  }
  const endpoint = action === "get" ? "/vidme-settings/get" : action === "browse" ? "/vidme-settings/browse" : "/vidme-settings/save";
  const response = await fetch(endpoint, action === "save"
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    : undefined);
  return response.json();
}

function SettingsDialog({ onClose }) {
  const [rootDir, setRootDir] = useState("C:\\Vidme Pro");
  const [draft, setDraft] = useState("C:\\Vidme Pro");
  const [status, setStatus] = useState("Memuat lokasi...");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    requestVidmeSettings("get")
      .then((result) => {
        if (!alive) return;
        const next = result?.rootDir || "C:\\Vidme Pro";
        setRootDir(next);
        setDraft(next);
        setStatus(result?.ok ? "Lokasi aktif siap dipakai." : "Gagal membaca lokasi aktif.");
      })
      .catch((error) => {
        if (!alive) return;
        setStatus(error instanceof Error ? error.message : "Gagal membaca seting.");
      });
    return () => { alive = false; };
  }, []);

  const applyResult = (result) => {
    if (!result?.ok) {
      setStatus(result?.cancelled ? "Pemilihan folder dibatalkan." : result?.error || "Gagal menyimpan lokasi.");
      return;
    }
    setRootDir(result.rootDir);
    setDraft(result.rootDir);
    setStatus(result.moved ? "Folder lama berhasil dipindahkan ke lokasi baru." : "Lokasi Vidme Pro diperbarui.");
  };

  const browse = async () => {
    setBusy(true);
    setStatus("Membuka pemilih folder...");
    try {
      applyResult(await requestVidmeSettings("browse"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal memilih folder.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setStatus("Menyimpan lokasi dan memindahkan folder bila perlu...");
    try {
      applyResult(await requestVidmeSettings("save", { rootDir: draft }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gagal menyimpan lokasi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-[min(520px,calc(100vw-32px))] rounded-md border border-[var(--border)] bg-[#101010] p-4 text-white shadow-2xl shadow-black/70" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">Seting Vidme Pro</div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Atur lokasi utama penyimpanan file lokal.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md border border-red-500/45 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white">
            <X size={15} />
          </button>
        </div>
        <label className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Lokasi Folder Vidme Pro
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[#0d0d0d] px-3 text-xs font-semibold normal-case tracking-normal text-white outline-none focus:border-[var(--accent)]"
            />
            <button type="button" disabled={busy} onClick={browse} className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-xs font-bold normal-case tracking-normal text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white disabled:opacity-50">
              <FolderOpen size={14} />
              Browse
            </button>
          </div>
        </label>
        <div className="mt-3 rounded-md border border-[var(--border)] bg-[#0b0b0b] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
          Default: <span className="font-semibold text-white">C:\Vidme Pro</span>. Jika lokasi diganti, folder lama dipindahkan ke lokasi baru supaya file tidak dobel.
        </div>
        <div className="mt-3 text-[11px] text-[var(--text-muted)]">Aktif sekarang: <span className="text-white">{rootDir}</span></div>
        {status ? <div className="mt-2 text-[11px] text-[var(--accent)]">{status}</div> : null}
        <div className="mt-4 grid grid-cols-[1fr_92px] gap-2">
          <button type="button" disabled={busy || !draft.trim()} onClick={save} className="h-9 rounded-md bg-[var(--accent)] px-3 text-xs font-bold text-[#07111f] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-45">
            {busy ? "Memproses..." : "Simpan Lokasi"}
          </button>
          <button type="button" onClick={onClose} className="h-9 rounded-md border border-[var(--border)] bg-[#151515] px-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

export function TopBar({ leftWidth = 420, rightWidth = 420 }) {
  const projectName = useProjectStore((state) => state.projectName);
  const setProjectName = useProjectStore((state) => state.setProjectName);
  const openExport = useUiStore((state) => state.openExport);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(projectName);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordStatus, setRecordStatus] = useState("");
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

  const handleRecordClick = async () => {
    setRecordStatus("");
    try {
      const openRecorder = window.videmeNative?.sharex?.openRecorder;
      if (!openRecorder) {
        setRecordStatus("ShareX recorder tersedia di desktop app.");
        return;
      }
      const result = await openRecorder();
      setRecordStatus(result?.ok ? "ShareX recorder dibuka." : result?.error || "Gagal membuka ShareX.");
    } catch (error) {
      setRecordStatus(error instanceof Error ? error.message : "Gagal membuka ShareX.");
    }
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
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="h-7 rounded-md border border-white/45 bg-white px-3 text-xs font-extrabold shadow-sm transition-transform active:translate-y-px"
          title="Seting lokasi file Vidme Pro"
        >
          <span className="bg-gradient-to-r from-[#2f8cff] via-[#9a63ff] to-[#00b86b] bg-clip-text text-transparent">Seting</span>
        </button>
        <button
          type="button"
          onClick={handleRecordClick}
          className="flex h-7 items-center gap-1.5 rounded-md border border-red-400/50 bg-red-500/10 px-2.5 text-xs font-bold text-red-100 hover:bg-red-500/20 hover:text-white active:translate-y-px"
          title="Buka ShareX screen recorder"
        >
          <Video size={14} />
          Rekam
        </button>
        <IconButton title="Menu">
          <Menu size={18} />
        </IconButton>
        {recordStatus ? <span className="max-w-[180px] truncate text-[10px] text-[var(--text-muted)]" title={recordStatus}>{recordStatus}</span> : null}
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
      {settingsOpen ? <SettingsDialog onClose={() => setSettingsOpen(false)} /> : null}
    </header>
  );
}
