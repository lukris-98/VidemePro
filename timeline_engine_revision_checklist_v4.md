# Timeline Engine Revision Checklist — v4.0
**Target Kualitas: Minimal CapCut · Maksimal DaVinci Resolve**
**Disesuaikan dengan UI Asli VidemePro+**
**Framework: React + PySide6/QML + FFmpeg + OpenCV**

---

## Referensi Layout UI Asli (dari Screenshot)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Logo VidemePro+ │ ☰ Menu  │  [  0525 Timecode  ]  │ Bagikan Ekspor │
├───────────────────┬──────────────────────────┬──────────────────────────────┤
│  PANEL KIRI       │  PREVIEW CANVAS (tengah) │  PANEL PROPERTI (kanan)      │
│  Tab: Media       │                          │  Nama: VID...mp4             │
│       Audio       │   [Video Preview Frame]  │  Jenis: video                │
│       Teks        │                          │  MIME: video/mp4             │
│       Stiker      │  ─────────────────────── │  Durasi: 00:00:03            │
│       AI          │  00:00.52 ───●─────────  │  Dimensi: 1920x1080          │
│       Efek        │  Progress Bar  00:03.24  │  Ukuran: 7.9 MB              │
│       Filter      │  ─────────────────────── │  Diubah: 04/06/2026, 09:36   │
│       Transisi    │  ◄◄ ◄ ⏸ ► ►► (Transport)│  ID: 665e...                 │
│                   │  00:00:00:00  00:00:14:00│                              │
│  [Grid Thumbnail] │                          │  "Tambahkan file ke timeline  │
│  [Grid Thumbnail] │                          │   untuk membuka kontrol       │
│                   │                          │   editing lengkap."           │
├───────────────────┴──────────────────────────┴──────────────────────────────┤
│  TOOLBAR TIMELINE: T ✂ ⚡ ✂ 🗑 ↩ ↪   (kanan: 🔍 ─────● 🔎 ⛶)              │
│  ──────────────────────────────────────────────────────────────────────────  │
│  RULER: 00:00:00:00   00:00:01:00   00:00:02:00  ...  00:00:12:00           │
│  ──────────────────────────────────────────────────────────────────────────  │
│  [☰][📷][🔊][🎧]  ← Track Controls        VIDEO TRACK (waveform + thumbnail)│
│  [☰][🔊][🎧]      ← Audio Track Controls  AUDIO TRACK (waveform hijau)      │
│  [☰][🔊][🎧]      ← Audio Track 2 (kosong)                                  │
│  ──────────────────────────────────────────────────────────────────────────  │
│  SCROLLBAR HORIZONTAL                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Progress Implementasi

### 2026-06-06 - Header Timecode, Preview Scrub, Shortcut Playback
- [x] Header tengah sekarang menampilkan timecode playhead, bukan hanya nama project.
- [x] Timecode header dapat diklik lalu diketik langsung untuk lompat posisi.
- [x] Parser input timecode mendukung shorthand `1030`, offset frame `+15` / `-30`, angka detik, dan format colon.
- [x] Progress bar preview canvas tersedia untuk mode timeline normal dan selalu sinkron dengan playhead.
- [x] Progress bar preview media library tetap mempertahankan scrub khusus video preview.
- [x] Shortcut playback dasar v4 ditambahkan/disesuaikan: `.` stop, `Home` ke awal, `End` ke akhir, `Shift+Arrow` lompat 10 frame.
- [x] `npm run build` berhasil setelah perubahan.

---

## Daftar Isi

1. [Tujuan & Filosofi Revisi](#1-tujuan--filosofi-revisi)
2. [Arsitektur & State Management](#2-arsitektur--state-management)
3. [Header & Timecode Bar](#3-header--timecode-bar)
4. [Panel Kiri — Tab System](#4-panel-kiri--tab-system)
5. [Preview Canvas (Tengah)](#5-preview-canvas-tengah)
6. [Panel Properti (Kanan)](#6-panel-properti-kanan)
7. [Toolbar Timeline](#7-toolbar-timeline)
8. [Ruler & Navigasi](#8-ruler--navigasi)
9. [Playhead & Playback Engine](#9-playhead--playback-engine)
10. [Struktur Track](#10-struktur-track)
11. [Sistem Track Otomatis](#11-sistem-track-otomatis)
12. [Item / Clip Management](#12-item--clip-management)
13. [Drag & Drop System](#13-drag--drop-system)
14. [Trim & Slip System](#14-trim--slip-system)
15. [Snapping System](#15-snapping-system)
16. [Seleksi (Marquee & Multi)](#16-seleksi-marquee--multi)
17. [Zoom & Scroll](#17-zoom--scroll)
18. [Audio System](#18-audio-system)
19. [Overlay System](#19-overlay-system)
20. [Thumbnail & Waveform](#20-thumbnail--waveform)
21. [Keyframe System](#21-keyframe-system)
22. [Transition System](#22-transition-system)
23. [Color Grading Integration](#23-color-grading-integration)
24. [Subtitle & Caption System](#24-subtitle--caption-system)
25. [Motion Graphics Layer](#25-motion-graphics-layer)
26. [Marker & Chapter System](#26-marker--chapter-system)
27. [Undo / Redo System](#27-undo--redo-system)
28. [Clipboard & Paste System](#28-clipboard--paste-system)
29. [Split, Ripple & Gap System](#29-split-ripple--gap-system)
30. [Speed & Time Remapping](#30-speed--time-remapping)
31. [Nested Sequence / Compound Clip](#31-nested-sequence--compound-clip)
32. [Linked Clip (Audio + Video)](#32-linked-clip-audio--video)
33. [Render & Export Integration](#33-render--export-integration)
34. [Performa & Rendering Engine](#34-performa--rendering-engine)
35. [Keyboard Shortcut System](#35-keyboard-shortcut-system)
36. [Context Menu System](#36-context-menu-system)
37. [Accessibility](#37-accessibility)
38. [AI Editing Readiness](#38-ai-editing-readiness)
39. [Testing & QA Checklist](#39-testing--qa-checklist)
40. [Hasil Akhir & Definition of Done](#40-hasil-akhir--definition-of-done)

---

## 1. Tujuan & Filosofi Revisi

### Tujuan Utama
- [ ] Timeline stabil, tidak ada race condition antara state dan render
- [ ] Drag & drop halus di 60fps bahkan dengan 200+ item
- [ ] Snapping akurat hingga presisi 1 frame (tidak floating point error)
- [ ] Playback sinkron antara video, audio, dan playhead tanpa drift
- [ ] Multi-track otomatis — user tidak pernah perlu "membuat track manual"
- [ ] Panel Properti kanan tampil kontekstual: kosong saat tidak ada item di timeline, terisi saat item ditambahkan
- [ ] Seleksi item profesional (marquee, multi, linked, range select)
- [ ] Performa tinggi via virtualized rendering

### Filosofi Desain
- [ ] **Non-destructive editing** — file asli tidak pernah dimodifikasi
- [ ] **Single source of truth** — satu state tree, semua UI adalah derivasi state
- [ ] **Immutable state updates** — setiap perubahan menghasilkan state baru
- [ ] **Frame-accurate** — semua posisi dalam satuan frame, bukan detik floating point
- [ ] **Separation of concerns** — engine (logic), renderer (canvas/QML), UI (React/PySide6) terpisah

### Batasan Revisi
- [ ] Cek apakah fitur sudah ada sebelum membuat baru
- [ ] Jika sudah sesuai spesifikasi, jangan ubah kode sama sekali
- [ ] Jika belum sesuai, revisi seperlunya saja
- [ ] Tidak boleh ada duplikasi fungsi atau duplikasi UI
- [ ] Pertahankan kompatibilitas format project lama (migrasi otomatis jika schema berubah)

### Framework yang Digunakan
- [ ] **UI Web/Desktop**: React + Tailwind CSS (panel kiri, properti, toolbar)
- [ ] **Preview Canvas**: PySide6/QML atau React + WebGL
- [ ] **Timeline Rendering**: React + HTML Canvas (waveform, thumbnail, playhead, snap line)
- [ ] **Video Processing**: FFmpeg + FFGear (decode, encode, filter)
- [ ] **Audio Processing**: FFmpeg + NumPy + Web Audio API
- [ ] **Computer Vision**: OpenCV (waveform, thumbnail extraction, stabilizer)
- [ ] **AI Features**: Whisper/faster-whisper (subtitle), PySceneDetect (scene detection)

---

## 2. Arsitektur & State Management

### State Schema
- [ ] `project.timeline.tracks[]` — array track dengan urutan render (z-index)
- [ ] `project.timeline.items[]` — flat array semua item/clip
- [ ] `project.timeline.duration` — durasi total dalam frame
- [ ] `project.timeline.fps` — frame rate (24, 25, 29.97, 30, 50, 59.94, 60, 120)
- [ ] `project.timeline.resolution` — resolusi output (width × height)
- [ ] `project.timeline.markers[]` — marker dan chapter
- [ ] `project.timeline.keyframes[]` — keyframe per item per property
- [ ] `ui.timeline.zoom` — level zoom dalam px-per-frame
- [ ] `ui.timeline.scrollX` — posisi scroll horizontal dalam pixel
- [ ] `ui.timeline.scrollY` — posisi scroll vertikal dalam pixel
- [ ] `ui.timeline.playheadFrame` — posisi playhead dalam frame
- [ ] `ui.timeline.selection` — array ID item yang terpilih
- [ ] `ui.timeline.dragging` — state drag aktif
- [ ] `ui.timeline.trimming` — state trim aktif
- [ ] `ui.timeline.marquee` — state marquee aktif
- [ ] `ui.leftPanel.activeTab` — tab panel kiri yang aktif: "media"|"audio"|"teks"|"stiker"|"ai"|"efek"|"filter"|"transisi"
- [ ] `ui.propertiesPanel.visible` — true jika ada item terpilih atau item di timeline
- [ ] `ui.propertiesPanel.mode` — "media-info"|"clip-edit"|"empty"

### Data Model Item
- [ ] `item.id` — UUID unik
- [ ] `item.trackId` — referensi ke track
- [ ] `item.mediaId` — referensi ke asset media
- [ ] `item.startFrame` — posisi mulai di timeline (dalam frame)
- [ ] `item.durationFrames` — durasi di timeline (dalam frame)
- [ ] `item.inPoint` — in-point di media source (dalam frame)
- [ ] `item.outPoint` — out-point di media source (dalam frame)
- [ ] `item.speed` — multiplier kecepatan (1.0 = normal)
- [ ] `item.volume` — volume 0.0–1.0
- [ ] `item.opacity` — opacity 0.0–1.0
- [ ] `item.blendMode` — blend mode
- [ ] `item.effects[]` — array efek
- [ ] `item.keyframes{}` — map property → array keyframe
- [ ] `item.linkedItemId` — ID item yang di-link (audio↔video)
- [ ] `item.locked` — item terkunci
- [ ] `item.muted` — item di-mute
- [ ] `item.label` — warna label (8 pilihan)
- [ ] `item.name` — nama kustom item
- [ ] `item.metadata{}` — codec, bitrate, resolution, dll.

---

## 3. Header & Timecode Bar

### Layout Header (Sesuai Screenshot)
```
[Logo VidemePro+] [☰ Menu] ─────── [ 0525 Timecode ] ─────── [🔗 Bagikan] [⬇ Ekspor]
```

### Timecode Display Tengah

**UX — Klik Timecode untuk Input Manual:**
1. User klik display timecode di tengah header (contoh: `0525`)
2. Display berubah menjadi input field, angka terpilih semua (highlight biru)
3. User ketik posisi baru, misalnya `1030` → diinterpretasi sebagai `00:00:10:30`
4. User tekan `Enter` → playhead melompat ke posisi tersebut, preview canvas update
5. User tekan `Escape` → input dibatalkan, posisi tidak berubah

**UX — Input Relatif:**
1. User klik timecode display
2. User ketik `+15` → playhead maju 15 frame dari posisi saat ini
3. User ketik `-30` → playhead mundur 30 frame dari posisi saat ini
4. `Enter` → diterapkan

- [ ] Timecode display di tengah header, selalu terlihat di semua kondisi
- [ ] Format tampilan: `MMSS` saat durasi pendek, `HH:MM:SS:FF` saat durasi panjang
- [ ] Klik → input field muncul dengan teks terpilih semua
- [ ] Shorthand: `1030` → `00:00:10:30`, `+15` → maju 15 frame, `-30` → mundur 30 frame
- [ ] `Enter` → lompat ke posisi, `Escape` → batal
- [ ] Tombol **Bagikan** di kanan header: share/export ke platform eksternal
- [ ] Tombol **Ekspor** (biru, primary) di kanan header: buka dialog render & export

---

## 4. Panel Kiri — Tab System

### Struktur Tab (Sesuai Screenshot)
```
[ Media | Audio | Teks | Stiker | AI | Efek | Filter | Transisi ]
```

**UX — Navigasi Antar Tab:**
1. User klik tab "Media" → panel menampilkan grid thumbnail media yang sudah diimport
2. User klik tab "Audio" → panel menampilkan library musik, sound effect, voice
3. User klik tab "Teks" → panel menampilkan preset template teks, font, gaya
4. User klik tab "Stiker" → panel menampilkan library stiker, emoji, shape dekoratif
5. User klik tab "AI" → panel menampilkan fitur AI: Auto Cut, Auto Subtitle, B-Roll, dll.
6. User klik tab "Efek" → panel menampilkan library efek visual (blur, glow, dll.)
7. User klik tab "Filter" → panel menampilkan preset LUT/filter warna (cinematic, warm, cold)
8. User klik tab "Transisi" → panel menampilkan library transisi (dissolve, wipe, zoom)
9. Tab aktif mendapat highlight underline/background berbeda

**UX — Pencarian di Panel:**
1. User klik ikon 🔍 di dalam panel → search bar muncul di atas grid
2. User ketik kata kunci → grid difilter realtime
3. Klik X → search dibersihkan, grid kembali ke semua item

**UX — Tambah Media Baru (Tab Media):**
1. User klik tombol `+` di pojok kanan atas panel Media
2. File picker terbuka: multi-select, filter ke video/audio/gambar
3. User pilih file → file diimport, thumbnail di-generate via FFmpeg/OpenCV
4. Thumbnail muncul di grid dengan indikator loading, lalu tampil penuh
5. File ditampilkan dengan nama, thumbnail, dan durasi di pojok kanan bawah

**UX — Status "Ditambahkan" pada Thumbnail:**
1. Saat item sudah ada di timeline, thumbnail di panel menampilkan badge `Ditambahkan` (biru) di bawahnya
2. Ini sesuai dengan UI screenshot yang menampilkan badge tersebut

- [ ] 8 tab: Media, Audio, Teks, Stiker, AI, Efek, Filter, Transisi
- [ ] Tab aktif highlighted (underline atau background berbeda)
- [ ] Grid thumbnail 2 kolom di dalam panel
- [ ] Setiap thumbnail menampilkan: gambar preview, nama file (truncated), durasi/ukuran
- [ ] Badge "Ditambahkan" berwarna biru muncul di bawah thumbnail jika item sudah di timeline
- [ ] Tombol `+` untuk import media baru (tab Media)
- [ ] Search bar tersembunyi, muncul saat ikon 🔍 diklik
- [ ] Panel dapat di-resize (drag border kanan panel kiri)
- [ ] Lebar default ~430px, minimum 300px, maksimum 600px

---

## 5. Preview Canvas (Tengah)

### Layout Preview (Sesuai Screenshot)
```
┌─────────────────────────────────────────┐
│                                         │
│         [Frame Video / Gambar]          │
│                                         │
├─────────────────────────────────────────┤
│  00:00.52 ────────●────────  00:03.24   │
├─────────────────────────────────────────┤
│    ◄◄    ◄    ⏸    ►    ►►              │
│  00:00:00:00            00:00:14:00     │
└─────────────────────────────────────────┘
```

### Canvas Frame

**UX — Preview Frame saat Playhead Bergerak:**
1. Saat user drag playhead di timeline → canvas preview update realtime ke frame tersebut
2. Saat playback berjalan → canvas update setiap frame (60fps target)
3. Saat tidak ada item di timeline → canvas kosong atau placeholder abu-abu

**UX — Klik Item Overlay di Canvas:**
1. User klik pada overlay/teks di canvas preview
2. Bounding box dengan 8 handle transform muncul di sekeliling item
3. Property panel kanan menampilkan properti item tersebut
4. Drag tengah bounding box → pindah posisi overlay
5. Drag sudut → scale (tahan `Shift` untuk lock aspect ratio)
6. Drag handle atas (lingkaran) → rotate

### Progress Bar Preview

**UX — Scrub via Progress Bar:**
1. User klik dan drag di progress bar yang ada di bawah canvas (sesuai screenshot)
2. Playhead di timeline dan posisi frame di canvas bergerak sinkron
3. User lepas → posisi tersimpan

**UX — Klik Titik di Progress Bar:**
1. User klik sembarang titik di progress bar
2. Playhead langsung lompat ke posisi tersebut (snap ke frame terdekat)

### Transport Controls

**UX — Tombol Transport (Sesuai Screenshot: ◄◄ ◄ ⏸ ► ►►):**
1. `◄◄` (Jump to Start) → playhead ke frame 0
2. `◄` (Previous Frame / Rewind) → playhead mundur 1 frame atau 10 frame
3. `⏸` / `▶` (Play/Pause toggle) → mulai/hentikan playback
4. `►` (Next Frame / Forward) → playhead maju 1 frame atau 10 frame
5. `►►` (Jump to End) → playhead ke frame terakhir
6. Tombol play berubah ikon antara ▶ dan ⏸ sesuai state

**UX — Display Timecode bawah Canvas:**
1. Kiri bawah canvas: timecode posisi playhead saat ini (`00:00:00:00`)
2. Kanan bawah canvas: durasi total timeline (`00:00:14:00`)
3. Saat playback: timecode kiri bergerak realtime

- [ ] Canvas preview menampilkan frame sesuai posisi playhead
- [ ] Progress bar di bawah canvas: klik atau drag untuk scrub
- [ ] Indikator posisi (bulatan/thumb) pada progress bar
- [ ] Tombol transport: Jump Start, Rewind, Play/Pause, Forward, Jump End
- [ ] Timecode kiri (posisi saat ini) dan kanan (durasi total) di bawah transport
- [ ] Canvas update realtime saat playhead bergerak (baik via drag timeline maupun progress bar)
- [ ] Bounding box + handle transform saat klik overlay di canvas
- [ ] Placeholder / blank state saat tidak ada item di timeline
- [ ] Aspect ratio canvas mengikuti resolusi project (default 16:9)
- [ ] Fullscreen toggle di pojok kanan atas canvas

---

## 6. Panel Properti (Kanan)

### Mode Panel Properti (Sesuai Screenshot)

Panel Properti tampil di sisi kanan, kontekstual berdasarkan kondisi:

**Mode 1 — Media Info (saat thumbnail diklik di panel kiri):**
```
PROPERTI
├─ Nama:     VID20260522112458.mp4
├─ Jenis:    video
├─ MIME:     video/mp4
├─ Durasi:   00:00:03
├─ Dimensi:  1920 x 1080
├─ Ukuran:   7.9 MB
├─ Diubah:   04/06/2026, 09:36
└─ ID:       665e169e-6cb3-4f14-8244...

"Tambahkan file ke timeline untuk membuka
 kontrol editing lengkap."
```

**Mode 2 — Clip Edit (saat item di timeline diklik):**
- Menampilkan semua properti item yang dapat diedit
- Tombol-tombol aksi tersedia

**Mode 3 — Empty (tidak ada seleksi):**
- Panel kosong atau menampilkan hint penggunaan

**UX — Mode Media Info:**
1. User klik thumbnail di panel kiri → properti file muncul di panel kanan
2. Semua field read-only: Nama, Jenis, MIME, Durasi, Dimensi, Ukuran, Diubah, ID
3. Di bawah info, ada teks panduan: "Tambahkan file ke timeline untuk membuka kontrol editing lengkap."
4. Tombol `+` muncul di bawah teks untuk quick-add ke timeline

**UX — Mode Clip Edit:**
1. User klik item di timeline → panel kanan beralih ke mode edit
2. Field yang tersedia: Nama (editable), Speed, Volume, Opacity
3. Tab: Transform | Color | Audio | Effects | Keyframe
4. Semua perubahan realtime: ubah nilai → canvas update langsung

**UX — Tombol `+` di Header Panel Properti:**
1. Tombol `+` di pojok kanan atas panel properti (sesuai screenshot)
2. Klik → buka dialog atau action untuk menambah properti/efek baru ke item terpilih
3. Jika tidak ada item terpilih → shortcut untuk import media

- [ ] Header "PROPERTI" dengan tombol `+` di pojok kanan atas
- [ ] Mode Media Info: field read-only saat thumbnail di panel kiri diklik
- [ ] Field Media Info: Nama, Jenis, MIME, Durasi, Dimensi, Ukuran, Diubah, ID
- [ ] Teks panduan "Tambahkan file ke timeline..." saat item belum di timeline
- [ ] Mode Clip Edit: field editable saat item di timeline diklik
- [ ] Tab di mode Clip Edit: Transform, Color, Audio, Effects, Keyframe
- [ ] Semua perubahan value → canvas update realtime (tidak perlu klik Apply)
- [ ] Reset per-property dengan tombol reset kecil di samping setiap field
- [ ] Mode Empty: panel kosong atau hint penggunaan

---

## 7. Toolbar Timeline

### Layout Toolbar (Sesuai Screenshot)
```
Kiri: [T] [✂] [⚡] [✂] [🗑] [↩] [↪]
Kanan: [🔍] [─────●─────] [🔎] [⛶]
```

**UX — Tombol Toolbar Kiri:**
1. `T` (Text Tool) → mode tambah teks ke overlay, kursor berubah, klik di canvas untuk buat teks
2. `✂` (Razor/Split Tool) → mode split, klik di atas item di timeline untuk split di titik tersebut
3. `⚡` (Select/Snap Tool) → mode select normal (default)
4. `✂` (Trim Tool) → mode trim khusus, hover di tepi item langsung siap trim
5. `🗑` (Delete) → hapus item terpilih saat ini
6. `↩` (Undo) → undo aksi terakhir
7. `↪` (Redo) → redo aksi yang di-undo

**UX — Toolbar Kanan (Zoom):**
1. `🔍-` (Zoom Out) → timeline zoom out, semua item terlihat lebih kecil
2. Slider zoom — drag ke kanan untuk zoom in, ke kiri untuk zoom out
3. `🔎+` (Zoom In) → timeline zoom in, item terlihat lebih besar per frame
4. `⛶` (Fit/Fullscreen) → zoom otomatis agar semua item muat di layar

**UX — Indicator Active Tool:**
1. Tombol tool yang aktif mendapat highlight (background terang atau border)
2. User dapat menekan `Escape` untuk kembali ke Select Tool (default)

- [ ] Tool: Select (default), Text, Razor/Split, Trim, Delete aktif berubah highlight
- [ ] Undo/Redo tombol di toolbar (juga bisa via `Ctrl+Z` / `Ctrl+Shift+Z`)
- [ ] Zoom slider di kanan toolbar: range 10%–2000%
- [ ] Zoom Out (`-`) dan Zoom In (`+`) tombol di samping slider
- [ ] Fit button (`⛶` / `\`) untuk fit semua item di layar
- [ ] Kursor berubah sesuai tool aktif
- [ ] `Escape` → kembali ke Select Tool

---

## 8. Ruler & Navigasi

### Ruler (Sesuai Screenshot)
```
00:00:00:00   00:00:01:00   00:00:02:00  ...  00:00:12:00   00:00:13:00
```

**UX — Klik Ruler untuk Pindah Playhead:**
1. User klik di sembarang titik pada ruler
2. Garis merah playhead langsung melompat ke posisi tersebut (snap ke frame terdekat)
3. Progress bar di preview canvas dan timecode header update sinkron

**UX — Drag (Scrub) di Ruler:**
1. User klik tahan di ruler lalu drag ke kiri atau kanan
2. Playhead bergerak mengikuti kursor secara realtime
3. Canvas preview update per frame selama drag (audio scrubbing aktif)
4. User lepas mouse → playhead berhenti di posisi terakhir

**UX — Klik Kanan Ruler:**
1. User klik kanan di ruler → context menu muncul:
   - Tambah Marker
   - Tambah Chapter Marker
   - Set In Point di sini
   - Set Out Point di sini
   - Hapus In/Out Point
2. Posisi frame target sudah terdeteksi dari posisi klik

**UX — Set In/Out Range di Ruler:**
1. User tekan `I` → in point dipasang di posisi playhead saat ini
2. User tekan `O` → out point dipasang
3. Area antara in/out tampil highlight biru semi-transparan di ruler
4. Saat export, secara default hanya area ini yang di-render

- [ ] Ruler sticky di atas timeline (tidak ikut scroll vertikal)
- [ ] Format timecode: `HH:MM:SS:FF`
- [ ] Tick marks dan label adaptif sesuai zoom level
- [ ] Label timecode tidak overlap satu sama lain
- [ ] Klik ruler → pindah playhead + update canvas + update timecode header
- [ ] Drag ruler → scrub playhead realtime
- [ ] Klik kanan ruler → context menu
- [ ] Area in/out highlight biru semi-transparan di ruler
- [ ] Playhead line merah dari ruler memanjang ke bawah menembus semua track

---

## 9. Playhead & Playback Engine

### Playhead

**UX — Drag Playhead (Scrubbing):**
1. User hover di kepala playhead (segitiga merah di ruler) → kursor berubah ke `grab`
2. User klik tahan → `grabbing`
3. User drag horizontal → playhead bergerak, canvas update per frame
4. Audio scrubbing aktif selama drag
5. User lepas → posisi terkunci, scrub selesai

**UX — Sinkronisasi Playhead dengan Progress Bar:**
1. Saat user drag playhead di timeline → progress bar di canvas juga bergerak
2. Saat user drag progress bar di canvas → playhead di timeline juga bergerak
3. Keduanya selalu sinkron (single source of truth)

- [ ] Garis vertikal tipis (1–2px) merah/oranye dari ruler sampai track paling bawah
- [ ] Kepala playhead berbentuk segitiga di ruler
- [ ] Hover → kursor `grab`, klik tahan → `grabbing`
- [ ] Drag horizontal untuk scrub (snap ke frame terdekat saat release)
- [ ] Tidak bisa melewati batas frame 0 dan durasi total
- [ ] Z-index tertinggi (selalu di atas semua item)
- [ ] Playhead dan progress bar canvas SELALU sinkron

### Playback Engine

**UX — Play / Pause via Tombol Transport:**
1. User klik tombol ▶ (Play) di transport controls bawah canvas
2. Playhead mulai bergerak, canvas update realtime, audio berjalan
3. Timeline auto-scroll agar playhead selalu terlihat (tidak keluar dari viewport)
4. User klik tombol ⏸ (Pause) → playback berhenti, playhead diam

**UX — Play via Keyboard:**
1. User tekan `Space` → Play/Pause toggle
2. Tombol transport ikut berubah ikon sesuai state

**UX — Loop Playback:**
1. User set in-point dan out-point
2. User aktifkan tombol loop (ikon 🔁 di transport)
3. Saat playhead mencapai out-point → otomatis kembali ke in-point

- [ ] `Space` → Play/Pause
- [ ] `.` (titik) → Stop, kembali ke in-point atau frame 0
- [ ] `Shift+Space` → Play mundur
- [ ] Playhead bergerak via `requestAnimationFrame` (bukan `setInterval`)
- [ ] Sinkronisasi waktu via `AudioContext.currentTime` sebagai clock master
- [ ] Auto-scroll: timeline scroll agar playhead selalu visible saat playback
- [ ] Toggle auto-scroll on/off via toolbar atau menu
- [ ] Loop mode pada range in/out point
- [ ] Kecepatan playback: 0.25x, 0.5x, 1x, 1.5x, 2x (pilih dari dropdown di transport)

### Transport Controls (Keyboard)
- [ ] `←` / `→` → previous/next frame
- [ ] `Shift+←` / `Shift+→` → jump 10 frame
- [ ] `Home` → jump to start (frame 0)
- [ ] `End` → jump to end (frame terakhir)
- [ ] `↑` / `↓` → previous/next edit point (tepi item)
- [ ] `Shift+↑` / `Shift+↓` → previous/next marker

---

## 10. Struktur Track

### Layout Track (Sesuai Screenshot)
```
Track Controls (Kiri)          Area Item (Kanan)
───────────────────────────────────────────────────────────
[☰][📷][🔊][🎧]                VIDEO TRACK (thumbnail + waveform hijau)
[☰][🔊][🎧]                    AUDIO TRACK 1 (waveform hijau)
[☰][🔊][🎧]                    AUDIO TRACK 2 (kosong / buffer)
[☰][🔊][🎧]                    AUDIO TRACK 3 (kosong / buffer)
```

### Track Controls (Kiri)
Sesuai screenshot, setiap track memiliki kontrol di sisi kiri:

**UX — Ikon Track Controls:**
1. `☰` (drag handle) → klik tahan untuk reorder track (hanya audio dan overlay)
2. `📷` (thumbnail track icon) → hanya di video track, menampilkan thumbnail project kecil
3. `🔊` (mute) → toggle mute/unmute track; ikon berubah ke speaker coret saat muted
4. `🎧` (solo/headphone) → toggle solo track; track lain muted sementara

**UX — Tambah Thumbnail Project (Track Video):**
1. User hover di area thumbnail kecil di sisi kiri video track (ikon 📷)
2. Tombol `+` dan ikon pensil muncul overlay di thumbnail
3. User klik `+` → file picker terbuka (PNG, JPG, WEBP)
4. User pilih gambar → gambar dipakai sebagai cover/thumbnail project
5. Thumbnail terotomatis dari frame pertama video jika belum diatur

- [ ] Setiap track punya drag handle `☰` di kiri (untuk reorder)
- [ ] Track video: icon thumbnail 56×40px, mute, solo
- [ ] Track audio/overlay: mute, solo
- [ ] Mute toggle: ikon berubah, track menjadi semi-transparan
- [ ] Solo toggle: track lain muted sementara
- [ ] Hover thumbnail → tombol `+` dan pensil muncul
- [ ] Klik `+` thumbnail → file picker (PNG, JPG, WEBP)
- [ ] Auto-thumbnail dari frame pertama video

---

## 11. Sistem Track Otomatis

**UX — Drop Media ke Timeline (Buat Track Otomatis):**
1. User drag thumbnail dari panel kiri ke area timeline
2. Saat drag masuk ke area timeline → ghost item muncul di posisi perkiraan drop
3. Jika belum ada video track → video track baru dibuat otomatis, item ditempatkan di sana
4. User lepas → item baru muncul di timeline dengan animasi slide-in 150ms
5. Untuk file video: item video di main track + item audio terlink di audio track
6. Badge "Ditambahkan" langsung muncul di thumbnail panel kiri

**UX — Track Overlay Otomatis:**
1. User drag gambar/teks ke area di atas video track → track overlay baru terbuat
2. Buffer 3 track overlay kosong selalu tersedia di atas
3. Saat item di-drop ke buffer track → 1 track kosong baru tumbuh otomatis

**UX — Track Audio Otomatis:**
1. User drag audio ke area di bawah video track → audio track baru terbuat
2. Buffer 3 track audio kosong selalu tersedia di bawah
3. Track kosong hilang otomatis setelah 2 detik idle (kecuali buffer minimum)

**UX — Track Kosong Hilang Otomatis:**
1. User hapus item dari track overlay/audio
2. Track jadi kosong → sistem tunggu 2 detik
3. Jika tidak ada aktivitas → track hilang dengan animasi slide-out 150ms
4. Track buffer minimum dipertahankan

- [ ] Drop video ke area kosong → main video track + audio track terbuat otomatis
- [ ] Drop overlay/gambar ke area atas → overlay track baru terbuat
- [ ] Drop audio ke area bawah → audio track baru terbuat
- [ ] Animasi slide-in 150ms saat track dibuat
- [ ] Animasi slide-out 150ms saat track dihapus otomatis
- [ ] Minimal 3 track overlay buffer (opacity 40%)
- [ ] Minimal 3 track audio buffer (opacity 40%)
- [ ] Track kosong hilang otomatis setelah 2 detik idle
- [ ] Badge "Ditambahkan" di panel kiri muncul saat item berhasil di-drop ke timeline
- [ ] Tidak ada tombol "Tambah Track" manual — sepenuhnya otomatis

---

## 12. Item / Clip Management

### Tampilan Item (Sesuai Screenshot)
Sesuai screenshot, item di timeline menampilkan:
- Nama file di dalam item (truncated)
- Waveform audio di dalam item (warna hijau untuk audio, sesuai screenshot)
- Warna latar belakang per tipe: video = biru-abu, audio = hijau tua

**UX — Klik Item (Select):**
1. User klik satu item → item mendapat border highlight
2. Panel Properti kanan beralih ke mode Clip Edit, menampilkan properti item
3. Item lain yang sebelumnya terpilih menjadi tidak terpilih

**UX — Hapus Item:**
1. User klik item → terpilih
2. User tekan `Delete` atau klik tombol 🗑 di toolbar
3. Item menghilang dari timeline
4. Jika track jadi kosong → track hilang otomatis setelah 2 detik
5. Aksi masuk ke undo history ("Hapus Clip")

**UX — Duplikat Item:**
1. User klik item → terpilih
2. User tekan `Ctrl+D` → salinan muncul tepat setelah item asli di track sama
3. Salinan langsung terpilih (siap dipindah)

**UX — Double-click Item:**
1. User double-click item di timeline
2. Panel Properti kanan fokus ke tab yang relevan (misal: tab Color untuk video)
3. Atau, untuk subtitle: teks menjadi editable inline

- [ ] Warna item per tipe: video = biru-abu, audio = hijau, overlay = ungu, teks = kuning
- [ ] Nama file tampil di dalam item (truncated dengan ellipsis)
- [ ] Waveform audio di dalam item audio (sesuai screenshot: waveform hijau)
- [ ] Thumbnail strip di item video (preview frame)
- [ ] Border highlight saat terpilih
- [ ] Ikon gembok jika locked, speaker coret jika muted
- [ ] Badge `2x` / `0.5x` jika speed ≠ 1.0
- [ ] Badge `FX` jika ada efek aktif
- [ ] Handle trim kiri/kanan muncul saat hover di tepi item
- [ ] Single click → select + tampilkan properti di panel kanan
- [ ] Double-click → fokus ke panel properti / edit inline
- [ ] `Delete` atau tombol 🗑 toolbar → hapus item terpilih
- [ ] `Ctrl+D` → duplikat item

---

## 13. Drag & Drop System

### Drag dari Panel Kiri ke Timeline

**UX — Drop Video dari Panel Media ke Timeline:**
1. User hover thumbnail di panel kiri → kursor berubah ke `grab`
2. User klik tahan dan drag ke area timeline
3. Saat masuk ke area timeline → ghost item muncul dengan posisi perkiraan
4. Snap aktif: ghost snap ke frame atau tepi item terdekat
5. Highlight area drop muncul (glow atau border berwarna)
6. User lepas → item baru terbuat di posisi tersebut
7. Untuk video: item video di main track + item audio terlink terbuat sekaligus
8. Badge "Ditambahkan" muncul di thumbnail panel kiri

**UX — Drop Efek/Filter/Transisi dari Panel ke Item:**
1. User drag efek dari tab Efek → ke atas item di timeline
2. Item mendapat highlight border saat efek melintas di atasnya
3. User lepas di atas item → efek langsung teraplikasi
4. Badge `FX` muncul di item, panel properti kanan membuka tab Effects

### Drag Item di Dalam Timeline

**UX — Pindah Item (Drag):**
1. User hover di tengah item → kursor berubah ke `grab`
2. User klik tahan → kursor ke `grabbing`, item "terangkat" 6px (translateY -6px)
3. Shadow muncul (`box-shadow: 0 8px 24px rgba(0,0,0,0.4)`)
4. Ghost placeholder (opacity 30%) di posisi asal
5. Drag kiri/kanan → item bergerak mengikuti kursor
6. Snap aktif: item "tertarik" ke titik snap, garis kuning muncul
7. Auto-scroll saat mendekati tepi kiri/kanan viewport
8. User lepas → item jatuh di posisi, snap ke frame terdekat, animasi return-to-normal
9. Aksi masuk ke undo history ("Pindah Clip")

**UX — Drag ke Track Lain:**
1. User drag item secara vertikal ke track berbeda
2. Track tujuan mendapat highlight saat item melintas
3. User lepas → item berpindah ke track tujuan
4. Validasi: item audio tidak bisa ke video track, dan sebaliknya

**UX — Multi-Drag:**
1. User pilih beberapa item terlebih dahulu
2. User drag salah satu yang terpilih → semua yang terpilih ikut bergerak
3. Offset relatif antar item dipertahankan

- [ ] Drag dari panel kiri ke timeline: ghost item + snap + highlight
- [ ] Drag video → item video + audio terbuat sekaligus (linked)
- [ ] Drag efek/filter/transisi ke item → langsung apply
- [ ] Drag item di timeline: terangkat 6px + shadow + ghost placeholder
- [ ] Threshold drag 4px sebelum drag resmi dimulai
- [ ] Garis snap kuning vertikal memanjang seluruh tinggi track
- [ ] Auto-scroll saat drag mendekati tepi viewport
- [ ] Highlight track tujuan saat drag vertikal ke track lain
- [ ] Insert mode: tahan `Ctrl` saat drop → semua item di kanan bergeser
- [ ] Validasi tipe: audio tidak bisa di-drop ke video track
- [ ] Multi-drag: semua item terpilih bergerak bersama, offset dipertahankan
- [ ] `Alt+Drag` → duplicate saat drag

---

## 14. Trim & Slip System

**UX — Trim Kanan:**
1. User hover di tepi kanan item → handle trim muncul, kursor berubah ke `e-resize`
2. User klik tahan → drag ke kiri (perpendek) atau kanan (panjangkan jika media tersedia)
3. Tooltip realtime: `Out: 00:00:03:00 | Durasi: 00:00:02:15`
4. Waveform/thumbnail update realtime
5. User lepas → trim selesai, masuk undo history ("Trim Clip")

**UX — Trim Kiri:**
1. Hover tepi kiri item → kursor `w-resize`
2. Drag kanan untuk perpendek, kiri untuk panjangkan
3. Tooltip: `In: 00:00:00:15 | Durasi: 00:00:02:15`

**UX — Trim via Keyboard:**
1. User pilih item → `Alt+]` → out-point 1 frame ke dalam
2. `Alt+[` → in-point 1 frame ke dalam
3. `Shift+Alt+]` / `Shift+Alt+[` → 10 frame sekaligus

**UX — Ripple Trim (Tahan R saat Drag):**
1. User hover di tepi item → tahan `R` → kursor menampilkan ikon ripple
2. Drag → item di-trim, semua item di kanan otomatis bergeser, tidak ada gap

**UX — Roll Trim (Alt + Hover di Batas Dua Clip):**
1. User hover tepat di batas antara 2 item bersebelahan sambil tahan `Alt`
2. Kursor → ikon roll trim
3. Drag → out-point clip kiri dan in-point clip kanan berubah simultan

- [ ] Handle trim kiri/kanan muncul saat hover di tepi item
- [ ] Cursor `w-resize` (kiri) dan `e-resize` (kanan)
- [ ] Tooltip timecode + durasi realtime saat trim
- [ ] Waveform dan thumbnail update realtime
- [ ] Snap aktif saat trim
- [ ] Durasi minimum 1 frame, tidak bisa melebihi batas media source
- [ ] Ripple Trim: `R` + drag tepi
- [ ] Roll Trim: `Alt` + hover di batas dua clip + drag
- [ ] Slip: `S` + drag dalam item (in/out bergeser, posisi/durasi tetap)
- [ ] Slide: `Shift+S` + drag (item bergeser, item tetangga di-trim otomatis)
- [ ] `[` → set in-point ke playhead, `]` → set out-point ke playhead

---

## 15. Snapping System

**UX — Snap Saat Drag:**
1. User drag item → dalam radius 8px dari titik snap, item "tertarik"
2. Garis snap kuning vertikal muncul memanjang semua track
3. Tooltip kecil: "Snap to clip start" / "Snap to playhead" / "Snap to marker"
4. User lepas → item jatuh persis di titik snap, presisi frame

**UX — Nonaktifkan Snap Sementara:**
1. Saat drag → tahan `Alt` → snap dinonaktifkan sementara, item bergerak bebas
2. Lepas `Alt` → snap aktif kembali

**UX — Toggle Snap Permanen:**
1. User klik tombol `⚡` (magnet) di toolbar → snap dinonaktifkan
2. Klik lagi → snap aktif kembali

- [ ] Snap ke tepi kiri item (start frame)
- [ ] Snap ke tepi kanan item (end frame)
- [ ] Snap ke posisi playhead
- [ ] Snap ke marker
- [ ] Snap ke batas in/out range
- [ ] Snap ke frame terdekat (selalu aktif)
- [ ] Snap ke grid waktu (opsional, dari context menu tombol snap)
- [ ] Garis snap kuning vertikal memanjang seluruh tinggi track
- [ ] Tooltip label tipe snap
- [ ] Threshold snap 8px (dapat dikonfigurasi)
- [ ] `Alt` held → suspend snap sementara
- [ ] Tombol `⚡` di toolbar → toggle snap permanen

---

## 16. Seleksi (Marquee & Multi)

**UX — Single Select:**
1. User klik item → terpilih (border highlight), yang lain deselected
2. Panel Properti kanan tampil mode Clip Edit
3. Klik area kosong timeline → semua deselected, panel properti kembali ke empty/media-info

**UX — Multi Select via Ctrl+Click:**
1. User klik item A → terpilih
2. `Ctrl+Click` item B → B ditambah ke seleksi (toggle)
3. Panel Properti menampilkan nilai bersama (yang beda dikosongkan)

**UX — Marquee Selection:**
1. User klik tahan di area kosong timeline (bukan di atas item)
2. Kotak marquee semi-transparan tumbuh mengikuti kursor
3. Item yang bersinggungan → highlight preview "akan terpilih"
4. Tahan `Alt` → mode contain (hanya yang sepenuhnya di dalam kotak)
5. User lepas → semua item yang tersentuh kotak resmi terpilih
6. `Escape` saat marquee → batalkan

- [ ] Klik area kosong → deselect all
- [ ] `Ctrl+Click` → toggle item ke/dari seleksi
- [ ] `Shift+Click` → range select per track
- [ ] `Ctrl+A` → select all, `Ctrl+Shift+A` → deselect all
- [ ] Klik nama track di panel kiri → select semua item di track itu
- [ ] Drag di area kosong → marquee selection
- [ ] Kotak marquee: border solid 1px biru/putih, fill biru opacity 20%
- [ ] Realtime highlight item yang akan terpilih saat marquee aktif
- [ ] `Alt` held → mode contain (fully inside only)
- [ ] `Escape` → batalkan marquee

---

## 17. Zoom & Scroll

**UX — Zoom via Slider Toolbar:**
1. User drag slider zoom di toolbar kanan → timeline zoom berubah realtime
2. Label persentase muncul di samping slider
3. Klik `🔎+` → zoom in, klik `🔍-` → zoom out

**UX — Zoom via Keyboard/Scroll:**
1. `Ctrl+Scroll` → zoom in/out, pivot di posisi mouse
2. `=` / `+` → zoom in, `-` → zoom out
3. `\` atau `⛶` button → fit semua item di layar

**UX — Scroll:**
1. Scroll wheel → scroll horizontal timeline
2. `Shift+Scroll` → scroll vertikal (antar track)
3. Trackpad swipe dua jari → scroll horizontal dengan momentum

- [ ] Zoom slider toolbar kanan, range 10%–2000%
- [ ] `Ctrl+Scroll` → zoom in/out pivot di posisi mouse
- [ ] `=` / `+` → zoom in, `-` → zoom out
- [ ] `\` → fit timeline
- [ ] Scroll wheel → scroll horizontal
- [ ] `Shift+Scroll` → scroll vertikal
- [ ] Scrollbar horizontal di bawah timeline
- [ ] `P` → scroll ke playhead (center viewport)
- [ ] Posisi frame item tidak berubah saat zoom

---

## 18. Audio System

**UX — Waveform di Item:**
1. Saat item audio/video di-drop ke timeline → waveform placeholder (garis flat) langsung muncul
2. Web Worker menganalisis audio di background via FFmpeg + NumPy
3. Waveform muncul dalam < 1 detik per menit audio (sesuai waveform hijau di screenshot)
4. Waveform responsif terhadap zoom: zoom in = lebih detail, zoom out = compressed

**UX — Volume Envelope:**
1. User hover di dalam item audio → garis volume envelope (horizontal) lebih tebal dan terang
2. User drag garis ke atas → volume naik (tooltip menampilkan %)
3. Drag ke bawah → volume turun
4. Klik di garis → titik kontrol keyframe volume dibuat

**UX — Fade In/Out Handle:**
1. User hover di pojok kiri atas item audio → segitiga fade-in muncul
2. Drag segitiga ke kanan → durasi fade-in bertambah, gradient overlay muncul di dalam clip
3. Pojok kanan atas → segitiga fade-out

**UX — Mute/Solo Track:**
1. User klik `🔊` di track controls kiri → track muted, ikon berubah ke speaker coret
2. User klik `🎧` → solo mode, track lain muted sementara

- [ ] Waveform visual warna hijau di dalam item audio (sesuai screenshot)
- [ ] Waveform generate via FFmpeg + NumPy di background (Web Worker)
- [ ] Waveform cache di IndexedDB: key `${mediaId}_${sampleRate}`
- [ ] Waveform zoom mengikuti timeline zoom (lebih detail saat zoom in)
- [ ] Volume envelope: garis horizontal, drag naik/turun
- [ ] Titik kontrol volume via klik di garis envelope
- [ ] Fade in handle di pojok kiri, fade out di pojok kanan item
- [ ] Gradient overlay visualisasi fade di dalam clip
- [ ] Mute per item via context menu
- [ ] Mute per track via ikon `🔊` di track controls
- [ ] Solo track via ikon `🎧` di track controls
- [ ] Pan control di property panel (slider -1.0 hingga 1.0)
- [ ] Audio scrubbing saat drag playhead

---

## 19. Overlay System

**UX — Drop Gambar/Video ke Area Overlay:**
1. User drag gambar dari tab Media panel kiri
2. Drop di area overlay (di atas video track) → track overlay terbuat otomatis
3. Item overlay tampil di canvas preview di atas video utama
4. Panel Properti kanan menampilkan tab Transform (posisi, scale, rotasi, opacity)

**UX — Edit Overlay via Canvas Preview:**
1. User klik item overlay di timeline (atau langsung di canvas preview)
2. Bounding box + 8 handle muncul di canvas
3. Drag tengah → pindah posisi (X, Y update di property panel)
4. Drag sudut → scale (tahan `Shift` = lock aspect ratio)
5. Drag handle atas (lingkaran) → rotate
6. Semua perubahan realtime

**UX — Blend Mode & Opacity:**
1. User pilih item overlay → panel Properti kanan, tab Transform
2. Slider Opacity: 0–100%, drag realtime
3. Dropdown Blend Mode: Normal, Multiply, Screen, Overlay, dll.

- [ ] Mendukung: image, video overlay, teks, shape, stiker, watermark, lower third
- [ ] Drop dari panel kiri ke area overlay → track overlay terbuat otomatis
- [ ] Bounding box + 8 handle di canvas preview untuk transform
- [ ] Position X/Y, Scale X/Y, Rotation, Opacity di property panel
- [ ] Blend mode dropdown di property panel
- [ ] Z-order via reorder track handle `☰` atau `Ctrl+[` / `Ctrl+]`
- [ ] `Ctrl+Shift+]` → bring to front, `Ctrl+Shift+[` → send to back

---

## 20. Thumbnail & Waveform

- [ ] Thumbnail di-generate via Web Worker (FFmpeg/OpenCV), non-blocking
- [ ] Placeholder low-res dulu, lalu high-res progressif
- [ ] Lazy thumbnail: hanya generate yang di viewport + 200px buffer
- [ ] Cache thumbnail di IndexedDB: key `${mediaId}_${frame}_${width}`
- [ ] Waveform via FFmpeg + NumPy + Web Worker
- [ ] Waveform cache di IndexedDB: key `${mediaId}_${sampleRate}`
- [ ] Waveform render via canvas (bukan SVG, untuk performa)
- [ ] Thumbnail dan waveform update saat clip di-trim
- [ ] Thumbnail strip lebih detail saat zoom maksimum (per-frame thumbnail)

---

## 21. Keyframe System

**UX — Aktifkan Animasi Property:**
1. User pilih item overlay/teks → panel Properti, tab Keyframe
2. User klik ikon ♦ di samping property (misal: Position X) → keyframe ditambahkan di frame saat ini
3. Lane keyframe muncul di bawah item di timeline (setelah expand item)

**UX — Tambah Keyframe Berikutnya:**
1. User pindah playhead ke frame lain
2. User ubah nilai property → keyframe baru otomatis dibuat
3. Atau: klik ikon ♦ lagi untuk paksa tambah keyframe

**UX — Edit Keyframe di Lane:**
1. User expand item di timeline (klik panah ▶ di tepi kiri item)
2. Lane keyframe per property muncul
3. Drag berlian keyframe kiri/kanan → ubah posisi frame
4. Klik kanan berlian → ubah easing: Linear, Ease In, Ease Out, Ease In-Out, Bezier, Hold
5. `Delete` pada keyframe terpilih → hapus keyframe

- [ ] Ikon ♦ di property panel untuk toggle keyframe di frame saat ini
- [ ] Lane keyframe per property tampil saat item di-expand di timeline
- [ ] Berlian keyframe di lane, drag untuk pindah frame
- [ ] Klik kanan keyframe → ubah easing
- [ ] Bezier handle untuk custom easing curve
- [ ] `Delete` pada keyframe → hapus
- [ ] `◄` `►` di property panel untuk navigasi antar keyframe
- [ ] `Ctrl+Click` di lane → tambah keyframe di posisi playhead

---

## 22. Transition System

**UX — Tambah Transisi dari Tab Transisi:**
1. User klik tab "Transisi" di panel kiri → library transisi muncul (sesuai screenshot)
2. User drag transisi ke batas antara dua clip di timeline
3. Transisi muncul sebagai elemen overlap (visual trapezoid) di batas dua clip
4. Durasi default transisi teraplikasi

**UX — Ubah Durasi Transisi:**
1. User hover di tepi kiri/kanan elemen transisi → kursor resize
2. User drag → perpendek atau panjangkan durasi transisi

**UX — Edit Properti Transisi:**
1. User double-click elemen transisi → panel Properti kanan menampilkan tab Transisi
2. Parameter tersedia: Durasi, Arah, Easing
3. Canvas preview menampilkan transisi realtime

- [ ] Panel Transisi di tab kiri menampilkan library transisi dengan thumbnail preview
- [ ] Drag transisi dari panel ke batas dua clip → terpasang
- [ ] Visual overlap/trapezoid dengan ikon transisi di timeline
- [ ] Drag tepi transisi → ubah durasi
- [ ] Double-click → buka properti transisi di panel kanan
- [ ] `Delete` → hapus transisi
- [ ] Jenis: Cut, Dissolve, Wipe, Push, Zoom, Dip to Black/White

---

## 23. Color Grading Integration

**UX — Color dari Tab Filter:**
1. User klik tab "Filter" di panel kiri → library filter/LUT tersedia (sesuai screenshot)
2. User drag filter ke item video di timeline → filter teraplikasi
3. Atau klik filter → preview di canvas tanpa apply permanen

**UX — Fine-tune Color di Panel Properti:**
1. User pilih item video → panel Properti, tab Color
2. Slider: Brightness, Contrast, Saturation, Temperature, Tint
3. Semua perubahan realtime di canvas preview
4. Tombol Reset per slider

**UX — Adjustment Layer:**
1. User klik kanan di area overlay kosong → "Tambah Adjustment Layer"
2. Adjustment layer terbuat, mempengaruhi semua track di bawahnya
3. User trim adjustment layer sesuai range yang diinginkan

- [ ] Tab Filter di panel kiri: library preset LUT/filter dengan thumbnail before-after
- [ ] Drag filter dari panel ke item → apply
- [ ] Property panel tab Color: Brightness, Contrast, Saturation, Temperature, Tint
- [ ] Shadows, Midtones, Highlights (lift/gamma/gain)
- [ ] Import LUT (.cube) + slider intensity (0–100%)
- [ ] RGB Curves per channel (Master, Red, Green, Blue)
- [ ] Vignette, Grain
- [ ] Adjustment Layer via klik kanan area overlay
- [ ] Reset per-property
- [ ] Semua perubahan realtime

---

## 24. Subtitle & Caption System

**UX — Auto Subtitle via Tab AI:**
1. User klik tab "AI" di panel kiri (sesuai screenshot)
2. User klik fitur "Auto Subtitle" → proses dimulai
3. Progress bar muncul di panel kiri dan di timeline
4. AI (Whisper) memproses audio → subtitle item muncul di subtitle track satu per satu
5. Setelah selesai, semua subtitle dapat diedit manual

**UX — Edit Subtitle:**
1. User double-click item subtitle → teks editable inline
2. `Enter` konfirmasi, `Escape` batal

**UX — Import/Export Subtitle:**
1. Menu File → Import Subtitles → file picker (.SRT, .VTT, .ASS)
2. Menu File → Export Subtitles → pilih format

- [ ] Subtitle track khusus di bawah area overlay
- [ ] Item subtitle tinggi 24px, warna berbeda dari item video/audio
- [ ] Double-click → edit teks inline
- [ ] `Ctrl+K` → split subtitle di playhead
- [ ] Import: .SRT, .VTT, .ASS
- [ ] Export: .SRT, .VTT
- [ ] Auto-generate via tab AI → Whisper/faster-whisper
- [ ] Progress indicator selama AI processing
- [ ] Style: font, ukuran, warna, background, posisi, outline, shadow
- [ ] Preset style yang bisa disimpan

---

## 25. Motion Graphics Layer

**UX — Teks dari Tab Teks:**
1. User klik tab "Teks" di panel kiri → template teks tersedia (sesuai screenshot)
2. User drag template ke timeline overlay track
3. Item teks muncul di canvas dengan teks default
4. User double-click di canvas → edit teks langsung

**UX — Stiker dari Tab Stiker:**
1. User klik tab "Stiker" → library stiker/emoji tersedia (sesuai screenshot)
2. User drag stiker ke timeline → item stiker muncul di overlay track
3. Bounding box muncul di canvas untuk transform

**UX — Import Lottie:**
1. User drag file .JSON (Lottie) dari tab Media ke overlay track
2. Item Lottie muncul dengan animasi berjalan di canvas preview
3. Property panel: Loop Mode (Play Once / Loop / Ping-Pong)

- [ ] Tab Teks di panel kiri: template preset teks dengan preview
- [ ] Tab Stiker di panel kiri: library stiker, emoji, shape dekoratif
- [ ] Drag dari panel ke timeline → item overlay terbuat
- [ ] Import .JSON Lottie → item animasi di overlay track
- [ ] Loop Mode: Play Once, Loop, Ping-Pong
- [ ] Shape tool (dari toolbar): rectangle, ellipse, polygon, freehand
- [ ] Text animation preset: Typewriter, Fade, Bounce
- [ ] Semua property dapat di-keyframe

---

## 26. Marker & Chapter System

**UX — Tambah Marker:**
1. User posisikan playhead → tekan `M` → marker kuning muncul di ruler
2. Atau klik kanan ruler → "Tambah Marker"

**UX — Marker dengan Nama:**
1. User tekan `Ctrl+M` → dialog: input nama + pilih warna (8 pilihan)
2. Marker dengan nama muncul, label singkat tampil di ruler

- [ ] `M` → tambah marker di playhead
- [ ] `Ctrl+M` → tambah marker dengan dialog nama + warna
- [ ] Double-click marker → edit nama, warna, komentar
- [ ] Drag marker di ruler → pindah posisi
- [ ] Klik kanan marker → Delete
- [ ] `Shift+↓` / `Shift+↑` → navigasi antar marker
- [ ] Marker dapat memiliki durasi (range marker)
- [ ] Chapter Marker: tipe khusus untuk YouTube chapters
- [ ] Export marker list sebagai CSV

---

## 27. Undo / Redo System

**UX — Undo/Redo:**
1. User tekan `Ctrl+Z` atau klik `↩` di toolbar → aksi terakhir di-undo
2. Tooltip singkat muncul: "Undo: Pindah Clip"
3. `Ctrl+Shift+Z` atau klik `↪` di toolbar → redo

**UX — History Panel:**
1. Menu View → History → panel history muncul
2. List aksi dari terbaru ke terlama ditampilkan
3. Klik aksi di tengah list → timeline kembali ke state saat itu

- [ ] `Ctrl+Z` → undo, `Ctrl+Shift+Z` → redo
- [ ] Tombol `↩` (undo) dan `↪` (redo) di toolbar timeline (sesuai screenshot)
- [ ] History stack minimal 100 langkah
- [ ] Nama aksi deskriptif: "Pindah Clip", "Trim Awal", "Hapus 3 Clip"
- [ ] Setiap gesture selesai = 1 undo step (bukan per pixel)
- [ ] Multi-item delete = 1 undo step
- [ ] History panel: list aksi, klik untuk undo ke titik tersebut
- [ ] Semua aksi AI juga masuk undo history

---

## 28. Clipboard & Paste System

- [ ] `Ctrl+C` → copy, `Ctrl+X` → cut, `Ctrl+V` → paste di posisi playhead
- [ ] `Ctrl+Shift+V` → paste in place (frame yang sama dengan sumber)
- [ ] `Ctrl+Alt+V` → paste attributes (dialog checklist: Speed, Volume, Effects, Color, Keyframes)
- [ ] `Ctrl+D` → duplicate, letakkan setelah item asli
- [ ] `Alt+Drag` → duplicate saat drag (item asli tetap di tempat)

---

## 29. Split, Ripple & Gap System

**UX — Split di Playhead:**
1. User posisikan playhead → tekan `Ctrl+K` atau klik tombol `✂` di toolbar
2. Jika ada item terpilih → hanya item itu yang dipotong
3. Jika tidak ada seleksi → semua item yang dilewati playhead dipotong
4. Linked clip (audio+video) dipotong bersamaan

**UX — Ripple Delete:**
1. User pilih item → tekan `Shift+Delete`
2. Item terhapus, semua item di kanan otomatis bergeser ke kiri untuk tutup gap

**UX — Gap di Main Track:**
1. Gap tampil sebagai kotak abu-abu berlabel "Gap" di main track
2. Klik gap → terpilih, `Delete` → gap hilang + ripple
3. Klik kanan gap → "Tutup Gap"

- [ ] `Ctrl+K` → split di playhead, atau klik tombol `✂` di toolbar
- [ ] Metadata, efek, keyframe terjaga di kedua bagian setelah split
- [ ] Linked clips split bersamaan
- [ ] `Shift+Delete` → ripple delete
- [ ] Gap tampil sebagai kotak abu-abu berlabel "Gap" di main track
- [ ] Klik gap → terpilih, `Delete` → hapus gap + ripple
- [ ] Klik kanan gap → "Tutup Gap"
- [ ] Insert gap manual dari menu Edit

---

## 30. Speed & Time Remapping

**UX — Ubah Speed Item:**
1. User pilih item → panel Properti, field "Speed" (default 100%)
2. User ketik nilai baru atau pilih dari dropdown: 0.25x, 0.5x, 1x, 1.5x, 2x, 4x
3. Durasi item di timeline berubah otomatis
4. Badge speed muncul di item

**UX — Speed via Context Menu:**
1. Klik kanan item → "Speed / Durasi"
2. Dialog: Speed (%), Durasi, toggle Pitch Correction
3. Ubah satu → yang lain otomatis terkalkulasi

**UX — Time Remapping:**
1. Klik kanan item → "Aktifkan Time Remapping"
2. Lane speed graph muncul di bawah item di timeline
3. Klik di lane → titik kontrol, drag ke atas/bawah untuk ubah speed di titik tersebut
4. Freeze Frame: set speed 0% di titik kontrol

- [ ] Field Speed di property panel
- [ ] Dropdown preset speed
- [ ] Dialog Speed/Durasi via context menu + pitch correction toggle
- [ ] Badge speed di item jika ≠ 1x
- [ ] Time Remapping: klik kanan → aktifkan, lane speed graph muncul
- [ ] Titik kontrol di graph, drag untuk ubah speed
- [ ] Freeze frame: set speed 0%
- [ ] Reverse: klik kanan → "Putar Balik"

---

## 31. Nested Sequence / Compound Clip

- [ ] `Ctrl+G` → buat compound clip dari item terpilih
- [ ] Dialog nama compound clip
- [ ] Compound clip: ikon dan warna khusus di timeline
- [ ] Double-click → masuk ke nested timeline
- [ ] Breadcrumb di atas ruler: "Proyek > [Nama Compound Clip]"
- [ ] Klik breadcrumb → kembali ke level atas
- [ ] Perubahan di nested langsung tampil di parent

---

## 32. Linked Clip (Audio + Video)

**UX — Linked Clip Bergerak Bersama:**
1. User drag item video → item audio ter-link otomatis ikut bergerak
2. Ikon rantai tampil di keduanya

**UX — Pilih Hanya Audio atau Video:**
1. `Alt+Click` item video → hanya video terpilih

**UX — Peringatan Sync:**
1. Jika audio/video tidak sinkron → badge merah "Sync Off" muncul
2. Klik badge → "Pindah ke posisi sinkron" → otomatis di-resync

- [ ] Video + audio dari satu file otomatis ter-link saat drop ke timeline
- [ ] Linked clip bergerak bersama saat drag
- [ ] Trim salah satu → yang lain ikut trim
- [ ] Ikon rantai di kedua item yang ter-link
- [ ] `Alt+Click` → pilih hanya audio atau video saja
- [ ] `Ctrl+L` → toggle link/unlink
- [ ] Badge "Sync Off" jika sinkronisasi hilang, klik untuk fix

---

## 33. Render & Export Integration

**UX — Klik Tombol Ekspor:**
1. User klik tombol **Ekspor** (biru) di header kanan atas (sesuai screenshot)
2. Dialog export muncul: Format, Resolusi, Bitrate, Frame Rate, Path Output
3. User tentukan in/out range atau pilih "Seluruh Timeline"
4. Klik "Mulai Ekspor" → job ditambahkan ke render queue

**UX — Background Render:**
1. Job diproses di background, user dapat terus mengedit
2. Progress bar tampil di panel render queue atau notifikasi kecil di header
3. Saat selesai → notifikasi popup, file tersedia di path output

**UX — Tombol Bagikan:**
1. User klik tombol **Bagikan** di header (sesuai screenshot)
2. Opsi muncul: share ke platform (YouTube, Instagram, dll.) atau salin link
3. Jika belum di-render → prompt untuk export dulu

- [ ] Tombol "Ekspor" (biru, primary) di header kanan (sesuai screenshot)
- [ ] Tombol "Bagikan" di header kanan (sesuai screenshot)
- [ ] Dialog export: format, resolusi, bitrate, fps, path output
- [ ] `I` → set in-point, `O` → set out-point untuk range export
- [ ] `Alt+I` / `Alt+O` → hapus in/out point
- [ ] Highlight biru antara in/out di ruler
- [ ] Panel render queue dengan progress bar per job
- [ ] Background rendering (tidak mengganggu editing)
- [ ] Notifikasi saat render selesai
- [ ] Smart render: warna merah/kuning/hijau di ruler sesuai status render segment

---

## 34. Performa & Rendering Engine

### Virtualized Rendering
- [ ] Hanya render item dalam viewport horizontal + 200px buffer
- [ ] Hanya render track dalam viewport vertikal
- [ ] Re-render hanya komponen yang berubah
- [ ] `React.memo`, `useMemo`, `useCallback` untuk cegah re-render berlebihan

### Canvas Rendering
- [ ] Thumbnail strip via canvas (bukan `<img>` individual)
- [ ] Waveform via canvas
- [ ] Playhead, marquee, snap line via overlay canvas layer
- [ ] `devicePixelRatio` untuk layar retina/HiDPI

### Web Workers & Background Processing
- [ ] Thumbnail generation → Web Worker (FFmpeg/OpenCV)
- [ ] Waveform generation → Web Worker (FFmpeg + NumPy)
- [ ] Snapping calculation → Web Worker untuk 100+ item
- [ ] AI subtitle generation → Web Worker (Whisper/faster-whisper)

### Target Performa
- [ ] 60fps drag dan scroll dengan 200+ item
- [ ] Respons klik < 16ms
- [ ] Thumbnail siap < 2 detik per clip
- [ ] Waveform siap < 1 detik per menit audio
- [ ] Undo/redo < 50ms

### Caching Strategy
- [ ] Thumbnail cache: IndexedDB, key `${mediaId}_${frame}_${width}`
- [ ] Waveform cache: IndexedDB, key `${mediaId}_${sampleRate}`
- [ ] Cache limit 500MB, LRU eviction
- [ ] Cache invalidation otomatis saat media diganti

---

## 35. Keyboard Shortcut System

### Shortcut Default

| Aksi | Shortcut |
|------|----------|
| Play / Pause | `Space` |
| Stop | `.` |
| Play Mundur | `Shift+Space` |
| Previous Frame | `←` |
| Next Frame | `→` |
| Jump 10 Frame | `Shift+←` / `Shift+→` |
| Jump to Start | `Home` |
| Jump to End | `End` |
| Previous Edit Point | `↑` |
| Next Edit Point | `↓` |
| Previous Marker | `Shift+↑` |
| Next Marker | `Shift+↓` |
| Split di Playhead | `Ctrl+K` |
| Hapus | `Delete` / `Backspace` |
| Ripple Delete | `Shift+Delete` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` |
| Copy | `Ctrl+C` |
| Cut | `Ctrl+X` |
| Paste | `Ctrl+V` |
| Paste in Place | `Ctrl+Shift+V` |
| Paste Attributes | `Ctrl+Alt+V` |
| Select All | `Ctrl+A` |
| Deselect All | `Ctrl+Shift+A` |
| Duplikat | `Ctrl+D` |
| Group (Compound) | `Ctrl+G` |
| Toggle Snap | `S` |
| Tambah Marker | `M` (tanpa seleksi) |
| Tambah Marker + Nama | `Ctrl+M` |
| Set In Point | `I` |
| Set Out Point | `O` |
| Clear In Point | `Alt+I` |
| Clear Out Point | `Alt+O` |
| Zoom In | `=` |
| Zoom Out | `-` |
| Fit Timeline | `\` |
| Go to Playhead | `P` |
| Link/Unlink | `Ctrl+L` |
| Bring Forward | `Ctrl+]` |
| Send Backward | `Ctrl+[` |
| Bring to Front | `Ctrl+Shift+]` |
| Send to Back | `Ctrl+Shift+[` |
| Trim Kiri 1 frame | `Alt+[` |
| Trim Kanan 1 frame | `Alt+]` |
| Set In-point Item | `[` |
| Set Out-point Item | `]` |

### Shortcut Customizable
- [ ] Semua shortcut dapat diubah di Settings → Keyboard Shortcuts
- [ ] Deteksi konflik dengan peringatan merah
- [ ] Import/export preset shortcut (JSON)
- [ ] Preset bawaan: Default, Premiere Pro, Final Cut, DaVinci compatible
- [ ] Reset per shortcut atau semua sekaligus

---

## 36. Context Menu System

### Context Menu Item (Klik Kanan di Item Timeline)
- [ ] Cut, Copy, Paste
- [ ] Duplikat
- [ ] Hapus / Ripple Delete
- [ ] Split di Playhead
- [ ] Speed / Durasi (buka dialog)
- [ ] Aktifkan Time Remapping
- [ ] Link / Unlink Audio
- [ ] Buat Compound Clip (Nest)
- [ ] Aktifkan / Nonaktifkan Item
- [ ] Kunci / Buka Kunci
- [ ] Mute / Unmute
- [ ] Label (submenu 8 warna)
- [ ] Ganti Media (ganti source tanpa ubah posisi/durasi)
- [ ] Tampilkan di Media Library
- [ ] Properti (buka inspector di panel kanan)

### Context Menu Track (Klik Kanan di Area Track atau Nama Track)
- [ ] Ubah Nama Track (→ inline edit)
- [ ] Duplikat Track
- [ ] Hapus Track (konfirmasi jika ada item di dalamnya)
- [ ] Mute / Solo Track
- [ ] Kunci / Buka Kunci Track
- [ ] Ubah Tinggi Track: Kecil (32px) / Sedang (48px) / Besar (80px)
- [ ] Tambah Adjustment Layer

### Context Menu Ruler (Klik Kanan di Ruler)
- [ ] Tambah Marker
- [ ] Tambah Chapter Marker
- [ ] Set In Point di posisi ini
- [ ] Set Out Point di posisi ini
- [ ] Hapus In/Out Point
- [ ] Input Timecode (popup input field)

### Context Menu Gap (Klik Kanan di Gap)
- [ ] Tutup Gap (ripple delete gap)
- [ ] Pilih Gap

---

## 37. Accessibility

- [ ] Semua elemen interaktif dapat diakses via keyboard (`Tab` navigasi)
- [ ] Fokus ring terlihat jelas di semua elemen
- [ ] ARIA labels pada semua kontrol (tombol transport, toolbar, track controls)
- [ ] Screen reader: nama item dan posisi diumumkan ("Video clip, 3 detik, di 00:00:00:00, track 1")
- [ ] High contrast mode support (semua warna via CSS variables)
- [ ] Tap target minimum 44×44px (WCAG 2.5.5) — penting untuk mobile/touch
- [ ] `prefers-reduced-motion` → animasi dinonaktifkan
- [ ] Warna bukan satu-satunya indikator (selalu ada label/bentuk juga)

---

## 38. AI Editing Readiness

**UX — Fitur AI dari Tab AI (Sesuai Screenshot):**
1. User klik tab "AI" di panel kiri
2. Fitur tersedia: Auto Cut, Auto Subtitle, B-Roll Suggestion, Music Sync, Scene Detection
3. User pilih fitur → proses di background, progress indicator tampil
4. Hasil dapat diedit manual, aksi masuk ke undo history

### Internal API untuk AI
- [ ] `timeline.insertClip(mediaId, trackId, frame)` — public API
- [ ] `timeline.moveClip(clipId, targetTrackId, targetFrame)` — public API
- [ ] `timeline.trimClip(clipId, newInFrame, newOutFrame)` — public API
- [ ] `timeline.addMarker(frame, label, color)` — public API
- [ ] `timeline.applyEffect(clipId, effectId, params)` — public API
- [ ] `timeline.generateSubtitles(clipId)` — trigger Whisper/faster-whisper
- [ ] Semua aksi AI masuk ke undo history dengan label "AI: [nama aksi]"
- [ ] Event subscription untuk AI observer
- [ ] Auto Cut: progress indicator + preview marker sebelum apply
- [ ] Auto Subtitle: subtitle item muncul satu per satu selama processing
- [ ] Smart B-roll suggestion dari analisis konten
- [ ] Auto music sync ke beat
- [ ] Scene Detection via PySceneDetect / OpenCV

---

## 39. Testing & QA Checklist

### Functional Testing
- [ ] Drop media dari panel kiri ke timeline: item terbuat di posisi yang benar
- [ ] Badge "Ditambahkan" muncul di panel kiri setelah item di-drop
- [ ] Panel Properti kanan: mode media-info saat thumbnail diklik, mode clip-edit saat item timeline diklik
- [ ] Drag item antar track: posisi frame akurat
- [ ] Trim kiri dan kanan: in/out point correct, tidak ada frame offset
- [ ] Snap ke item: tidak ada floating point error, snap tepat ke frame
- [ ] Split: metadata terjaga di kedua bagian
- [ ] Undo 10 langkah berturut-turut: state kembali benar
- [ ] Multi-select drag 20 item: offset relatif dipertahankan
- [ ] Marquee: item yang tersentuh batas kotak ikut terseleksi
- [ ] Playback: playhead dan audio sinkron hingga 30 menit
- [ ] Zoom in/out: posisi item di frame tidak berubah
- [ ] Auto-track: track kosong dibuat dan dihapus dengan benar
- [ ] Ripple delete: tidak ada gap tersisa, semua item bergeser tepat
- [ ] Compound clip: edit nested timeline terlihat di parent
- [ ] Subtitle import .SRT: timecode dan teks sesuai file
- [ ] Keyframe: animasi interpolasi akurat di canvas
- [ ] Sinkronisasi playhead ↔ progress bar canvas: selalu sinkron
- [ ] Timecode header: shorthand input `1030` → `00:00:10:30` benar
- [ ] Tombol Ekspor dan Bagikan di header berfungsi

### Performance Testing
- [ ] 200 item di timeline: scroll 60fps stabil
- [ ] 50 track: render list tidak lag
- [ ] Thumbnail 10 video × 10 menit: tidak freeze UI
- [ ] Undo 100 langkah: memory tidak meledak
- [ ] Zoom maksimum: tidak ada render artifact
- [ ] Web Worker crash handling: tidak crash main thread

### Edge Cases
- [ ] Item durasi 1 frame: trim, split, select semua bekerja
- [ ] Item di frame 0: tidak bisa di-trim ke negatif
- [ ] Item di frame terakhir: tidak bisa di-drag keluar batas kanan
- [ ] Audio tanpa video: hanya audio track yang dibuat
- [ ] Video tanpa audio: tidak dibuat audio track kosong
- [ ] Media offline saat buka project: peringatan + placeholder, tidak crash
- [ ] Drop media ke area yang sudah penuh: insert mode bekerja
- [ ] 100 keyframe di satu item: performa interpolasi tetap smooth

---

## 40. Hasil Akhir & Definition of Done

Revisi dianggap **SELESAI** jika semua poin berikut terpenuhi:

### Layout & UI (Sesuai Screenshot)
- [ ] Header: Logo | Menu | Timecode (tengah) | Bagikan | Ekspor
- [ ] Panel kiri: 8 tab (Media, Audio, Teks, Stiker, AI, Efek, Filter, Transisi) + grid thumbnail + badge "Ditambahkan"
- [ ] Preview canvas: frame video | progress bar | transport controls | timecode bawah
- [ ] Panel Properti kanan: mode media-info (field read-only) dan mode clip-edit (field editable)
- [ ] Toolbar timeline: tool buttons kiri + zoom slider kanan
- [ ] Ruler + Playhead line merah
- [ ] Track controls kiri (☰, 📷, 🔊, 🎧) + area item kanan
- [ ] Scrollbar horizontal di bawah timeline

### Core System
- [ ] Auto Track System berfungsi penuh (create, buffer, remove otomatis)
- [ ] Overlay Area dengan semua tipe overlay
- [ ] Main Track (video) permanen
- [ ] Audio Area dengan waveform hijau dan volume envelope
- [ ] Linked clip (video + audio) terbuat otomatis saat drop video

### Interaction
- [ ] Drag & Drop 60fps dengan shadow, lift, dan ghost placeholder
- [ ] Trim dasar + Ripple Trim, Roll Trim, Slip, Slide
- [ ] Split akurat di frame playhead, linked clip split bersamaan
- [ ] Marquee Selection semi-transparan realtime
- [ ] Multi Selection: Ctrl+Click, Shift+Click, Select All

### Precision
- [ ] Snapping akurat ke frame (zero floating-point error)
- [ ] Snap ke item, playhead, marker dengan garis snap kuning
- [ ] Zoom tidak mengubah posisi relatif item

### Playback
- [ ] Playback sinkron antara video, audio, dan playhead
- [ ] Auto-scroll saat playback
- [ ] Audio scrubbing saat scrub playhead
- [ ] Sinkronisasi playhead ↔ progress bar canvas selalu akurat

### Advanced
- [ ] Keyframe System lengkap
- [ ] Time Remapping dengan speed graph
- [ ] Subtitle Track dengan import/export SRT/VTT
- [ ] Compound Clip dengan nested timeline
- [ ] Transition System via drag dari tab Transisi ke batas clip
- [ ] Undo/Redo 100 langkah dengan tombol ↩↪ di toolbar
- [ ] Context Menu lengkap (item, track, ruler, gap)
- [ ] Keyboard shortcut customizable

### Performance
- [ ] Virtualized rendering
- [ ] Thumbnail + waveform cache di IndexedDB
- [ ] Web Worker untuk generate thumbnail dan waveform
- [ ] 60fps dengan 200+ item
- [ ] AI API hooks terdokumentasi dan berfungsi

---

*Checklist ini merupakan living document — update seiring progress implementasi.*
*Version: 4.0 | Last Updated: Juni 2026 | Disesuaikan dengan UI VidemePro+*
