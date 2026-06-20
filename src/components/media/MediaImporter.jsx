import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownZA,
  ArrowUpAZ,
  BriefcaseBusiness,
  Car,
  Dumbbell,
  ExternalLink,
  Filter,
  Grid2X2,
  Info,
  Loader2,
  Download,
  Eye,
  Monitor,
  Music,
  PawPrint,
  Plane,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Rows3,
  Search,
  Shapes,
  SlidersHorizontal,
  Star,
  Trees,
  Upload,
  UserRound,
  Utensils,
  Video,
  Wallpaper,
  MessageCircle,
  Smile,
  Laugh,
  Flame,
  Heart
} from "lucide-react";
import { useMediaImport } from "../../hooks/useMediaImport.js";
import { useMediaStore } from "../../store/mediaStore.js";
import { HorizontalRail } from "../ui/HorizontalRail.jsx";
import { ModernSelect } from "../ui/ModernSelect.jsx";

export function MediaImporter({
  filter,
  filters = [],
  onFilterChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
  onOnlineAssetReady,
  onSourceTabChange,
  resultsSlotId
}) {
  const { inputProps, openPicker, importFiles } = useMediaImport();
  const addMediaItem = useMediaStore((state) => state.addMediaItem);
  const setTransientPreviewMedia = useMediaStore((state) => state.setTransientPreviewMedia);
  const SortIcon = sortOrder === "za" ? ArrowDownZA : ArrowUpAZ;
  const ViewIcon = viewMode === "tiles" ? Rows3 : Grid2X2;
  const [sourceTab, setSourceTab] = useState("device");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [sourceFilters, setSourceFilters] = useState({
    category: "all",
    orientation: "horizontal",
    order: "popular",
    safeSearch: true
  });
  const [pixabayQuery, setPixabayQuery] = useState("");
  const [pixabayPage, setPixabayPage] = useState(1);
  const [pixabayResults, setPixabayResults] = useState([]);
  const [pixabayTotalResults, setPixabayTotalResults] = useState(0);
  const [pixabayHasNext, setPixabayHasNext] = useState(false);
  const [pixabayStatus, setPixabayStatus] = useState("idle");
  const [pixabayMessage, setPixabayMessage] = useState("");
  const [giphyQuery, setGiphyQuery] = useState("");
  const [giphyPage, setGiphyPage] = useState(1);
  const [giphyResults, setGiphyResults] = useState([]);
  const [giphyTotalResults, setGiphyTotalResults] = useState(0);
  const [giphyHasNext, setGiphyHasNext] = useState(false);
  const [giphyStatus, setGiphyStatus] = useState("idle");
  const [giphyMessage, setGiphyMessage] = useState("");
  const [previewAssets, setPreviewAssets] = useState({});
  const [cachedAssets, setCachedAssets] = useState({});
  const [downloadStatus, setDownloadStatus] = useState({});
  const [resultsSlot, setResultsSlot] = useState(null);
  const [onlinePreviewMode, setOnlinePreviewMode] = useState("dialog");
  const [downloadedOverlayOpen, setDownloadedOverlayOpen] = useState(false);
  const autoDownloadKeysRef = useRef(new Set());
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("videme-online-favorites") || "{}");
    } catch {
      return {};
    }
  });
  const selectSourceTab = (nextTab) => {
    const validCategories = nextTab === "giphy" ? giphyCategoryOptions : categoryOptions;
    if (!validCategories.some((option) => option.value === sourceFilters.category)) {
      setSourceFilters((state) => ({ ...state, category: "all" }));
    }
    setSourceTab(nextTab);
    onSourceTabChange?.(nextTab);
  };

  const searchPexels = async (nextPage = 1, filterOverride = sourceFilters) => {
    const cleanQuery = query.trim();
    const effectiveQuery = cleanQuery || pexelsCategoryQuery(filterOverride.category);
    setStatus("loading");
    setResults([]);
    setHasNext(false);
    setMessage("");
    try {
      const sourceKinds = resolveSourceKinds(filter);
      const responses = await Promise.all(
        sourceKinds.map((kind) =>
          searchPexelsProvider({
            kind,
            query: effectiveQuery,
            page: nextPage,
            perPage: sourceKinds.length > 1 ? 6 : 12,
            ...filterOverride
          })
        )
      );
      const failed = responses.find((response) => !response?.ok);
      if (failed) throw new Error(failed?.error || "Pencarian Pexels gagal.");
      const mergedItems = responses.flatMap((response) => response.items || []);
      setPage(nextPage);
      setResults(sortItems(mergedItems, sortOrder));
      setTotalResults(responses.reduce((sum, response) => sum + (response.totalResults || 0), 0));
      setHasNext(responses.some((response) => response.hasNext));
      setStatus("idle");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Pencarian Pexels gagal.");
    }
  };

  const addPexelsItem = (item) => {
    addMediaItem(buildOnlineMediaItem(item, "pexels", cachedAssets[assetKey("pexels", item)]));
    setMessage(`${item.type === "video" ? "Video" : "Foto"} Pexels ditambahkan ke media library.`);
  };

  const addPixabayItem = (item) => {
    addMediaItem(buildOnlineMediaItem(item, "pixabay", cachedAssets[assetKey("pixabay", item)]));
    setPixabayMessage(`${item.type === "video" ? "Video" : "Gambar"} Pixabay ditambahkan ke media library.`);
  };

  const addGiphyItem = (item) => {
    addMediaItem(buildOnlineMediaItem(item, "giphy", cachedAssets[assetKey("giphy", item)]));
    setGiphyMessage("GIF Giphy ditambahkan ke media library.");
  };

  const toggleFavorite = (provider, item) => {
    const key = assetKey(provider, item);
    const next = { ...favorites };
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = { provider, item };
    }
    setFavorites(next);
    localStorage.setItem("videme-online-favorites", JSON.stringify(next));
  };

  const downloadOnlineAsset = async (provider, item) => {
    const key = assetKey(provider, item);
    if (downloadStatus[key] === "loading") return;
    setDownloadStatus((state) => ({ ...state, [key]: "loading" }));
    try {
      const cached = await downloadAsset(provider, item);
      setCachedAssets((state) => ({ ...state, [key]: cached }));
      setDownloadStatus((state) => ({ ...state, [key]: "done" }));
    } catch (error) {
      setDownloadStatus((state) => ({ ...state, [key]: "error" }));
      console.error(error);
    }
  };

  const downloadPreviewAsset = async (provider, item) => {
    const key = assetKey(provider, item);
    const previewItem = {
      ...item,
      url: item.previewDownloadUrl || item.previewUrl || item.thumbnailUrl || item.url,
      name: `${item.id}-preview.${item.type === "video" ? "jpg" : "jpg"}`,
      type: "image"
    };
    if (!previewItem.url) return;
    try {
      const cached = await downloadPreviewToObjectUrl(previewItem);
      setPreviewAssets((state) => ({ ...state, [key]: cached }));
    } catch (error) {
      console.error(error);
    }
  };

  const autoDownloadOnlineAssets = (provider, onlineItems) => {
    onlineItems.forEach((item) => {
      const key = assetKey(provider, item);
      if (previewAssets[key] || autoDownloadKeysRef.current.has(key)) return;
      autoDownloadKeysRef.current.add(key);
      downloadPreviewAsset(provider, item);
    });
  };

  const addCachedOnlineItem = (provider, item) => {
    const cached = cachedAssets[assetKey(provider, item)];
    if (!cached) return;
    const mediaItem = buildOnlineMediaItem(item, provider, cached);
    addMediaItem(mediaItem);
    onOnlineAssetReady?.(mediaItem);
  };

  const searchPixabay = async (nextPage = 1, filterOverride = sourceFilters) => {
    const cleanQuery = pixabayQuery.trim();
    setPixabayStatus("loading");
    setPixabayResults([]);
    setPixabayHasNext(false);
    setPixabayMessage("");
    try {
      const sourceKinds = resolveSourceKinds(filter);
      const responses = await Promise.all(
        sourceKinds.map((kind) =>
          searchPixabayProvider({
            kind,
            query: cleanQuery,
            page: nextPage,
            perPage: sourceKinds.length > 1 ? 6 : 12,
            ...filterOverride
          })
        )
      );
      const failed = responses.find((response) => !response?.ok);
      if (failed) throw new Error(failed?.error || "Pencarian Pixabay gagal.");
      const mergedItems = responses.flatMap((response) => response.items || []);
      setPixabayPage(nextPage);
      setPixabayResults(sortItems(mergedItems, sortOrder));
      setPixabayTotalResults(responses.reduce((sum, response) => sum + (response.totalResults || 0), 0));
      setPixabayHasNext(responses.some((response) => response.hasNext));
      setPixabayStatus("idle");
      setPixabayMessage("");
    } catch (error) {
      setPixabayStatus("error");
      setPixabayMessage(error instanceof Error ? error.message : "Pencarian Pixabay gagal.");
    }
  };

  const searchGiphy = async (nextPage = 1, filterOverride = sourceFilters) => {
    const cleanQuery = giphyQuery.trim();
    const effectiveQuery = cleanQuery || giphyCategoryQuery(filterOverride.category);
    setGiphyStatus("loading");
    setGiphyResults([]);
    setGiphyHasNext(false);
    setGiphyMessage("");
    try {
      const response = await searchGiphyProvider({
        query: effectiveQuery,
        page: nextPage,
        perPage: 12,
        ...filterOverride
      });
      if (!response?.ok) throw new Error(response?.error || "Pencarian Giphy gagal.");
      setGiphyPage(nextPage);
      setGiphyResults(response.items || []);
      setGiphyTotalResults(response.totalResults || 0);
      setGiphyHasNext(Boolean(response.hasNext));
      setGiphyStatus("idle");
      setGiphyMessage("");
    } catch (error) {
      setGiphyStatus("error");
      setGiphyMessage(error instanceof Error ? error.message : "Pencarian Giphy gagal.");
    }
  };

  useEffect(() => {
    if (sourceTab === "pixabay" && pixabayStatus === "idle" && pixabayResults.length === 0) {
      searchPixabay(1);
    }
    if (sourceTab === "pexels" && status === "idle" && results.length === 0) {
      searchPexels(1);
    }
    if (sourceTab === "giphy" && giphyStatus === "idle" && giphyResults.length === 0) {
      searchGiphy(1);
    }
  }, [sourceTab]);

  useEffect(() => {
    if (!resultsSlotId || sourceTab === "device") {
      setResultsSlot(null);
      return;
    }
    setResultsSlot(document.getElementById(resultsSlotId));
  }, [resultsSlotId, sourceTab]);

  return (
    <div
      className="relative z-20 grid min-h-[150px] grid-cols-[104px_minmax(0,1fr)] overflow-visible rounded-md border border-dashed border-[var(--border)] bg-[#151515]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        importFiles(event.dataTransfer.files);
      }}
    >
      <input {...inputProps} />
      <nav className="no-scrollbar min-h-0 overflow-y-auto border-r border-[var(--border)] bg-[#101010] p-1.5">
        <SourceTabButton active={sourceTab === "device"} label="Upload" onClick={() => selectSourceTab("device")} />
        <SourceTabButton active={sourceTab === "pexels"} label="Pexels" onClick={() => selectSourceTab("pexels")} />
        <SourceTabButton active={sourceTab === "pixabay"} label="Pixabay" onClick={() => selectSourceTab("pixabay")} />
        <SourceTabButton active={sourceTab === "giphy"} label="Giphy" onClick={() => selectSourceTab("giphy")} />
      </nav>

      <div className="min-w-0 p-3">
        {sourceTab === "device" ? (
        <>
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
          <ModernSelect
            value={filter}
            onChange={(value) => onFilterChange?.(value)}
            options={filters}
            leadingIcon={Filter}
            buttonClassName="h-10"
          />
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
          <div className="rounded-md border border-dashed border-[var(--border)] bg-black/20 px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
            Drag file ke sini atau klik Impor untuk menambahkan media lokal.
          </div>
        </>
        ) : sourceTab === "pexels" ? (
          <MediaSourceSearch
            provider="Pexels"
            filter={filter}
            filters={filters}
            onFilterChange={onFilterChange}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            previewMode={onlinePreviewMode}
            onPreviewModeChange={setOnlinePreviewMode}
            sourceFilters={sourceFilters}
            onSourceFiltersChange={setSourceFilters}
            query={query}
            onQueryChange={setQuery}
            downloadedItems={downloadedOnlineItems("pexels", cachedAssets, results, favorites)}
            downloadedOverlayOpen={downloadedOverlayOpen}
            onDownloadedOverlayChange={setDownloadedOverlayOpen}
            status={status}
            results={sortItems(results, sortOrder)}
            page={page}
            hasNext={hasNext}
            onSearch={searchPexels}
            onAdd={addPexelsItem}
            cachedAssets={cachedAssets}
            previewAssets={previewAssets}
            downloadStatus={downloadStatus}
            favorites={favorites}
            onDownload={downloadOnlineAsset}
            onAutoDownload={autoDownloadOnlineAssets}
            onAddCached={addCachedOnlineItem}
            onToggleFavorite={toggleFavorite}
            onCanvasPreview={setTransientPreviewMedia}
            resultSlot={resultsSlot}
          />
        ) : sourceTab === "pixabay" ? (
          <MediaSourceSearch
            provider="Pixabay"
            filter={filter}
            filters={filters}
            onFilterChange={onFilterChange}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            previewMode={onlinePreviewMode}
            onPreviewModeChange={setOnlinePreviewMode}
            sourceFilters={sourceFilters}
            onSourceFiltersChange={setSourceFilters}
            query={pixabayQuery}
            onQueryChange={setPixabayQuery}
            downloadedItems={downloadedOnlineItems("pixabay", cachedAssets, pixabayResults, favorites)}
            downloadedOverlayOpen={downloadedOverlayOpen}
            onDownloadedOverlayChange={setDownloadedOverlayOpen}
            status={pixabayStatus}
            results={sortItems(pixabayResults, sortOrder)}
            page={pixabayPage}
            hasNext={pixabayHasNext}
            onSearch={searchPixabay}
            onAdd={addPixabayItem}
            cachedAssets={cachedAssets}
            previewAssets={previewAssets}
            downloadStatus={downloadStatus}
            favorites={favorites}
            onDownload={downloadOnlineAsset}
            onAutoDownload={autoDownloadOnlineAssets}
            onAddCached={addCachedOnlineItem}
            onToggleFavorite={toggleFavorite}
            onCanvasPreview={setTransientPreviewMedia}
            resultSlot={resultsSlot}
          />
        ) : (
          <MediaSourceSearch
            provider="Giphy"
            filter={filter}
            filters={filters}
            onFilterChange={onFilterChange}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            previewMode={onlinePreviewMode}
            onPreviewModeChange={setOnlinePreviewMode}
            sourceFilters={sourceFilters}
            onSourceFiltersChange={setSourceFilters}
            query={giphyQuery}
            onQueryChange={setGiphyQuery}
            downloadedItems={downloadedOnlineItems("giphy", cachedAssets, giphyResults, favorites)}
            downloadedOverlayOpen={downloadedOverlayOpen}
            onDownloadedOverlayChange={setDownloadedOverlayOpen}
            status={giphyStatus}
            results={giphyResults}
            page={giphyPage}
            hasNext={giphyHasNext}
            onSearch={searchGiphy}
            onAdd={addGiphyItem}
            cachedAssets={cachedAssets}
            previewAssets={previewAssets}
            downloadStatus={downloadStatus}
            favorites={favorites}
            onDownload={downloadOnlineAsset}
            onAutoDownload={autoDownloadOnlineAssets}
            onAddCached={addCachedOnlineItem}
            onToggleFavorite={toggleFavorite}
            onCanvasPreview={setTransientPreviewMedia}
            resultSlot={resultsSlot}
          />
        )}
      </div>
    </div>
  );
}

function SourceTabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1 flex h-9 w-full items-center rounded-md border px-3 text-left text-xs font-semibold active:translate-y-px ${
        active
          ? "border-[var(--accent)] bg-[#152235] text-white"
          : "border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function MediaSourceSearch({
  provider,
  filter,
  filters,
  onFilterChange,
  sortOrder,
  onSortOrderChange,
  viewMode,
  onViewModeChange,
  previewMode,
  onPreviewModeChange,
  sourceFilters,
  onSourceFiltersChange,
  query,
  onQueryChange,
  downloadedItems,
  downloadedOverlayOpen,
  onDownloadedOverlayChange,
  status,
  results,
  page,
  hasNext,
  onSearch,
  onAdd,
  cachedAssets,
  previewAssets,
  downloadStatus,
  favorites,
  onDownload,
  onAutoDownload,
  onAddCached,
  onToggleFavorite,
  onCanvasPreview,
  resultSlot
}) {
  const SortIcon = sortOrder === "za" ? ArrowDownZA : ArrowUpAZ;
  const ViewIcon = viewMode === "tiles" ? Rows3 : Grid2X2;
  const downloadedOverlayRef = useRef(null);
  const downloadedButtonRef = useRef(null);
  const [showFilters, setShowFilters] = useState(false);
  const filterOverlayRef = useRef(null);
  const isPixabay = provider === "Pixabay";
  const isGiphy = provider === "Giphy";
  const usesCategoryRail = provider === "Pixabay" || provider === "Pexels" || isGiphy;
  const providerId = provider.toLowerCase();
  const providerCategoryOptions = categoryOptionsForProvider(provider);
  const displayResults = isGiphy ? results : mergeFavoriteResults(providerId, results, favorites);
  const updateSourceFilter = (key, value) => {
    const nextFilters = { ...sourceFilters, [key]: value };
    onSourceFiltersChange?.(nextFilters);
    if (usesCategoryRail) onSearch?.(1, nextFilters);
  };

  useEffect(() => {
    if (!showFilters) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!filterOverlayRef.current?.contains(event.target)) setShowFilters(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [showFilters]);

  useEffect(() => {
    if (!downloadedOverlayOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (
        !downloadedOverlayRef.current?.contains(event.target) &&
        !downloadedButtonRef.current?.contains(event.target)
      ) {
        onDownloadedOverlayChange?.(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [downloadedOverlayOpen, onDownloadedOverlayChange]);

  useEffect(() => {
    if (!displayResults.length || isGiphy) return;
    onAutoDownload?.(providerId, displayResults);
  }, [providerId, displayResults, isGiphy, onAutoDownload]);

  const resultsPanel = (
    <SourceResultsPanel
      displayResults={displayResults}
      provider={provider}
      viewMode={viewMode}
      previewMode={previewMode}
      orientation={sourceFilters.orientation}
      cachedAssets={cachedAssets}
      previewAssets={previewAssets}
      downloadStatus={downloadStatus}
      favorites={favorites}
      status={status}
      page={page}
      hasNext={hasNext}
      onSearch={onSearch}
      onDownload={onDownload}
      onAddCached={onAddCached}
      onAddDirect={onAdd}
      onToggleFavorite={onToggleFavorite}
      onCanvasPreview={onCanvasPreview}
      downloadedItems={downloadedItems}
      downloadedOverlayOpen={downloadedOverlayOpen}
      downloadedOverlayRef={downloadedOverlayRef}
    />
  );

  return (
    <div className="relative space-y-3">
      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <ModernSelect
            value={filter}
            onChange={(value) => {
              onFilterChange?.(value);
              if (usesCategoryRail) window.setTimeout(() => onSearch?.(1), 0);
            }}
            options={filters}
            leadingIcon={Filter}
          />
        </label>
        <div className="flex h-9 shrink-0 overflow-hidden rounded-md border border-[var(--border)] bg-[#111]">
          <button
            type="button"
            title="Preview di dialog"
            onClick={() => onPreviewModeChange?.("dialog")}
            className={`grid h-9 w-9 place-items-center active:translate-y-px ${
              previewMode === "dialog" ? "bg-[var(--bg-hover)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
            }`}
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            title="Preview di canvas"
            onClick={() => onPreviewModeChange?.("canvas")}
            className={`grid h-9 w-9 place-items-center border-l border-[var(--border)] active:translate-y-px ${
              previewMode === "canvas" ? "bg-[var(--bg-hover)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
            }`}
          >
            <Monitor size={14} />
          </button>
        </div>
        <button
          type="button"
          title={sortOrder === "za" ? "Sort Z-A" : "Sort A-Z"}
          onClick={() => onSortOrderChange?.(sortOrder === "az" ? "za" : "az")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <SortIcon size={14} />
        </button>
        <button
          type="button"
          title={viewMode === "tiles" ? "Tampilan tiles" : "Tampilan thumbnail"}
          onClick={() => onViewModeChange?.(viewMode === "thumbnail" ? "tiles" : "thumbnail")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px"
        >
          <ViewIcon size={14} />
        </button>
      </div>
      <form
        className="relative flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSearch(1);
        }}
      >
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={14} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={isGiphy ? "Cari GIF..." : "Cari gambar..."}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[#111] pl-8 pr-2 text-xs text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
          />
        </label>
        {!isGiphy ? (
          <button
            ref={downloadedButtonRef}
            type="button"
            title="Terunduh"
            onClick={() => onDownloadedOverlayChange?.(!downloadedOverlayOpen)}
            className={`grid h-9 w-10 shrink-0 place-items-center rounded-md border border-[var(--border)] active:translate-y-px ${
              downloadedOverlayOpen ? "bg-[var(--bg-hover)] text-[var(--accent)]" : "bg-[#111] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
            }`}
          >
            <Download size={14} />
          </button>
        ) : null}
        <button
          type="submit"
          disabled={status === "loading"}
          className="grid h-9 w-10 shrink-0 place-items-center rounded-md bg-[var(--accent)] text-[#07111f] hover:bg-[var(--accent-strong)] disabled:opacity-50"
          title={`Cari ${provider}`}
        >
          <Search size={14} />
        </button>
      </form>
      <div ref={filterOverlayRef} className="relative">
        {usesCategoryRail ? (
          <div className="flex items-center gap-2">
            <HorizontalRail className="min-w-0 flex-1" contentClassName="flex gap-1" step={88}>
              {providerCategoryOptions.map((option) => {
                const Icon = option.icon;
                const active = sourceFilters.category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    title={option.label}
                    onClick={() => updateSourceFilter("category", option.value)}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border active:translate-y-px ${
                      active
                        ? "border-[var(--accent)] bg-[#152235] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[#111] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white"
                    }`}
                  >
                    <Icon size={15} />
                  </button>
                );
              })}
            </HorizontalRail>
            <button
              type="button"
              title="Filter lanjutan"
              onClick={() => setShowFilters((value) => !value)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px ${
                showFilters ? "bg-[var(--bg-hover)] text-[var(--accent)]" : ""
              }`}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              title="Filter lanjutan"
              onClick={() => setShowFilters((value) => !value)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] active:translate-y-px ${
                showFilters ? "bg-[var(--bg-hover)] text-[var(--accent)]" : ""
              }`}
            >
              <SlidersHorizontal size={14} />
            </button>
          </div>
        )}
        {showFilters ? (
          <div className="absolute right-0 top-9 z-50 grid w-[272px] grid-cols-2 gap-2 rounded-md border border-[var(--border)] bg-[#101010] p-2 shadow-xl shadow-black/50">
            {isPixabay ? <ModernSelect label="Urutan" layout="compact" value={sourceFilters.order} onChange={(value) => updateSourceFilter("order", value)} options={orderOptions} buttonClassName="h-8 text-[11px]" /> : null}
            {!isGiphy ? (
              <ModernSelect
                label="Orientasi"
                layout="compact"
                value={sourceFilters.orientation}
                onChange={(value) => updateSourceFilter("orientation", value)}
                options={orientationOptions}
                buttonClassName="h-8 text-[11px]"
              />
            ) : null}
            {isPixabay || isGiphy ? (
              <label className="flex h-9 items-center gap-2 rounded-md border border-[var(--border)] bg-[#111] px-2 text-[11px] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={Boolean(sourceFilters.safeSearch)}
                  onChange={(event) => updateSourceFilter("safeSearch", event.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">Safe search</span>
                <span className="group relative grid h-4 w-4 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:text-white">
                  <Info size={10} />
                  <span className="pointer-events-none absolute bottom-6 right-0 z-50 hidden w-44 rounded-md border border-[var(--border)] bg-[#0d0d0d] px-2 py-1.5 text-[10px] leading-4 text-[var(--text-secondary)] shadow-xl shadow-black/50 group-hover:block group-focus-within:block">
                    Membatasi hasil agar lebih aman untuk semua umur.
                  </span>
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
      </div>
      {resultSlot ? createPortal(resultsPanel, resultSlot) : resultsPanel}
    </div>
  );
}

function SourceResultsPanel({
  displayResults,
  provider,
  viewMode,
  previewMode,
  orientation,
  cachedAssets,
  previewAssets,
  downloadStatus,
  favorites,
  status,
  page,
  hasNext,
  onSearch,
  onDownload,
  onAddCached,
  onAddDirect,
  onToggleFavorite,
  onCanvasPreview,
  downloadedItems,
  downloadedOverlayOpen,
  downloadedOverlayRef
}) {
  const providerId = provider.toLowerCase();
  const isGiphy = providerId === "giphy";
  const isPortraitGrid = viewMode !== "tiles" && orientation === "vertical";
  const resultsGridClass = isGiphy
    ? "grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto pr-1"
    : viewMode === "tiles"
      ? "grid min-h-0 flex-1 gap-2 overflow-y-auto pr-1"
      : `grid min-h-0 flex-1 content-start gap-2 overflow-y-auto pr-1 ${isPortraitGrid ? "grid-cols-4" : "grid-cols-3"}`;

  return (
    <div className="relative flex h-full min-h-48 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[#141414] p-2">
      {displayResults.length ? (
        <>
          {isGiphy ? (
            <div className="mb-2 flex shrink-0 items-center justify-end text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Powered by GIPHY
            </div>
          ) : null}
          <div className={resultsGridClass}>
            {displayResults.map((item) => (
              <MediaSourceResult
                key={`${provider}-${item.type}-${item.id}`}
                item={item}
                provider={provider}
                viewMode={viewMode}
                previewMode={previewMode}
                orientation={orientation}
                previewCached={previewAssets?.[assetKey(providerId, item)]}
                cached={cachedAssets?.[assetKey(providerId, item)]}
                downloadState={downloadStatus?.[assetKey(providerId, item)]}
                favorite={Boolean(favorites?.[assetKey(providerId, item)])}
                onDownload={onDownload}
                onAddCached={onAddCached}
                onAddDirect={onAddDirect}
                onToggleFavorite={onToggleFavorite}
                onCanvasPreview={onCanvasPreview}
              />
            ))}
          </div>
        </>
      ) : status === "loading" ? (
        <LoadingThumbnailGrid className={resultsGridClass} count={isPortraitGrid ? 12 : 9} portrait={isPortraitGrid} />
      ) : (
        <div className="grid min-h-44 flex-1 place-items-center text-center">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Media kosong</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {status === "loading" ? `Mengambil media dari ${provider}...` : "Tambahkan video, foto, atau audio."}
            </p>
          </div>
        </div>
      )}
      {displayResults.length ? (
        <div className="mt-2 flex shrink-0 items-center justify-end gap-1 text-[10px] text-[var(--text-muted)]">
          <button
            type="button"
            onClick={() => onSearch(Math.max(1, page - 1))}
            disabled={page <= 1 || status === "loading"}
            className="h-6 rounded border border-[var(--border)] px-2 hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => onSearch(page + 1)}
            disabled={!hasNext || status === "loading"}
            className="h-6 rounded border border-[var(--border)] px-2 hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
      {downloadedOverlayOpen ? (
        <div ref={downloadedOverlayRef} className="absolute inset-0 z-40">
          <DownloadedAssetsOverlay
            items={downloadedItems}
            provider={provider}
            previewMode={previewMode}
            orientation={orientation}
            favorites={favorites}
            onAddCached={onAddCached}
            onToggleFavorite={onToggleFavorite}
            onCanvasPreview={onCanvasPreview}
          />
        </div>
      ) : null}
    </div>
  );
}

function LoadingThumbnailGrid({ className, count = 9, portrait = false }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`checkerboard grid ${portrait ? "aspect-[3/4]" : "aspect-video"} place-items-center overflow-hidden rounded-md border border-[var(--border)] bg-[#121212]`}>
          <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
        </div>
      ))}
    </div>
  );
}

function DownloadedAssetsOverlay({ items = [], provider, previewMode, orientation, favorites, onAddCached, onToggleFavorite, onCanvasPreview }) {
  const providerId = provider.toLowerCase();
  const gridClass = `grid min-h-0 flex-1 content-start gap-2 overflow-y-auto p-2 ${orientation === "vertical" ? "grid-cols-4" : "grid-cols-3"}`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[#101010] shadow-xl shadow-black/50">
      <div className="flex h-11 shrink-0 items-center border-b border-white/10 px-4">
        <div>
          <div className="text-xs font-semibold text-white">Terunduh</div>
          <div className="text-[10px] text-[var(--text-muted)]">{items.length} original file dari {provider}</div>
        </div>
      </div>
      {items.length ? (
        <div className={gridClass}>
          {items.map(({ item, cached }) => (
            <MediaSourceResult
              key={`${provider}-${item.type}-${item.id}`}
              item={{ ...item, name: cached.name || item.name, size: cached.size || item.size }}
              provider={provider}
              viewMode="thumbnail"
              previewMode={previewMode}
              orientation={orientation}
              previewCached={cached}
              cached={cached}
              downloadState="done"
              favorite={Boolean(favorites?.[assetKey(providerId, item)])}
              onAddCached={onAddCached}
              onToggleFavorite={onToggleFavorite}
              onCanvasPreview={onCanvasPreview}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-4 text-center">
          <div>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Belum ada original terunduh</p>
            <p className="mt-1 max-w-64 text-xs text-[var(--text-muted)]">Klik tombol unduh di thumbnail untuk menyimpan file original.</p>
          </div>
        </div>
      )}
    </div>
  );
}

const categoryOptions = [
  { value: "all", label: "Semua kategori", icon: Shapes },
  { value: "backgrounds", label: "Background", icon: Wallpaper },
  { value: "nature", label: "Nature", icon: Trees },
  { value: "people", label: "People", icon: UserRound },
  { value: "business", label: "Business", icon: BriefcaseBusiness },
  { value: "travel", label: "Travel", icon: Plane },
  { value: "food", label: "Food", icon: Utensils },
  { value: "music", label: "Music", icon: Music },
  { value: "computer", label: "Computer", icon: Monitor },
  { value: "animals", label: "Animals", icon: PawPrint },
  { value: "sports", label: "Sports", icon: Dumbbell },
  { value: "transportation", label: "Transportation", icon: Car }
];

const giphyCategoryOptions = [
  { value: "all", label: "Trending", icon: Flame },
  { value: "reaction", label: "Reaction", icon: MessageCircle },
  { value: "meme", label: "Meme", icon: Laugh },
  { value: "sticker", label: "Sticker", icon: Smile },
  { value: "happy", label: "Happy", icon: Smile },
  { value: "celebrate", label: "Celebrate", icon: Star },
  { value: "love", label: "Love", icon: Heart },
  { value: "work", label: "Work", icon: BriefcaseBusiness },
  { value: "music", label: "Music", icon: Music },
  { value: "sports", label: "Sports", icon: Dumbbell }
];

function categoryOptionsForProvider(provider) {
  return provider === "Giphy" ? giphyCategoryOptions : categoryOptions;
}

const orderOptions = [
  { value: "popular", label: "Popular" },
  { value: "latest", label: "Latest" }
];

const loadedThumbnailUrls = new Set();

function imageSrcForInitialState(item, previewCached) {
  return item.previewUrl || item.thumbnailUrl || item.webformatUrl || previewCached?.url || item.url;
}

function uniqueSources(sources) {
  return [...new Set(sources.filter(Boolean))];
}

const orientationOptions = [
  { value: "horizontal", label: "Horizontal", icon: RectangleHorizontal },
  { value: "vertical", label: "Vertical", icon: RectangleVertical }
];


function MediaSourceResult({ item, provider, viewMode, previewMode, orientation, previewCached, cached, downloadState, favorite, onDownload, onAddCached, onAddDirect, onToggleFavorite, onCanvasPreview }) {
  const [showZoomPreview, setShowZoomPreview] = useState(false);
  const [zoomAnchor, setZoomAnchor] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(() => loadedThumbnailUrls.has(imageSrcForInitialState(item, previewCached)));
  const [thumbnailSourceIndex, setThumbnailSourceIndex] = useState(0);
  const [loadedThumbnailSrc, setLoadedThumbnailSrc] = useState("");
  const [zoomSourceIndex, setZoomSourceIndex] = useState(0);
  const zoomButtonRef = useRef(null);
  const itemUrl = item.pexelsUrl || item.pixabayUrl || item.giphyUrl || item.sourceUrl;
  const author = item.photographer || item.creator || provider;
  const providerId = provider.toLowerCase();
  const isGiphy = providerId === "giphy";
  const isTiles = viewMode === "tiles";
  const isPortraitMedia = !isGiphy && (orientation === "vertical" || (Number(item.height) > Number(item.width) && Number(item.width) > 0));
  const thumbnailAspectClass = isGiphy ? "aspect-square" : isTiles ? "h-[92px]" : isPortraitMedia ? "aspect-[3/4]" : "aspect-video";
  const thumbnailFitClass = isGiphy ? "object-contain p-1" : "object-cover";
  const previewPopoverClass = isPortraitMedia ? "w-[min(300px,calc(100vw-16px))]" : "w-[min(420px,calc(100vw-16px))]";
  const previewFrameClass = isPortraitMedia ? "aspect-[3/4] max-h-[min(520px,calc(100vh-120px))]" : "h-56";
  const loading = downloadState === "loading";
  const thumbnailSources = uniqueSources([item.previewUrl, item.thumbnailUrl, item.webformatUrl, previewCached?.url, item.url]);
  const thumbnailSourcesKey = thumbnailSources.join("|");
  const imageSrc = thumbnailSources[thumbnailSourceIndex] || thumbnailSources[0] || "";
  const zoomSources = uniqueSources([loadedThumbnailSrc, imageSrc, item.webformatUrl, item.previewUrl, item.thumbnailUrl, previewCached?.url, cached?.url, item.url]);
  const zoomSourcesKey = zoomSources.join("|");
  const zoomSrc = zoomSources[zoomSourceIndex] || zoomSources[0] || imageSrc;
  useEffect(() => {
    setThumbnailSourceIndex(0);
    setLoadedThumbnailSrc("");
  }, [thumbnailSourcesKey]);
  useEffect(() => {
    setImageLoaded(loadedThumbnailUrls.has(imageSrc));
  }, [imageSrc]);
  useEffect(() => {
    setZoomSourceIndex(0);
  }, [zoomSourcesKey]);

  const previewMedia = {
    id: `online-preview-${providerId}-${item.type}-${item.id}`,
    name: item.name,
    type: item.type,
    url: zoomSrc,
    thumbnailUrl: imageSrc,
    duration: item.duration || (item.type === "video" ? 5 : 3),
    width: item.width || 0,
    height: item.height || 0,
    metadata: {
      source: providerId,
      creator: author,
      sourceUrl: itemUrl,
      orientation: isPortraitMedia ? "vertical" : "horizontal"
    }
  };
  const showPreview = () => {
    if (previewMode === "canvas") {
      onCanvasPreview?.(previewMedia);
      return;
    }
    setZoomAnchor(zoomButtonRef.current?.getBoundingClientRect() ?? null);
    setShowZoomPreview(true);
  };
  const hidePreview = () => {
    if (previewMode === "canvas") {
      onCanvasPreview?.(null);
      return;
    }
    setShowZoomPreview(false);
  };
  const handleImageError = () => {
    setThumbnailSourceIndex((index) => Math.min(index + 1, thumbnailSources.length - 1));
  };
  const markImageLoaded = (event) => {
    const loadedSrc = event.currentTarget.currentSrc || event.currentTarget.src || imageSrc;
    loadedThumbnailUrls.add(loadedSrc);
    setLoadedThumbnailSrc(loadedSrc);
    setImageLoaded(true);
  };
  const handleZoomImageError = () => {
    setZoomSourceIndex((index) => Math.min(index + 1, zoomSources.length - 1));
  };

  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[#121212]">
      <div className={`checkerboard group relative overflow-hidden bg-black ${thumbnailAspectClass}`}>
        {!imageLoaded ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#121212]">
            <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : null}
        <img
          src={imageSrc}
          alt=""
          className={`h-full w-full ${thumbnailFitClass} transition-opacity duration-150 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={markImageLoaded}
          onError={handleImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/70 opacity-0 transition-opacity group-hover:opacity-90" />
        {item.type === "video" ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 font-mono text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {Math.round(item.duration)}s
          </span>
        ) : null}
        <div className="absolute left-1 top-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {itemUrl ? (
            <a
              href={itemUrl}
              target="_blank"
              rel="noreferrer"
              title={`Buka di ${provider}`}
              className="grid h-7 w-7 place-items-center rounded bg-black/70 text-white backdrop-blur hover:bg-black/85"
            >
              <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
        <div className="absolute right-1 top-1 grid grid-cols-2 gap-1">
          <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              aria-label="Preview besar"
              ref={zoomButtonRef}
              onMouseEnter={showPreview}
              onMouseLeave={hidePreview}
              onFocus={showPreview}
              onBlur={hidePreview}
              className="grid h-7 w-7 place-items-center rounded bg-black/70 text-white backdrop-blur hover:bg-black/85"
            >
              <Eye size={14} />
            </button>
            {showZoomPreview && zoomSrc
              ? createPortal(
                  <div
                    className={`pointer-events-none fixed z-[2147483647] ${previewPopoverClass} animate-[zoomIn_140ms_ease-out] overflow-hidden rounded-md border border-[var(--border)] bg-[#101010] shadow-xl shadow-black/60`}
                    style={previewPopoverStyle(zoomAnchor, isPortraitMedia)}
                  >
                      <div className="flex h-9 items-center justify-between border-b border-white/10 px-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-white">{item.name}</div>
                          <div className="truncate text-[10px] text-[var(--text-muted)]">{author}</div>
                        </div>
                        <span className="ml-3 shrink-0 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">Preview</span>
                      </div>
                      <div className={`checkerboard grid ${previewFrameClass} place-items-center bg-black`}>
                        <img key={zoomSrc} src={zoomSrc} alt="" className="h-full w-full object-contain" onError={handleZoomImageError} />
                      </div>
                  </div>,
                  document.body
                )
              : null}
          </div>
          {!isGiphy ? (
            <button
              type="button"
              title={favorite ? "Hapus dari favorit" : "Tambah ke favorit"}
              onClick={() => onToggleFavorite?.(providerId, item)}
              className={`grid h-7 w-7 place-items-center rounded bg-black/70 backdrop-blur transition-opacity hover:bg-black/85 ${
                favorite ? "text-yellow-300 opacity-100" : "text-white opacity-0 group-hover:opacity-100"
              }`}
            >
              <Star size={14} fill={favorite ? "currentColor" : "none"} />
            </button>
          ) : null}
          {isGiphy ? (
            <button
              type="button"
              title="Tambah ke media library"
              onClick={() => onAddDirect?.(item)}
              className="col-start-2 grid h-7 w-7 place-items-center rounded bg-[var(--accent)] text-[#07111f] opacity-0 backdrop-blur transition-opacity hover:bg-[var(--accent-strong)] group-hover:opacity-100"
            >
              <Plus size={14} />
            </button>
          ) : cached ? (
            <button
              type="button"
              title="Tambah ke timeline"
              onClick={() => onAddCached?.(providerId, item)}
              className="col-start-2 grid h-7 w-7 place-items-center rounded bg-[var(--accent)] text-[#07111f] opacity-0 backdrop-blur transition-opacity hover:bg-[var(--accent-strong)] group-hover:opacity-100"
            >
              <Plus size={14} />
            </button>
          ) : (
            <button
              type="button"
              title={loading ? "Mengunduh" : "Unduh"}
              onClick={() => onDownload?.(providerId, item)}
              disabled={loading}
              className="col-start-2 grid h-7 w-7 place-items-center rounded bg-black/70 text-[var(--accent)] opacity-0 backdrop-blur transition-opacity hover:bg-black/85 group-hover:opacity-100 disabled:opacity-70"
            >
              {loading ? <span className="h-3 w-3 animate-spin rounded-full border border-[var(--accent)] border-t-transparent" /> : <Download size={13} />}
            </button>
          )}
        </div>
        <div className="absolute bottom-1 left-1 min-w-0 max-w-[calc(100%-44px)] rounded bg-black/70 px-1.5 py-1 text-[9px] leading-3 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <div className="truncate">{item.name}</div>
          <div className="truncate text-[var(--text-muted)]">{author}</div>
        </div>
      </div>
    </div>
  );
}

function resolveSourceKinds(filter) {
  if (filter === "Video") return ["video"];
  if (filter === "Gambar") return ["photo"];
  return ["photo", "video"];
}

function sortItems(items, sortOrder) {
  return items.slice().sort((a, b) => {
    const result = (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base", numeric: true });
    return sortOrder === "az" ? result : -result;
  });
}

const PEXELS_BROWSER_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || "";
const PIXABAY_BROWSER_API_KEY = import.meta.env.VITE_PIXABAY_API_KEY || "";
const GIPHY_BROWSER_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

async function searchPexelsProvider(payload) {
  if (window.videmeNative?.pexels?.search) {
    return window.videmeNative.pexels.search(payload);
  }

  const kind = payload.kind === "video" ? "video" : "photo";
  const endpoint = kind === "video" ? "https://api.pexels.com/v1/videos/search" : "https://api.pexels.com/v1/search";
  const url = new URL(endpoint);
  url.searchParams.set("query", payload.query || "nature");
  url.searchParams.set("page", String(Math.max(1, Number(payload.page) || 1)));
  url.searchParams.set("per_page", String(Math.max(1, Math.min(Number(payload.perPage) || 12, 80))));
  const orientation = pexelsOrientation(payload.orientation);
  if (orientation) url.searchParams.set("orientation", orientation);

  if (!PEXELS_BROWSER_API_KEY) {
    return { ok: false, error: "VITE_PEXELS_API_KEY belum dikonfigurasi." };
  }

  const response = await fetch(url, { headers: { Authorization: PEXELS_BROWSER_API_KEY } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Pexels gagal (${response.status}). ${text}`.trim() };
  }
  const data = await response.json();
  const items = kind === "video"
    ? (data.videos || []).map(normalizePexelsVideoResult).filter((item) => item.url)
    : (data.photos || []).map(normalizePexelsPhotoResult).filter((item) => item.url);

  return {
    ok: true,
    kind,
    page: data.page || Number(payload.page) || 1,
    perPage: data.per_page || Number(payload.perPage) || 12,
    totalResults: data.total_results || 0,
    hasNext: Boolean(data.next_page),
    items
  };
}

function normalizePexelsPhotoResult(photo) {
  const previewUrl = photo.src?.small || photo.src?.tiny || photo.src?.medium || "";
  const webformatUrl = photo.src?.medium || photo.src?.large || previewUrl;
  const downloadUrl = photo.src?.original || photo.src?.large2x || photo.src?.large || webformatUrl || photo.url;
  return {
    id: String(photo.id),
    type: "image",
    name: `Pexels Photo ${photo.id}.jpg`,
    url: downloadUrl,
    downloadUrl,
    previewUrl,
    webformatUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: 3,
    width: photo.width || 0,
    height: photo.height || 0,
    size: 0,
    alt: photo.alt || "",
    avgColor: photo.avg_color || null,
    pexelsUrl: photo.url,
    photographer: photo.photographer || "Pexels",
    photographerUrl: photo.photographer_url || "https://www.pexels.com"
  };
}

function normalizePexelsVideoResult(video) {
  const mp4Files = Array.isArray(video.video_files)
    ? video.video_files.filter((file) => file.file_type === "video/mp4" && file.link && file.quality !== "hls")
    : [];
  const preferred = pickBestPexelsVideoFile(mp4Files);
  const previewUrl = video.video_pictures?.[0]?.picture || video.image || "";
  return {
    id: String(video.id),
    type: "video",
    name: `Pexels Video ${video.id}.mp4`,
    url: preferred?.link || video.url,
    downloadUrl: preferred?.link || video.url,
    previewUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: Number(video.duration) || 5,
    width: preferred?.width || video.width || 0,
    height: preferred?.height || video.height || 0,
    size: 0,
    pexelsUrl: video.url,
    photographer: video.user?.name || "Pexels",
    photographerUrl: video.user?.url || "https://www.pexels.com"
  };
}

function pickBestPexelsVideoFile(files) {
  return files
    .slice()
    .sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)))[0];
}

function pexelsOrientation(orientation) {
  if (orientation === "horizontal") return "landscape";
  if (orientation === "vertical") return "portrait";
  return "";
}

function pexelsCategoryQuery(category) {
  if (!category || category === "all") return "nature";
  return categoryOptions.find((option) => option.value === category)?.label || category;
}

function giphyCategoryQuery(category) {
  if (!category || category === "all") return "";
  return giphyCategoryOptions.find((option) => option.value === category)?.label || category;
}

async function searchGiphyProvider(payload) {
  if (!GIPHY_BROWSER_API_KEY) {
    return { ok: false, error: "VITE_GIPHY_API_KEY belum dikonfigurasi." };
  }

  const hasQuery = Boolean(payload.query?.trim());
  const isSticker = payload.category === "sticker";
  const endpoint = hasQuery
    ? `https://api.giphy.com/v1/${isSticker ? "stickers" : "gifs"}/search`
    : `https://api.giphy.com/v1/${isSticker ? "stickers" : "gifs"}/trending`;
  const limit = Math.max(1, Math.min(Number(payload.perPage) || 12, 50));
  const page = Math.max(1, Number(payload.page) || 1);
  const url = new URL(endpoint);
  url.searchParams.set("api_key", GIPHY_BROWSER_API_KEY);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String((page - 1) * limit));
  url.searchParams.set("rating", payload.safeSearch === false ? "r" : "pg-13");
  url.searchParams.set("lang", "id");
  url.searchParams.set("bundle", isSticker ? "sticker_layering" : "messaging_non_clips");
  if (hasQuery) url.searchParams.set("q", payload.query.trim().slice(0, 50));

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Giphy gagal (${response.status}). ${text}`.trim() };
  }
  const data = await response.json();
  const total = data.pagination?.total_count || 0;
  const offset = data.pagination?.offset || 0;
  const count = data.pagination?.count || 0;
  return {
    ok: true,
    kind: "gif",
    page,
    perPage: limit,
    totalResults: total,
    hasNext: offset + count < total,
    items: (data.data || []).map(normalizeGiphyResult).filter((item) => item.url)
  };
}

function normalizeGiphyResult(item) {
  const images = item.images || {};
  const original = images.original || {};
  const fixedWidth = images.fixed_width || images.downsized_medium || images.downsized || {};
  const preview = images.fixed_width_small || images.preview_gif || fixedWidth || original;
  const url = original.webp || original.url || fixedWidth.webp || fixedWidth.url || item.url;
  const previewUrl = preview.webp || preview.url || fixedWidth.webp || fixedWidth.url || url;
  const extension = url.includes(".webp") ? "webp" : "gif";
  return {
    id: String(item.id),
    type: "image",
    name: `Giphy ${item.title || item.id}.${extension}`,
    url,
    downloadUrl: url,
    previewUrl,
    webformatUrl: fixedWidth.url || previewUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: 3,
    width: Number(original.width || fixedWidth.width || preview.width) || 0,
    height: Number(original.height || fixedWidth.height || preview.height) || 0,
    size: Number(original.size || fixedWidth.size || preview.size) || 0,
    alt: item.title || "",
    giphyUrl: item.url,
    creator: item.user?.display_name || item.username || "Giphy",
    creatorUrl: item.user?.profile_url || item.url || "https://giphy.com"
  };
}

async function searchPixabayProvider(payload) {
  if (window.videmeNative?.pixabay?.search) {
    return window.videmeNative.pixabay.search(payload);
  }

  const kind = payload.kind === "video" ? "video" : "photo";
  const endpoint = kind === "video" ? "https://pixabay.com/api/videos/" : "https://pixabay.com/api/";
  const url = new URL(endpoint);
  if (!PIXABAY_BROWSER_API_KEY) {
    return { ok: false, error: "VITE_PIXABAY_API_KEY belum dikonfigurasi." };
  }
  url.searchParams.set("key", PIXABAY_BROWSER_API_KEY);
  if (payload.query) url.searchParams.set("q", payload.query);
  url.searchParams.set("page", String(Math.max(1, Number(payload.page) || 1)));
  url.searchParams.set("per_page", String(Math.max(3, Math.min(Number(payload.perPage) || 12, 200))));
  url.searchParams.set("safesearch", payload.safeSearch === false ? "false" : "true");
  url.searchParams.set("order", payload.order === "latest" ? "latest" : "popular");
  if (payload.category && payload.category !== "all") url.searchParams.set("category", payload.category);
  if (payload.orientation && payload.orientation !== "all" && kind !== "video") url.searchParams.set("orientation", payload.orientation);
  if (kind === "photo") url.searchParams.set("image_type", "all");
  if (kind === "video") url.searchParams.set("video_type", "all");

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { ok: false, error: `Pixabay gagal (${response.status}). ${text}`.trim() };
  }
  const data = await response.json();
  const items = kind === "video"
    ? (data.hits || []).map(normalizePixabayVideoResult).filter((item) => item.url)
    : (data.hits || []).map(normalizePixabayImageResult).filter((item) => item.url);

  return {
    ok: true,
    kind,
    page: Number(payload.page) || 1,
    perPage: Number(payload.perPage) || 12,
    totalResults: data.totalHits || data.total || 0,
    hasNext: ((Number(payload.page) || 1) * (Number(payload.perPage) || 12)) < (data.totalHits || 0),
    items
  };
}

function normalizePixabayImageResult(item) {
  const previewUrl = item.previewURL || item.webformatURL || "";
  const webformatUrl = item.webformatURL || item.previewURL || "";
  const download = pickPixabayImageDownload(item);
  return {
    id: String(item.id),
    type: "image",
    name: `Pixabay ${download.kind} ${item.id}.${download.extension}`,
    url: download.url,
    downloadUrl: download.url,
    previewUrl,
    webformatUrl,
    previewDownloadUrl: previewUrl,
    thumbnailUrl: previewUrl,
    duration: 3,
    width: item.imageWidth || item.webformatWidth || 0,
    height: item.imageHeight || item.webformatHeight || 0,
    size: item.imageSize || 0,
    alt: item.tags || "",
    pixabayUrl: item.pageURL,
    creator: item.user || "Pixabay",
    creatorUrl: pixabayUserUrl(item)
  };
}

function pickPixabayImageDownload(item) {
  if (item.vectorURL) {
    return { url: item.vectorURL, kind: "Vector", extension: "svg" };
  }
  return {
    url: item.imageURL || item.fullHDURL || item.largeImageURL || item.webformatURL || item.previewURL || item.pageURL,
    kind: "Image",
    extension: "jpg"
  };
}

function normalizePixabayVideoResult(item) {
  const versions = item.videos || {};
  const preview = pickPixabayVideoVersion(versions, ["medium", "small", "large", "tiny"], "thumbnail");
  const preferred = pickPixabayVideoVersion(versions, ["large", "medium", "small", "tiny"], "url");
  return {
    id: String(item.id),
    type: "video",
    name: `Pixabay Video ${item.id}.mp4`,
    url: preferred?.url || item.pageURL,
    downloadUrl: preferred?.url || item.pageURL,
    previewUrl: preview?.thumbnail || preferred?.thumbnail || "",
    previewDownloadUrl: preview?.thumbnail || preferred?.thumbnail || "",
    thumbnailUrl: preview?.thumbnail || preferred?.thumbnail || "",
    duration: Number(item.duration) || 5,
    width: preferred?.width || 0,
    height: preferred?.height || 0,
    size: preferred?.size || 0,
    alt: item.tags || "",
    pixabayUrl: item.pageURL,
    creator: item.user || "Pixabay",
    creatorUrl: pixabayUserUrl(item)
  };
}

function pickPixabayVideoVersion(versions, order, field) {
  return order.map((key) => versions[key]).find((version) => version?.[field]);
}

function pixabayUserUrl(item) {
  if (!item.user || !item.user_id) return "https://pixabay.com";
  return `https://pixabay.com/users/${encodeURIComponent(item.user)}-${item.user_id}/`;
}

function mergeFavoriteResults(provider, results, favorites = {}) {
  const favoriteItems = Object.values(favorites)
    .filter((entry) => entry?.provider === provider && entry.item)
    .map((entry) => entry.item);
  const resultKeys = new Set(results.map((item) => assetKey(provider, item)));
  return [
    ...favoriteItems.filter((item) => !resultKeys.has(assetKey(provider, item))),
    ...results
  ];
}

function assetKey(provider, item) {
  return `${provider}:${item.type}:${item.id}`;
}

function downloadedOnlineItems(provider, resultsCache = {}, results = [], favorites = {}) {
  const byKey = new Map();
  [...results, ...Object.values(favorites).filter((entry) => entry?.provider === provider).map((entry) => entry.item)]
    .filter(Boolean)
    .forEach((item) => byKey.set(assetKey(provider, item), item));

  return Object.entries(resultsCache)
    .filter(([key, cached]) => key.startsWith(`${provider}:`) && cached?.url)
    .map(([key, cached]) => ({
      item: byKey.get(key) || fallbackDownloadedItem(key, provider, cached),
      cached
    }));
}

function fallbackDownloadedItem(key, provider, cached) {
  const [, type = "image", id = cached?.name || "asset"] = key.split(":");
  return {
    id,
    type,
    name: cached?.name || `${provider} ${id}`,
    pexelsUrl: provider === "pexels" ? "https://www.pexels.com" : null,
    pixabayUrl: provider === "pixabay" ? "https://pixabay.com" : null,
    giphyUrl: provider === "giphy" ? "https://giphy.com" : null
  };
}

function previewPopoverStyle(anchorRect, isPortrait = false) {
  const width = Math.min(isPortrait ? 300 : 420, window.innerWidth - 16);
  const height = Math.min(isPortrait ? 460 : 270, window.innerHeight - 16);
  const left = Math.max(8, Math.min(anchorRect?.right ? anchorRect.right + 8 : 160, window.innerWidth - width - 8));
  const preferredTop = anchorRect?.top ? anchorRect.top - (isPortrait ? 56 : 12) : 120;
  const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
  return { left, top };
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadAsset(provider, item) {
  const sourceUrl = item.downloadUrl || item.url;
  if (window.videmeNative?.asset?.download) {
    const result = await window.videmeNative.asset.download({
      provider,
      type: item.type,
      url: sourceUrl,
      name: item.name
    });
    if (!result?.ok) throw new Error(result?.error || "Download asset gagal.");
    return {
      url: result.url,
      filePath: result.path,
      name: result.name || item.name,
      size: result.size || item.size || 0
    };
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Download gagal (${response.status}).`);
  const blob = await response.blob();
  const file = new File([blob], item.name, { type: blob.type || (item.type === "video" ? "video/mp4" : "image/jpeg") });
  return {
    file,
    url: URL.createObjectURL(file),
    name: file.name,
    size: file.size
  };
}

async function downloadPreviewToObjectUrl(item) {
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`Download preview gagal (${response.status}).`);
  const blob = await response.blob();
  return {
    file: null,
    url: URL.createObjectURL(blob),
    name: item.name,
    size: blob.size
  };
}

function buildOnlineMediaItem(item, provider, cached) {
  const sourceUrl = provider === "pexels" ? item.pexelsUrl : provider === "pixabay" ? item.pixabayUrl : item.giphyUrl;
  const creator = item.photographer || item.creator || provider;
  const creatorUrl = item.photographerUrl || item.creatorUrl || sourceUrl;
  return {
    id: `${provider}-${item.type}-${item.id}-${crypto.randomUUID()}`,
    name: cached?.name || item.name,
    type: item.type,
    file: cached?.file || null,
    filePath: cached?.filePath || null,
    url: cached?.url || item.url,
    thumbnailUrl: item.thumbnailUrl || item.url,
    duration: item.duration || (item.type === "video" ? 5 : 3),
    width: item.width,
    height: item.height,
    size: cached?.size || item.size || 0,
    addedToTimeline: false,
    isProxy: false,
    metadata: {
      ffprobe: null,
      source: provider,
      sourceUrl,
      creator,
      creatorUrl,
      alt: item.alt || "",
      cachedPath: cached?.filePath || null,
      downloadedAt: cached ? new Date().toISOString() : null
    },
    capabilities: {},
    proxy: null,
    waveform: null,
    thumbnails: []
  };
}
