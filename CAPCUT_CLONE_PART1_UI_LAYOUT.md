# CapCut Clone — PART 1: UI Layout & Project Scaffold

> **Fokus**: Struktur proyek, layout utama, sidebar, topbar, panel preview, dan timeline shell.
> Bagian ini adalah fondasi — semua fitur dibangun di atas ini.

---

## Stack Teknologi

```
Framework  : React 18 + Vite
Styling    : Tailwind CSS + CSS Modules (untuk komponen kompleks)
State      : Zustand (global store)
Media API  : Web Audio API + HTMLVideoElement + Canvas API
File I/O   : File System Access API (modern browser)
Timeline   : Custom canvas-based renderer (tidak pakai library)
```

---

## Struktur Folder

```
src/
├── app/
│   └── App.jsx                  # Root layout
├── components/
│   ├── layout/
│   │   ├── TopBar.jsx           # Menu, Save, Export, Undo/Redo
│   │   ├── LeftPanel.jsx        # Media library, Audio, Text tabs
│   │   ├── RightPanel.jsx       # Properties inspector
│   │   ├── PreviewPlayer.jsx    # Canvas preview + playback controls
│   │   └── Timeline.jsx         # Timeline utama (canvas + tracks)
│   ├── timeline/
│   │   ├── TimelineRuler.jsx    # Ruler waktu (00:00 - end)
│   │   ├── TrackLane.jsx        # Satu baris track (video/audio/text)
│   │   ├── Clip.jsx             # Satu klip di timeline
│   │   └── Playhead.jsx         # Garis posisi waktu saat ini
│   ├── media/
│   │   ├── MediaImporter.jsx    # Drag & drop / file picker
│   │   └── MediaThumbnail.jsx   # Thumbnail di panel kiri
│   └── controls/
│       ├── PlaybackControls.jsx # Play/Pause/Stop/Loop
│       └── ZoomSlider.jsx       # Zoom in/out timeline
├── store/
│   ├── projectStore.js          # State proyek (tracks, clips, metadata)
│   ├── playbackStore.js         # currentTime, isPlaying, duration
│   └── uiStore.js               # Panel visibility, selected clip, zoom
├── hooks/
│   ├── useMediaImport.js        # Handle file import logic
│   ├── usePlayback.js           # requestAnimationFrame loop
│   └── useTimeline.js           # Drag, resize, snap logic
├── utils/
│   ├── ffmpegHelper.js          # FFmpeg.wasm wrapper (Part 3)
│   ├── timeFormat.js            # 00:00:00 formatter
│   └── thumbnailGen.js          # Generate video thumbnail dari frame
└── assets/
    └── icons/                   # SVG icons (Lucide atau custom)
```

---

## Prompt untuk Codex — PART 1A: App Shell & Layout

```
Buat React app dengan Vite dan Tailwind CSS. Layout utama adalah editor video mirip CapCut.

Struktur layout (gunakan CSS Grid):
- TopBar: tinggi 48px, background #1a1a1a, berisi: logo kiri, tombol Menu, 
  label nama proyek di tengah, tombol Bagikan + Ekspor di kanan.
- MainArea: sisa tinggi layar, dibagi 3 kolom:
  - LeftPanel: lebar 280px, background #111, berisi tab: Media | Audio | Teks | Stiker | Efek | Filter
  - PreviewArea: flex-grow, background #0d0d0d, berisi canvas preview video di tengah + 
    playback controls di bawah preview
  - RightPanel: lebar 320px, background #111, berisi properties inspector (kosong dulu)
- Timeline: tinggi 220px di bawah MainArea, background #0a0a0a

Semua warna gelap seperti CapCut. Gunakan border #2a2a2a untuk pemisah.
Buat semua komponen sebagai file terpisah di src/components/layout/.
Gunakan Zustand untuk uiStore: { leftTab: 'media', selectedClip: null, timelineZoom: 1 }
```

---

## Prompt untuk Codex — PART 1B: Left Panel (Media Library)

```
Buat komponen LeftPanel.jsx untuk video editor.

Fitur:
1. Tab bar di atas: Media, Audio, Teks, Stiker, Efek, Filter, Transisi
   - Tab aktif: teks putih + border-bottom biru #4d9eff
   - Tab tidak aktif: teks #888

2. Panel "Media" (tab default):
   - Tombol "+ Impor" (biru) dan "Rekam" (outline putih) sejajar di atas
   - Sub-tab: Semua | Video | Foto | Audio
   - Grid 2 kolom untuk thumbnail media yang diimpor
   - Setiap thumbnail: gambar/video preview, durasi di pojok kanan bawah, 
     badge "Proxy" jika video besar, checkbox saat hover
   - Tombol "Ditambahkan" muncul jika klip sudah di timeline
   - State dari mediaStore: { items: [], selectedItems: [] }

3. Drag dari thumbnail ke timeline harus bisa (gunakan HTML5 Drag API, 
   set dataTransfer dengan mediaId)

Style: background #111111, teks #cccccc, hover item background #1e1e1e
```

---

## Prompt untuk Codex — PART 1C: Preview Player

```
Buat komponen PreviewPlayer.jsx untuk video editor.

Fitur:
1. Area preview: 
   - Canvas HTML5 ukuran 16:9 (responsif terhadap container)
   - Background hitam
   - Tampilkan frame video saat ini dengan drawImage() dari video element tersembunyi
   - Overlay watermark teks jika belum Pro (opsional, bisa disable)

2. Playback Controls (di bawah canvas):
   - Tombol: Skip-to-start | Frame-back | Play/Pause | Frame-forward | Skip-to-end
   - Timecode kiri: 00:00:01:04 (format HH:MM:SS:FF)
   - Timecode kanan: total durasi proyek
   - Tombol tambahan: Penuh (fullscreen), Rasio (toggle aspect ratio), Ekspor frame

3. Hook usePlayback:
   - Gunakan requestAnimationFrame untuk update currentTime
   - Sync dengan playbackStore: { currentTime, isPlaying, duration }
   - Saat play: increment currentTime setiap frame, stop di akhir

Style: controls background #161616, tombol icon putih, hover #2a2a2a rounded
```

---

## Prompt untuk Codex — PART 1D: Timeline Shell

```
Buat komponen Timeline.jsx sebagai shell timeline video editor.

Struktur (dari atas ke bawah):
1. Toolbar Timeline (tinggi 40px):
   - Kiri: tombol Add Track (+), Undo, Redo, Split, Delete, icon lainnya
   - Kanan: Zoom slider, tombol fit-to-window, magnet snap toggle

2. Track Labels (kolom kiri, lebar 140px):
   - Setiap baris: icon track type, nama track, tombol mute/lock/visible
   - Background #0f0f0f, border-right #2a2a2a

3. Timeline Area (canvas atau div scroll horizontal):
   - TimelineRuler di atas: tanda waktu setiap detik/interval
   - Track lanes: setiap track adalah div dengan posisi absolut
   - Playhead: garis vertikal merah yang bergerak sesuai currentTime
   - Scroll horizontal untuk timeline panjang
   - Zoom: ubah skala pixel-per-second (default: 100px/s)

State dari projectStore:
{
  tracks: [
    { id, type: 'video'|'audio'|'text', name, muted, locked, clips: [] }
  ],
  duration: 0
}

Clip di track: { id, trackId, mediaId, start, end, offset, color }
Klik playhead area → set currentTime ke posisi klik
```

---

## Zustand Store — projectStore.js

```javascript
// Prompt Codex:
// Buat file src/store/projectStore.js menggunakan Zustand.
// 
// State:
// {
//   projectName: '0525',
//   tracks: [],          // array of track objects
//   duration: 0,         // total durasi dalam detik
//   selectedClipId: null,
//   history: [],         // untuk undo/redo
//   historyIndex: -1,
// }
//
// Actions:
// - addTrack(type)           → tambah track baru
// - removeTrack(id)          → hapus track
// - addClip(trackId, clip)   → tambah klip ke track
// - removeClip(clipId)       → hapus klip
// - moveClip(clipId, newStart, newTrackId) → pindah klip
// - trimClip(clipId, newStart, newEnd)     → ubah in/out point
// - splitClip(clipId, atTime)              → pecah klip jadi 2
// - selectClip(clipId)       → set selectedClipId
// - undo()                   → balik ke history sebelumnya
// - redo()                   → maju ke history berikutnya
//
// Setiap action yang mengubah tracks harus push ke history (deep clone state sebelumnya).
// Batasi history maksimal 50 entri.
```

---

## Checklist Part 1

- [ ] App shell render tanpa error
- [ ] LeftPanel: tab switching berfungsi
- [ ] LeftPanel: tombol Import bisa buka file picker
- [ ] PreviewPlayer: canvas render, play/pause toggle
- [ ] Timeline: ruler tampil dengan timecode
- [ ] Timeline: playhead bisa diklik/drag untuk set currentTime
- [ ] Store: addTrack dan addClip bisa dipanggil dari console
- [ ] Undo/Redo: minimal fungsi di store

---

## Catatan Penting

- **Jangan** pakai library timeline pihak ketiga (react-timeline-editor dll) — 
  buat custom agar bisa dikontrol penuh
- Semua warna dari CSS variables di `:root` agar mudah diganti tema
- Gunakan `useRef` untuk canvas dan video element, bukan state
- File media disimpan sebagai `{ id, file: File, url: URL.createObjectURL(file), ... }`
  — jangan upload ke server

---

*Lanjut ke PART 2: Import/Export, Cut, Trim, Freeze Frame*
