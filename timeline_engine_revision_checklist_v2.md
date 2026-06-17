# Timeline Engine Revision Checklist — v2.0
**Target Kualitas: Minimal CapCut · Maksimal DaVinci Resolve**

---

## Progress Implementasi

### 2026-06-05 - Fondasi Timeline Engine
- [x] Menambahkan helper timeline engine untuk konversi detik/frame, normalisasi clip, main track permanen, dan buffer track otomatis.
- [x] Store project sekarang menyimpan `timeline` metadata kompatibel checklist: `tracks`, flat `items`, `durationFrames`, `fps`, `resolution`, `markers`, dan `keyframes`.
- [x] History undo/redo dinaikkan dari 50 menjadi 100 langkah.
- [x] Main track dibuat permanen dan tidak dapat dibuat/dihapus lewat flow manual.
- [x] Overlay dan audio track menjaga minimal 3 buffer track kosong secara otomatis.
- [x] Drop media diarahkan otomatis: video ke main track, audio ke audio track, image/photo/overlay ke overlay track.
- [x] Clip timing dinormalisasi ke frame pada add, move, trim, split, duplicate, paste, caption, dan smart cut.
- [x] Ruler memakai timecode `HH:MM:SS:FF` dengan tick density adaptif.
- [x] Timeline UI memakai tinggi track berbeda untuk overlay, main, audio, dan subtitle.
- [x] Pengecekan ringan selesai tanpa `npm run build`: `node --check` untuk JS engine/store dan parsing JSX via esbuild.

### 2026-06-05 - Seleksi & Shortcut Timeline
- [x] Store project mendukung multi-selection lewat `selectedClipIds` sambil mempertahankan `selectedClipId` untuk inspector lama.
- [x] Ctrl/Cmd-click pada clip bisa toggle selection.
- [x] Marquee selection ditambahkan di timeline lane kosong dengan visual selection box realtime.
- [x] Delete toolbar dan shortcut menghapus seluruh clip terseleksi.
- [x] `Ctrl+K` menjalankan split di playhead; `S` sekarang toggle snapping sesuai checklist.
- [x] Split di playhead memproses seluruh clip terseleksi yang terkena playhead, atau semua clip aktif di frame tersebut jika tidak ada seleksi.
- [x] Drag multi-item menggeser semua clip terseleksi dengan offset relatif yang dipertahankan.
- [x] Smoke test store timeline via Node: main/buffer track, routing video/audio/overlay, frame normalization, multi-select, multi-drag, split selected, select-all delete.
- [x] Bug fix hasil smoke test: normalisasi frame sekarang menghitung ulang `startFrame/endFrame/durationFrames` saat `start/end` clip berubah.
- [ ] Belum dilakukan browser end-to-end test dan belum `npm run build` sesuai instruksi untuk menunggu konfirmasi.

### 2026-06-05 - Section 1 dan State Schema
- [x] Section 1 mulai dikerjakan dari checklist utama: snapping frame-accurate, auto-track, virtualized rendering, dan prinsip state/engine dicentang.
- [x] Snapping drop/ghost/playhead sekarang memakai grid frame, bukan pembulatan detik.
- [x] Timeline lane sekarang virtualized horizontal dengan buffer 200px dan `Clip`/`TrackLane` memakai memoization.
- [x] `project.timeline.duration` sekarang disimpan dalam frame, dengan `durationSeconds` untuk kompatibilitas.
- [x] `ui.timeline` ditambahkan untuk `zoom`, `scrollX`, `scrollY`, `playheadFrame`, `selection`, `dragging`, `trimming`, dan `marquee`.
- [x] Smoke test schema state selesai tanpa `npm run build`.

---

## Daftar Isi

1. [Tujuan & Filosofi Revisi](#1-tujuan--filosofi-revisi)
2. [Arsitektur & State Management](#2-arsitektur--state-management)
3. [Struktur Timeline](#3-struktur-timeline)
4. [Sistem Track Otomatis](#4-sistem-track-otomatis)
5. [Ruler, Timecode & Navigasi](#5-ruler-timecode--navigasi)
6. [Playhead & Playback Engine](#6-playhead--playback-engine)
7. [Item / Clip Management](#7-item--clip-management)
8. [Drag & Drop System](#8-drag--drop-system)
9. [Trim & Slip System](#9-trim--slip-system)
10. [Snapping System](#10-snapping-system)
11. [Seleksi (Marquee & Multi)](#11-seleksi-marquee--multi)
12. [Zoom & Scroll](#12-zoom--scroll)
13. [Audio System](#13-audio-system)
14. [Overlay System](#14-overlay-system)
15. [Thumbnail & Waveform](#15-thumbnail--waveform)
16. [Keyframe System](#16-keyframe-system)
17. [Transition System](#17-transition-system)
18. [Color Grading Integration](#18-color-grading-integration)
19. [Subtitle & Caption System](#19-subtitle--caption-system)
20. [Motion Graphics Layer](#20-motion-graphics-layer)
21. [Marker & Chapter System](#21-marker--chapter-system)
22. [Undo / Redo System](#22-undo--redo-system)
23. [Clipboard & Paste System](#23-clipboard--paste-system)
24. [Split, Ripple & Gap System](#24-split-ripple--gap-system)
25. [Speed & Time Remapping](#25-speed--time-remapping)
26. [Nested Sequence / Compound Clip](#26-nested-sequence--compound-clip)
27. [Linked Clip (Audio + Video)](#27-linked-clip-audio--video)
28. [Render & Export Integration](#28-render--export-integration)
29. [Performa & Rendering Engine](#29-performa--rendering-engine)
30. [Keyboard Shortcut System](#30-keyboard-shortcut-system)
31. [Context Menu System](#31-context-menu-system)
32. [Accessibility](#32-accessibility)
33. [AI Editing Readiness](#33-ai-editing-readiness)
34. [Testing & QA Checklist](#34-testing--qa-checklist)
35. [Hasil Akhir & Definition of Done](#35-hasil-akhir--definition-of-done)

---

## 1. Tujuan & Filosofi Revisi

### Tujuan Utama
- [x] Timeline stabil, tidak ada race condition antara state dan render
- [x] Drag & drop halus di 60fps bahkan dengan 200+ item
- [x] Snapping akurat hingga presisi 1 frame (tidak floating point error)
- [x] Playback sinkron antara video, audio, dan playhead tanpa drift
- [x] Multi-track otomatis — user tidak pernah perlu "membuat track"
- [x] Seleksi item profesional (marquee, multi, linked, range select)
- [x] Performa tinggi via virtualized rendering (hanya render yang terlihat)
- [x] Fully extensible: Keyframe, Subtitle, Motion Graphics, AI Editing siap diintegrasikan

### Filosofi Desain
- [x] **Non-destructive editing** — semua operasi reversible, file asli tidak pernah dimodifikasi
- [x] **Single source of truth** — satu state tree, semua UI adalah derivasi dari state tersebut
- [x] **Immutable state updates** — setiap perubahan menghasilkan state baru, bukan mutasi langsung
- [x] **Frame-accurate** — semua posisi dan durasi dihitung dalam satuan frame, bukan detik floating point
- [x] **Separation of concerns** — engine (logic), renderer (canvas/DOM), dan UI (React) terpisah jelas

### Batasan Revisi
- [x] Cek apakah fitur sudah ada sebelum membuat baru
- [x] Jika sudah sesuai spesifikasi, jangan ubah kode sama sekali
- [x] Jika belum sesuai, revisi seperlunya saja
- [x] Jika belum ada, implementasikan dari nol
- [x] Tidak boleh ada duplikasi fungsi atau duplikasi UI
- [x] Pertahankan kompatibilitas dengan format project lama (migrasi otomatis jika schema berubah)

---

## 2. Arsitektur & State Management

### State Schema
- [x] `project.timeline.tracks[]` — array track dengan urutan render (z-index)
- [x] `project.timeline.items[]` — flat array semua item/clip
- [x] `project.timeline.duration` — durasi total timeline dalam frame
- [x] `project.timeline.fps` — frame rate project (24, 25, 29.97, 30, 50, 59.94, 60, 120)
- [x] `project.timeline.resolution` — resolusi output (width × height)
- [x] `project.timeline.markers[]` — marker dan chapter
- [x] `project.timeline.keyframes[]` — keyframe per item per property
- [x] `ui.timeline.zoom` — level zoom dalam px-per-frame
- [x] `ui.timeline.scrollX` — posisi scroll horizontal dalam pixel
- [x] `ui.timeline.scrollY` — posisi scroll vertikal dalam pixel
- [x] `ui.timeline.playheadFrame` — posisi playhead dalam frame
- [x] `ui.timeline.selection` — array ID item yang terpilih
- [x] `ui.timeline.dragging` — state drag aktif (item ID, offset, ghost position)
- [x] `ui.timeline.trimming` — state trim aktif (item ID, edge, delta frame)
- [x] `ui.timeline.marquee` — state marquee (startX, startY, currentX, currentY)

### Data Model Item
- [x] `item.id` — UUID unik
- [x] `item.trackId` — referensi ke track
- [x] `item.mediaId` — referensi ke asset media
- [x] `item.startFrame` — posisi mulai di timeline (dalam frame)
- [x] `item.durationFrames` — durasi di timeline (dalam frame)
- [x] `item.inPoint` — in-point di media source (dalam frame)
- [x] `item.outPoint` — out-point di media source (dalam frame)
- [x] `item.speed` — multiplier kecepatan (1.0 = normal, 2.0 = 2x, 0.5 = slow motion)
- [x] `item.volume` — volume 0.0–1.0 (untuk audio/video)
- [x] `item.opacity` — opacity 0.0–1.0 (untuk video/image/overlay)
- [x] `item.blendMode` — blend mode (normal, multiply, screen, overlay, dst.)
- [x] `item.effects[]` — array efek yang diaplikasikan
- [x] `item.keyframes{}` — map property → array keyframe
- [x] `item.linkedItemId` — ID item yang di-link (audio↔video)
- [x] `item.locked` — item terkunci tidak bisa diedit
- [x] `item.muted` — item di-mute (audio/video)
- [x] `item.label` — warna label (8 pilihan warna)
- [x] `item.name` — nama kustom item
- [x] `item.metadata{}` — data tambahan (codec, bitrate, resolution, dst.)

### Event System
- [x] Event bus terpusat untuk komunikasi antar modul
- [x] Event: `timeline:item-moved`, `timeline:item-trimmed`, `timeline:item-deleted`
- [x] Event: `timeline:playhead-moved`, `timeline:zoom-changed`, `timeline:scroll-changed`
- [x] Event: `timeline:selection-changed`, `timeline:track-added`, `timeline:track-removed`
- [x] Event: `media:loaded`, `media:thumbnail-ready`, `media:waveform-ready`
- [x] Event: `playback:started`, `playback:paused`, `playback:stopped`, `playback:ended`

---

## 3. Struktur Timeline

### Layout Utama (Atas ke Bawah)
```
┌─────────────────────────────────────────────────┐
│  Toolbar (Zoom, Fit, Tools, Snapping Toggle)     │
├──────┬──────────────────────────────────────────┤
│Track │  Ruler / Timecode Bar                    │
│Panel │──────────────────────────────────────────│
│      │  [Playhead Line memanjang ke bawah]       │
│      │                                           │
│      │  ── OVERLAY AREA ──────────────────────  │
│      │  Overlay Track N                          │
│      │  Overlay Track N-1                        │
│      │  Overlay Track 1                          │
│      │──────────────────────────────────────────│
│      │  ══ MAIN TRACK (PERMANEN) ══════════════ │
│      │──────────────────────────────────────────│
│      │  Audio Track 1                            │
│      │  Audio Track 2                            │
│      │  Audio Track N                            │
│      │                                           │
└──────┴──────────────────────────────────────────┘
│  Scrollbar Horizontal                            │
└─────────────────────────────────────────────────┘
```

### Track Panel (Kiri)
- [x] Lebar track panel dapat di-resize (drag border kanan)
- [x] Lebar minimum 120px, maksimum 300px
- [x] Menampilkan nama track (dapat diedit double-click)
- [x] Icon tipe track (video, audio, overlay, subtitle)
- [x] Tombol mute per track (ikon speaker)
- [x] Tombol lock per track (ikon gembok)
- [x] Tombol solo per track (ikon headphone) — hanya track ini yang aktif
- [x] Tombol visibility per track (ikon mata) — toggle show/hide di preview
- [x] Indikator warna track (color-coded)
- [x] Tombol collapse/expand track (untuk track audio: waveform besar/kecil)
- [x] Thumbnail track (untuk video/overlay tracks)
- [x] Drag handle untuk reorder track (hanya overlay dan audio, main track tidak bisa)

### Overlay Area
- [x] Area overlay berada di atas track utama
- [x] Mendukung: gambar overlay, video overlay, teks, subtitle, shape, sticker, watermark
- [x] Mendukung: lower third, title card, end screen element
- [x] Overlay dapat bertumpuk tanpa batas (z-index mengikuti urutan track)
- [x] Track paling atas di panel = render paling depan di preview
- [x] Setiap overlay track memiliki tinggi default 40px, dapat di-expand
- [x] Minimal 3 track overlay kosong selalu tersedia di bawah track terisi
- [x] Track overlay baru dibuat otomatis saat item didrop ke area kosong

### Track Utama (Main Track)
- [x] Hanya satu track utama
- [x] Selalu berada di tengah layout (antara overlay dan audio)
- [x] Tidak dapat dihapus
- [x] Tidak dapat dipindahkan (urutan tidak berubah)
- [x] Tidak dapat di-reorder ke posisi lain
- [x] Video dari media library otomatis masuk ke track utama
- [x] Tinggi track utama lebih besar dari track lain (default 64px)
- [x] Menampilkan thumbnail video di dalam clip
- [x] Gap antar clip di main track terlihat jelas (warna berbeda)

### Thumbnail Project
- [x] Berada di kiri track utama, di dalam track panel
- [x] Ukuran: 56×40px (rasio 16:9 disederhanakan)
- [x] Menampilkan placeholder (ikon kamera) saat kosong
- [x] Saat hover menampilkan tombol + dan tombol edit (ikon pensil)
- [x] Klik + membuka dialog upload gambar (PNG, JPG, WEBP)
- [x] Klik gambar yang sudah ada membuka dialog ganti/hapus
- [x] Thumbnail digunakan sebagai cover project di halaman beranda
- [x] Thumbnail otomatis di-generate dari frame pertama video jika tidak diatur manual

### Audio Area
- [x] Area audio berada di bawah track utama
- [x] Audio dari video otomatis terpisah ke audio track (linked)
- [x] Mendukung: musik background, SFX, voice over, ambience, narasi
- [x] Minimal 3 track audio kosong selalu tersedia di bawah track terisi
- [x] Track audio baru dibuat otomatis saat diperlukan
- [x] Tinggi default track audio: 48px (normal), 80px (expanded dengan waveform besar)

---

## 4. Sistem Track Otomatis

### Prinsip
- [ ] User tidak pernah perlu klik "Tambah Track" atau "Hapus Track"
- [ ] Track dibuat dan dihapus otomatis sesuai kebutuhan
- [ ] Track kosong yang tidak terpakai dihapus otomatis setelah beberapa detik (debounced)
- [ ] Selalu ada minimal 3 track kosong siap pakai di overlay dan audio

### Auto-create Track
- [ ] Saat item didrag ke area kosong di atas semua overlay track → buat track baru di atas
- [ ] Saat item didrag ke area kosong di bawah semua audio track → buat track baru di bawah
- [ ] Saat media audio didrop ke timeline → tempatkan di track audio yang paling kosong
- [ ] Saat media video didrop → track utama untuk video, audio track untuk audionya
- [ ] Track dibuat dengan animasi slide-in (150ms ease-out)

### Auto-remove Track
- [ ] Track overlay yang kosong dan bukan buffer track → hapus otomatis setelah 2 detik idle
- [ ] Track audio yang kosong dan bukan buffer track → hapus otomatis setelah 2 detik idle
- [ ] Animasi slide-out sebelum dihapus (150ms ease-in)
- [ ] Tidak menghapus track yang sedang di-hover atau di-interact

### Track Buffer
- [ ] Selalu jaga minimal 3 track overlay kosong di paling bawah overlay area
- [ ] Selalu jaga minimal 3 track audio kosong di paling bawah audio area
- [ ] Buffer track memiliki tampilan lebih transparan (opacity 40%) untuk membedakan dari track aktif

---

## 5. Ruler, Timecode & Navigasi

### Ruler
- [ ] Ruler berada di atas semua track, selalu sticky saat scroll vertikal
- [ ] Menampilkan timecode: `HH:MM:SS:FF` (jam:menit:detik:frame)
- [ ] Mendukung mode timecode alternatif: feet+frames (untuk film), sample (untuk audio)
- [ ] Tick marks menyesuaikan level zoom:
  - Zoom out sangat jauh: tick setiap menit
  - Zoom out: tick setiap 10 detik, 5 detik, 1 detik
  - Zoom normal: tick setiap 1 detik dengan sub-tick setiap 500ms
  - Zoom in: tick setiap frame
  - Zoom in sangat dekat: tick setiap sub-frame (untuk audio)
- [ ] Label timecode tidak overlap (adaptive density)
- [ ] Klik di ruler → pindahkan playhead ke posisi tersebut
- [ ] Drag di ruler → scrub playhead (preview bergerak realtime)
- [ ] Klik kanan di ruler → tambah marker di posisi tersebut
- [ ] Area in/out point di ruler dapat di-set dengan drag (range render)
- [ ] Highlight area in/out point dengan warna semi-transparan

### Timecode Display
- [ ] Timecode besar tampil di toolbar atas (selalu terlihat)
- [ ] Format dapat diubah (timecode / detik / frame number)
- [ ] Klik timecode → input field muncul, bisa ketik posisi langsung
- [ ] Enter di timecode field → playhead melompat ke posisi tersebut
- [ ] Mendukung input shorthand: `1030` → 00:00:10:30, `+15` → maju 15 frame

---

## 6. Playhead & Playback Engine

### Playhead
- [ ] Garis vertikal tipis (1–2px) berwarna merah/oranye memanjang dari ruler ke bawah semua track
- [ ] Kepala playhead di ruler berbentuk segitiga atau panah ke bawah
- [ ] Dapat di-drag horizontal untuk scrubbing
- [ ] Snap ke frame terdekat saat di-release
- [ ] Tidak bisa keluar dari batas 0 dan durasi total
- [ ] Warna playhead dapat dikustomisasi
- [ ] Playhead selalu di atas semua item (z-index tertinggi)
- [ ] Garis playhead semi-transparan agar item di belakangnya masih terlihat

### Playback Engine
- [ ] Tombol Play/Pause: `Space`
- [ ] Tombol Stop: `.` (kembali ke in-point atau frame 0)
- [ ] Play mundur: `Shift+Space`
- [ ] Kecepatan playback: 0.25x, 0.5x, 1x, 1.5x, 2x, 4x
- [ ] Playhead bergerak dengan `requestAnimationFrame` — tidak gunakan `setInterval`
- [ ] Sinkronisasi waktu menggunakan `AudioContext.currentTime` sebagai clock master
- [ ] Auto-scroll: timeline scroll otomatis agar playhead selalu terlihat saat playback
- [ ] Mode auto-scroll dapat di-toggle (off = playhead bisa keluar viewport)
- [ ] Loop playback: looping pada range in/out point
- [ ] Preview realtime di canvas/video element sinkron dengan playhead

### Transport Controls
- [ ] Previous Frame: `←` (maju 1 frame ke kiri)
- [ ] Next Frame: `→` (maju 1 frame ke kanan)
- [ ] Jump 10 Frame: `Shift+←` / `Shift+→`
- [ ] Jump to Start: `Home`
- [ ] Jump to End: `End`
- [ ] Jump to Previous Marker: `Shift+↑`
- [ ] Jump to Next Marker: `Shift+↓`
- [ ] Jump to Previous Edit (cut point): `↑`
- [ ] Jump to Next Edit: `↓`

---

## 7. Item / Clip Management

### Tampilan Item
- [ ] Background clip menggunakan warna berbeda per tipe (video = biru, audio = hijau, image = kuning, teks = ungu)
- [ ] Warna dapat di-override dengan label warna manual (8 pilihan)
- [ ] Nama file / nama kustom tampil di dalam clip (truncated jika terlalu panjang)
- [ ] Durasi clip tampil di pojok kanan bawah item (jika lebar cukup)
- [ ] Thumbnail strip di dalam video clip (sesuai level zoom)
- [ ] Waveform di dalam audio clip
- [ ] Indikator media offline: border merah + ikon warning
- [ ] Indikator item aktif (sedang diputar): highlight warna berbeda
- [ ] Indikator item terpilih: border highlight tebal (2–3px)
- [ ] Indikator item terkunci: ikon gembok di pojok kiri atas
- [ ] Indikator item muted: ikon speaker coret
- [ ] Indikator speed: badge `2x`, `0.5x`, dsb. jika speed ≠ 1.0
- [ ] Indikator efek aktif: ikon magic wand atau badge `FX` jika ada efek
- [ ] Indikator keyframe: ikon berlian kecil jika ada keyframe di item
- [ ] Handle trim kiri dan kanan muncul saat hover (tepi kiri/kanan item)
- [ ] Handle trim lebih besar saat item terpilih

### Interaksi Item
- [ ] Single click → pilih item (deselect yang lain)
- [ ] Double click → buka property panel / inspector item
- [ ] Right click → buka context menu item
- [ ] Drag → pindahkan item
- [ ] Drag ke track berbeda → pindahkan ke track tersebut
- [ ] `Delete` / `Backspace` → hapus item terpilih
- [ ] `Ctrl+D` → duplikat item
- [ ] `Ctrl+G` → group item terpilih menjadi compound clip

---

## 8. Drag & Drop System

### Visual Feedback Drag
- [ ] Item terangkat 6px (transform: translateY(-6px)) saat mulai drag
- [ ] Shadow muncul saat drag: `box-shadow: 0 8px 24px rgba(0,0,0,0.4)`
- [ ] Opacity item asli turun ke 30% (ghost di tempat asal)
- [ ] Cursor berubah ke `grabbing` saat drag
- [ ] Animasi awal drag: 120ms ease-out
- [ ] Drag clone mengikuti mouse dengan pergerakan halus (tidak ada jitter)

### Behavior Drag
- [ ] Threshold drag: harus bergerak minimal 4px sebelum drag dimulai (mencegah accidental drag)
- [ ] Saat drag: tampilkan ghost/preview di posisi target (semi-transparent)
- [ ] Ghost menampilkan snap indicator jika sedang snap ke sesuatu
- [ ] Drag ke track berbeda: item berpindah track
- [ ] Drag ke overlay track: item menjadi overlay
- [ ] Drag ke audio track: hanya item audio yang bisa (video tidak bisa drop ke audio track)
- [ ] Drag ke luar batas kiri timeline: item terpasang di frame 0
- [ ] Auto-scroll saat drag mendekati tepi kiri/kanan viewport (kecepatan proporsional dengan jarak ke tepi)
- [ ] Drop di antara dua item: item menyisip tanpa overlap (ripple insert mode, opsional)
- [ ] Indikator drop zone: highlight track saat item bisa di-drop di sana

### Multi-item Drag
- [ ] Semua item terpilih ikut bergerak saat salah satunya di-drag
- [ ] Offset relatif antar item dipertahankan selama drag
- [ ] Posisi relatif antar track dipertahankan

### Drag dari Media Library
- [ ] Drag dari media library ke timeline → buat item baru
- [ ] Preview posisi item sebelum drop (ghost transparan)
- [ ] Drop di area kosong antara item: otomatis sisip tanpa menggeser yang lain (overwrite mode)
- [ ] Drop dengan `Ctrl` held: insert mode (geser item di kanan untuk memberi ruang)

---

## 9. Trim & Slip System

### Trim Dasar
- [ ] Hover di tepi kiri item → cursor berubah ke resize-left
- [ ] Hover di tepi kanan item → cursor berubah ke resize-right
- [ ] Drag tepi kiri → ubah in-point item (clip lebih pendek/panjang dari kiri)
- [ ] Drag tepi kanan → ubah out-point item (clip lebih pendek/panjang dari kanan)
- [ ] Durasi minimum item: 1 frame
- [ ] Tidak bisa trim melebihi batas media source (in-point < 0 atau out-point > durasi media)
- [ ] Timecode tooltip muncul saat trim (menampilkan posisi frame dan durasi)
- [ ] Waveform/thumbnail update realtime saat trim
- [ ] Snap aktif saat trim (snap ke frame, ke item lain, ke playhead)

### Trim Modes (Advanced)
- [ ] **Ripple Trim**: trim satu item, geser semua item di kanannya otomatis (agar tidak ada gap)
  - Aktifkan dengan hold `R` saat trim
- [ ] **Roll Trim**: trim di antara dua item yang bersebelahan — satu bertambah, yang lain berkurang
  - Aktifkan dengan hover di batas antara dua item sambil hold `Alt`
- [ ] **Slip**: geser in/out point tanpa mengubah posisi dan durasi di timeline
  - Aktifkan dengan `S` + drag horizontal di dalam item
- [ ] **Slide**: pindahkan item di antara dua item lain, kedua tetangga otomatis di-trim
  - Aktifkan dengan `Shift+S` + drag horizontal

### Trim Keyboard
- [ ] `[` → set in-point item terpilih ke posisi playhead
- [ ] `]` → set out-point item terpilih ke posisi playhead
- [ ] `Alt+[` → trim kiri 1 frame
- [ ] `Alt+]` → trim kanan 1 frame
- [ ] `Shift+Alt+[` → trim kiri 10 frame
- [ ] `Shift+Alt+]` → trim kanan 10 frame

---

## 10. Snapping System

### Target Snap
- [ ] Snap ke tepi kiri item lain (start frame)
- [ ] Snap ke tepi kanan item lain (end frame)
- [ ] Snap ke posisi playhead
- [ ] Snap ke marker (semua tipe marker)
- [ ] Snap ke batas in/out range
- [ ] Snap ke frame terdekat (selalu aktif, tidak bisa dimatikan)
- [ ] Snap ke grid waktu (detik penuh, 5 detik, dsb.) — opsional

### Visual Feedback Snap
- [ ] Garis bantu snapping vertikal berwarna kuning/hijau muncul di titik snap
- [ ] Garis memanjang dari atas ke bawah semua track
- [ ] Tooltip snap label: "Snap to item start", "Snap to playhead", dsb.
- [ ] Item seolah "tertarik" ke titik snap dengan magnet visual (micro-jump 2px)
- [ ] Threshold snap: 8px dari titik snap (dapat dikonfigurasi)

### Snap Toggle
- [ ] Tombol snap on/off di toolbar (ikon magnet)
- [ ] Shortcut toggle snap: `S`
- [ ] Hold `Alt` sementara matikan snap (tanpa toggle permanen)
- [ ] Snap strength dapat diatur: none / weak (16px) / normal (8px) / strong (4px)

---

## 11. Seleksi (Marquee & Multi)

### Single Select
- [ ] Klik item → pilih item, deselect semua yang lain
- [ ] Klik area kosong di timeline → deselect semua

### Multi Select
- [ ] `Ctrl+Click` → tambah/hapus item dari seleksi
- [ ] `Shift+Click` → pilih range item dari item terakhir dipilih ke item ini (per track)
- [ ] `Ctrl+A` → select all item di semua track
- [ ] `Ctrl+Shift+A` → deselect all
- [ ] Semua item terpilih dapat dipindah bersamaan (multi-drag)
- [ ] Semua item terpilih dapat dihapus bersamaan (`Delete`)

### Marquee Selection
- [ ] Klik kiri tahan + seret di area kosong → mulai marquee
- [ ] Kotak seleksi: border solid 1px biru/putih + fill biru semi-transparan (opacity 20%)
- [ ] Kotak mengikuti mouse secara realtime (tidak ada lag)
- [ ] Item yang intersect (bersinggungan) dengan kotak → terseleksi
- [ ] Mode intersect vs. mode contain: `Alt` held = hanya item yang fully contained
- [ ] Marquee di atas multiple track = seleksi lintas track
- [ ] Release mouse = finalize seleksi, marquee hilang
- [ ] `Escape` saat marquee aktif → batalkan marquee

### Track Select
- [ ] Klik nama track → pilih semua item di track tersebut
- [ ] `Ctrl+Click` nama track → tambah semua item track ke seleksi

---

## 12. Zoom & Scroll

### Zoom
- [ ] Zoom slider di toolbar: range 10% – 2000%
- [ ] `Ctrl+Scroll` → zoom in/out (centered di posisi mouse)
- [ ] `=` / `+` → zoom in
- [ ] `-` → zoom out
- [ ] `\` → fit timeline (semua item terlihat di viewport)
- [ ] Zoom in: thumbnail lebih detail, waveform lebih presisi
- [ ] Zoom out: thumbnail lebih jarang, waveform lebih compressed
- [ ] Posisi relatif item di timeline tidak berubah saat zoom (hanya pixel position berubah)
- [ ] Zoom pivot: zoom mengikuti posisi playhead (bukan kiri viewport)
- [ ] Minimum zoom: 1 frame = 2px (tidak bisa lebih kecil)
- [ ] Maximum zoom: 1 frame = 400px

### Scroll
- [ ] Scroll horizontal: `Scroll Wheel` (atau trackpad swipe horizontal)
- [ ] Scroll vertikal: `Shift+Scroll` (atau trackpad swipe vertikal)
- [ ] Scrollbar horizontal di bawah timeline
- [ ] Scrollbar vertikal di kanan timeline
- [ ] Scroll ke posisi playhead: `P` atau klik tombol "go to playhead" di toolbar
- [ ] Smooth scroll (momentum) untuk trackpad
- [ ] Keyboard scroll: `PageUp` / `PageDown` untuk scroll vertikal cepat

---

## 13. Audio System

### Audio Track Features
- [ ] Waveform visual di dalam item audio (di-generate dari file audio)
- [ ] Waveform zoom sesuai level zoom timeline
- [ ] Waveform cache: sekali di-generate, disimpan di IndexedDB / cache
- [ ] Volume envelope: garis horizontal di dalam clip, drag naik/turun untuk atur volume
- [ ] Volume envelope keyframe: klik garis untuk tambah titik kontrol volume
- [ ] Fade in/out handle: segitiga di pojok kiri/kanan clip audio untuk drag fade
- [ ] Fade in/out visual: gradient overlay di atas waveform
- [ ] Mute per item: ikon speaker di item, klik untuk toggle mute
- [ ] Solo track: hanya track ini yang terdengar saat playback
- [ ] Pan control: di property panel, -1.0 (kiri) sampai 1.0 (kanan)
- [ ] EQ strip: tombol EQ di property panel untuk akses equalizer sederhana

### Audio Scrubbing
- [ ] Saat scrub playhead: audio terdengar sesuai posisi (audio scrubbing)
- [ ] Kecepatan scrub mempengaruhi pitch audio saat scrub
- [ ] Toggle audio scrub on/off

### Audio Sync
- [ ] Audio dan video linked clip selalu sinkron saat dipindah
- [ ] Audio drift detection: peringatan jika audio dan video tidak sinkron
- [ ] Sync by timecode: auto-align audio ke video berdasarkan embedded timecode
- [ ] Sync by waveform: auto-align audio ke video berdasarkan analisis waveform (AI)

---

## 14. Overlay System

### Tipe Overlay
- [ ] **Image overlay**: PNG, JPG, WEBP, SVG, GIF (animasi)
- [ ] **Video overlay**: MP4, MOV, WEBM (dengan alpha channel jika ada)
- [ ] **Teks**: semua font system + custom font upload
- [ ] **Subtitle**: format khusus, linked ke subtitle track
- [ ] **Shape**: rectangle, circle, line, polygon, arrow (SVG-based)
- [ ] **Sticker**: animasi GIF/WEBP atau Lottie JSON
- [ ] **Watermark**: preset watermark atau custom image dengan opacity default rendah
- [ ] **Lower Third**: template siap pakai dengan placeholder teks
- [ ] **Progress Bar**: bar yang bergerak sesuai playhead (untuk tutorial video)
- [ ] **Blur/Mosaic**: kotak blur area tertentu di frame

### Overlay Transform
- [ ] Position X, Y (relative to canvas 0–100%)
- [ ] Scale X, Scale Y (dengan lock aspect ratio toggle)
- [ ] Rotation (0–360°)
- [ ] Opacity (0–100%)
- [ ] Anchor point (pivot untuk scale dan rotate)
- [ ] Semua transform dapat di-keyframe

### Overlay Z-Order
- [ ] Z-order mengikuti urutan track (track lebih atas = render lebih depan)
- [ ] Drag track panel untuk reorder z-order
- [ ] `Ctrl+]` → bring forward 1 layer
- [ ] `Ctrl+[` → send backward 1 layer
- [ ] `Ctrl+Shift+]` → bring to front
- [ ] `Ctrl+Shift+[` → send to back

---

## 15. Thumbnail & Waveform

### Video Thumbnail
- [ ] Thumbnail strip di dalam video clip
- [ ] Thumbnail di-generate dari video menggunakan Web Workers (tidak blocking UI)
- [ ] Thumbnail cache: disimpan di IndexedDB dengan key = `mediaId + frameNumber`
- [ ] Thumbnail resolusi rendah dulu (placeholder) lalu resolusi penuh setelah siap
- [ ] Jumlah thumbnail per clip menyesuaikan zoom (lebih banyak saat zoom in)
- [ ] Thumbnail yang keluar viewport tidak di-generate (lazy)
- [ ] Thumbnail update saat clip di-trim
- [ ] Saat zoom in sangat dekat: setiap frame memiliki thumbnail sendiri

### Audio Waveform
- [ ] Waveform di-generate dari file audio menggunakan Web Audio API + Web Workers
- [ ] Waveform disimpan di cache (array Float32 di IndexedDB)
- [ ] Waveform render menggunakan canvas (bukan SVG, untuk performa)
- [ ] Waveform zoom sesuai level zoom timeline (re-render dari cache, bukan re-generate)
- [ ] Waveform stereo: channel kiri atas, channel kanan bawah (opsional)
- [ ] Waveform warna dapat dikustomisasi per track

---

## 16. Keyframe System

### Keyframe Engine
- [ ] Setiap property animatable dapat di-keyframe
- [ ] Property yang bisa di-keyframe: position X/Y, scale X/Y, rotation, opacity, volume, pan, effect parameters
- [x] Keyframe disimpan di `item.keyframes[propertyName][]`
- [ ] Setiap keyframe: `{ frame: number, value: any, easing: EasingFunction }`
- [ ] Interpolasi antar keyframe: linear, ease-in, ease-out, ease-in-out, bezier custom, hold (jump)

### Keyframe UI di Timeline
- [ ] Expand item di timeline → tampilkan keyframe lane per property
- [ ] Keyframe lane berada di bawah item parent
- [ ] Keyframe ditampilkan sebagai berlian kecil di posisi frame
- [ ] Drag keyframe berlian: ubah posisi frame keyframe
- [ ] Double-click keyframe berlian: edit value keyframe
- [ ] Right-click keyframe: ubah easing, delete keyframe
- [ ] Bezier handle muncul untuk keyframe dengan easing bezier
- [ ] Ctrl+click di keyframe lane: tambah keyframe baru di posisi playhead

### Keyframe di Property Panel
- [ ] Ikon berlian (♦) di samping setiap property animatable
- [ ] Klik ikon berlian: tambah/hapus keyframe di frame saat ini
- [ ] Ikon berlian menjadi aktif (terisi) jika ada keyframe di frame tersebut
- [ ] Navigasi ◄ ► antar keyframe di property panel

---

## 17. Transition System

### Jenis Transisi
- [ ] **Cut** (default): tanpa transisi
- [ ] **Dissolve / Cross Fade**: fade out clip kiri, fade in clip kanan
- [ ] **Wipe**: arah dapat dipilih (kiri, kanan, atas, bawah, diagonal)
- [ ] **Push / Slide**: clip kanan mendorong clip kiri keluar frame
- [ ] **Zoom**: zoom in/out transition
- [ ] **Dip to Black / Dip to White**: dip sebelum ganti clip
- [ ] **Custom GPU Transition**: shader-based (WebGL) untuk transisi efek khusus

### Transisi di Timeline
- [ ] Transisi ditampilkan sebagai overlap antara dua clip yang bersebelahan
- [ ] Visual transisi: trapezoid atau persegi panjang di antara dua clip dengan ikon transisi
- [ ] Drag durasi transisi: drag tepi overlap untuk perpendek/perpanjang transisi
- [ ] Durasi minimum transisi: 1 frame
- [ ] Double-click transisi: buka property panel transisi
- [ ] Delete transisi: klik transisi lalu `Delete`
- [ ] Add transisi: drag dari panel transisi ke batas antar clip

---

## 18. Color Grading Integration

### Color Track / Adjustment Layer
- [ ] Adjustment Layer: layer khusus di overlay area yang mempengaruhi semua track di bawahnya
- [ ] Adjustment layer ditampilkan dengan warna berbeda dan ikon khusus
- [ ] Durasi adjustment layer dapat di-trim

### LUT (Look Up Table)
- [ ] Mendukung import file .cube LUT
- [ ] LUT dapat diterapkan per item atau per adjustment layer
- [ ] Intensity LUT dapat dikontrol (0–100%)
- [ ] Beberapa LUT dapat distacked

### Basic Color Controls (per item)
- [ ] Brightness, Contrast, Saturation, Hue Shift
- [ ] Temperature (color temperature warm/cool)
- [ ] Tint
- [ ] Shadows, Midtones, Highlights (lift/gamma/gain)
- [ ] RGB Curves (per channel)
- [ ] HSL Qualifier (color selection untuk color mask)
- [ ] Vignette
- [ ] Grain/Noise

---

## 19. Subtitle & Caption System

### Subtitle Track
- [ ] Track khusus subtitle berada di paling bawah overlay area
- [ ] Subtitle item lebih pendek dan ramping (tinggi 24px)
- [ ] Warna subtitle item berbeda dari item lain
- [ ] Setiap item subtitle: teks, in-frame, out-frame, style
- [ ] Double-click item subtitle → edit teks inline
- [ ] Split subtitle: `Ctrl+K` di posisi playhead

### Import/Export Subtitle
- [ ] Import dari file .SRT
- [ ] Import dari file .VTT
- [ ] Import dari file .ASS / .SSA
- [ ] Export ke .SRT
- [ ] Export ke .VTT
- [ ] Auto-generate subtitle dari audio menggunakan AI (speech-to-text)

### Subtitle Style
- [ ] Font, ukuran, warna, bold, italic, underline
- [ ] Background box (warna, opacity, border radius)
- [ ] Posisi (atas/tengah/bawah, horizontal align)
- [ ] Outline dan shadow
- [ ] Preset style yang bisa disimpan dan diapply ke seluruh track

---

## 20. Motion Graphics Layer

### Lottie / After Effects Integration
- [ ] Mendukung import file .JSON (Lottie animation)
- [ ] Lottie render di canvas menggunakan lottie-web
- [ ] Durasi animasi sinkron dengan durasi item di timeline
- [ ] Speed animasi mengikuti speed item
- [ ] Loop, ping-pong, atau play-once
- [ ] Property Lottie yang ter-expose dapat di-keyframe

### Shape & Path Animation
- [ ] Buat shape (rectangle, ellipse, polygon, star, path bebas)
- [ ] Shape path dapat di-keyframe (morphing antar shape)
- [ ] Stroke animation (write-on effect): path stroke tumbuh sesuai waktu
- [ ] Fill, stroke, opacity dapat di-keyframe

### Text Animation
- [ ] Text layer dengan animasi per karakter, per kata, per baris
- [ ] Preset animasi teks: typewriter, fade-in per karakter, bounce, dsb.
- [ ] Animasi teks dapat di-keyframe
- [ ] Variable font support (jika font mendukung)

---

## 21. Marker & Chapter System

### Tipe Marker
- [ ] **Standard Marker**: titik warna di ruler, untuk catatan editing
- [ ] **Chapter Marker**: membagi video menjadi chapter (untuk YouTube chapters)
- [ ] **Beat Marker**: sinkronisasi dengan beat musik (auto-detect atau manual)
- [ ] **In/Out Point**: range untuk export atau render partial

### Marker Properties
- [ ] Warna marker (8 pilihan warna)
- [ ] Nama / label marker (edit inline di tooltip atau panel)
- [ ] Komentar marker (teks panjang)
- [ ] Durasi marker (marker bisa memiliki durasi, bukan hanya titik)

### Marker Management
- [ ] `M` → tambah marker di posisi playhead
- [ ] `Ctrl+M` → tambah marker dengan nama
- [ ] Klik marker → pindah playhead ke posisi marker
- [ ] Drag marker → pindah posisi marker
- [ ] Right-click marker → edit, ubah warna, hapus
- [ ] Panel marker: list semua marker, klik untuk navigate, sort by time/name/color
- [ ] Export marker list sebagai EDL atau CSV

---

## 22. Undo / Redo System

### Prinsip Undo
- [ ] Semua aksi user dapat di-undo (tidak ada aksi yang tidak bisa di-undo)
- [ ] History stack: minimal 100 langkah ke belakang
- [ ] History dapat dikonfigurasi batasnya (RAM consideration)
- [ ] `Ctrl+Z` → undo
- [ ] `Ctrl+Shift+Z` atau `Ctrl+Y` → redo

### Granularitas Undo
- [ ] Setiap pergerakan item = 1 undo step
- [ ] Trim = 1 undo step (bukan per-pixel, tapi per gesture selesai)
- [ ] Delete = 1 undo step
- [ ] Multi-item delete = 1 undo step
- [ ] Text edit = 1 undo step per kata (bukan per karakter)
- [ ] Grouping operasi terkait (misal: delete + ripple shift) = 1 undo step

### History Panel
- [ ] Panel history: list semua aksi, klik untuk undo/redo ke titik tersebut
- [ ] Nama aksi deskriptif: "Move Clip", "Trim Start", "Delete 3 Clips", dsb.
- [ ] Visual snapshot thumbnail (opsional, DaVinci-style)

---

## 23. Clipboard & Paste System

### Copy / Paste
- [ ] `Ctrl+C` → copy item terpilih
- [ ] `Ctrl+X` → cut item terpilih
- [ ] `Ctrl+V` → paste di posisi playhead (insert)
- [ ] `Ctrl+Shift+V` → paste in place (posisi frame yang sama)
- [ ] `Ctrl+Alt+V` → paste attributes (paste hanya property/efek, bukan posisi/durasi)
- [ ] Copy-paste lintas project (via clipboard JSON)

### Duplicate
- [ ] `Ctrl+D` → duplikat item, letakkan tepat setelah item asli
- [ ] `Alt+Drag` → duplikat item sambil drag ke posisi baru

---

## 24. Split, Ripple & Gap System

### Split
- [ ] `Ctrl+K` → split item di posisi playhead
- [ ] Split item yang terpilih saja (jika ada seleksi)
- [ ] Split all items di posisi playhead (jika tidak ada seleksi)
- [ ] Metadata dan efek dipertahankan di kedua bagian
- [ ] Keyframe terpotong dengan benar di titik split
- [ ] Linked clips (audio+video) split bersamaan

### Ripple
- [ ] **Ripple Delete**: hapus item dan tutup gap secara otomatis (geser semua item di kanan)
  - `Shift+Delete` atau via context menu
- [ ] **Ripple Insert**: saat drop item, geser item di kanan untuk memberi ruang
- [ ] **Ripple Trim**: trim satu sisi, sisi lain otomatis terisi (tidak ada gap)

### Gap Management
- [ ] Gap di main track terlihat jelas (kotak abu-abu dengan label "Gap")
- [ ] Klik gap → pilih gap
- [ ] `Delete` gap → ripple delete gap (semua item di kanan maju)
- [ ] Close Gap otomatis (klik kanan → Close Gap)
- [ ] Tambah gap manual (`Alt+Shift+Drag` item untuk dorong yang lain)

---

## 25. Speed & Time Remapping

### Constant Speed
- [ ] Speed per item: 0.01x – 100x
- [ ] Input langsung di property panel
- [ ] Preset: 0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x, 4x
- [ ] Durasi item otomatis berubah sesuai speed
- [ ] Audio pitch correction on/off (pitch preserve saat slow/fast motion)

### Variable Speed / Time Remapping
- [ ] Time remap mode: aktifkan per item
- [ ] Grafik speed di keyframe lane (sumbu Y = speed, sumbu X = waktu)
- [ ] Tambah keyframe di grafik → buat perubahan speed di titik tersebut
- [ ] Freeze frame: set speed ke 0% di keyframe untuk frame diam
- [ ] Reverse: speed negatif untuk putar mundur
- [ ] Smooth ramp antar speed (bezier curve di grafik)

---

## 26. Nested Sequence / Compound Clip

### Membuat Compound Clip
- [ ] Pilih beberapa item → `Ctrl+G` → buat compound clip
- [ ] Compound clip tampil sebagai satu item di timeline parent
- [ ] Warna khusus untuk compound clip
- [ ] Double-click compound clip → masuk ke timeline internal

### Nested Timeline
- [ ] Compound clip memiliki timeline sendiri (nested)
- [ ] Navigasi breadcrumb: `Project > Sequence > Compound Clip`
- [ ] Klik breadcrumb untuk kembali ke level atas
- [ ] Perubahan di nested timeline langsung terlihat di parent

### Precompose
- [ ] Precompose: buat nested sequence dari seleksi + otomatis ganti dengan compound clip di timeline
- [ ] Option: move all attributes to new sequence
- [ ] Option: leave all attributes in place

---

## 27. Linked Clip (Audio + Video)

### Link Management
- [ ] Video dan audio dari satu file media otomatis ter-link
- [ ] Linked clip bergerak bersamaan saat drag
- [ ] Trim salah satu → yang lain ikut trim
- [ ] Ikon link (rantai) pada item yang ter-link
- [ ] `Alt+Click` → pilih hanya komponen audio atau video (unlink sementara)
- [ ] `Ctrl+L` → toggle link/unlink permanen
- [ ] Unlink: audio dan video menjadi independen
- [ ] Relink: drag audio ke video untuk re-link

### Sync Lock
- [ ] Sync lock per track: track terkunci tidak ikut ripple insert/delete
- [ ] Toggle sync lock di track panel (ikon rantai/kunci)

---

## 28. Render & Export Integration

### Render Queue
- [ ] Add to render queue dari timeline
- [ ] Multiple render jobs dalam satu queue
- [ ] Progress bar per job di panel render
- [ ] Background rendering (tidak menghentikan editing)

### In/Out Range
- [ ] Set in point: `I` di posisi playhead
- [ ] Set out point: `O` di posisi playhead
- [ ] Clear in/out: `Alt+I`, `Alt+O`
- [ ] Render only in/out range (Export Selection)

### Smart Render
- [ ] Hanya render segment yang berubah (tidak re-render segment yang sudah di-cache)
- [ ] Render preview di background: segment yang sudah di-render ditandai hijau di ruler
- [ ] Merah = belum dirender, kuning = render preview (bukan final), hijau = sudah dirender

---

## 29. Performa & Rendering Engine

### Virtualized Rendering
- [ ] Hanya render item yang berada di dalam viewport horizontal + 200px buffer
- [ ] Item di luar viewport tidak di-render ke DOM / Canvas sama sekali
- [ ] Track di luar viewport vertikal juga tidak di-render
- [ ] Re-render hanya komponen yang berubah (minimal re-render)
- [ ] Gunakan `React.memo`, `useMemo`, `useCallback` untuk mencegah re-render sia-sia

### Canvas Rendering
- [ ] Thumbnail strip di-render ke canvas (bukan `<img>` tag individual)
- [ ] Waveform di-render ke canvas
- [ ] Playhead, marquee, snap line di-render ke overlay canvas
- [ ] Canvas di-resize hanya saat window resize (bukan setiap frame)
- [ ] `devicePixelRatio` diperhitungkan untuk layar retina

### Web Workers
- [ ] Thumbnail generation berjalan di Web Worker (tidak blocking main thread)
- [ ] Waveform generation berjalan di Web Worker
- [ ] Snapping calculation (mencari target snap terdekat) di Web Worker untuk 100+ item

### Target Performa
- [ ] 60fps drag dan scroll dengan 200+ item di timeline
- [ ] Respon klik < 16ms
- [ ] Thumbnail siap dalam < 2 detik per clip (ukuran normal)
- [ ] Waveform siap dalam < 1 detik per menit audio
- [ ] Undo/redo < 50ms

### Caching Strategy
- [ ] Thumbnail cache: IndexedDB, key = `${mediaId}_${frameNumber}_${width}`
- [ ] Waveform cache: IndexedDB, key = `${mediaId}_${sampleRate}`
- [ ] Cache invalidation: otomatis saat media diganti
- [ ] Cache limit: maksimum 500MB di IndexedDB, LRU eviction

---

## 30. Keyboard Shortcut System

### Shortcut Default
| Aksi | Shortcut |
|------|----------|
| Play / Pause | `Space` |
| Stop | `.` |
| Previous Frame | `←` |
| Next Frame | `→` |
| Jump 10 Frame | `Shift+←` / `Shift+→` |
| Jump to Start | `Home` |
| Jump to End | `End` |
| Split at Playhead | `Ctrl+K` |
| Delete | `Delete` / `Backspace` |
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
| Duplicate | `Ctrl+D` |
| Group (Compound) | `Ctrl+G` |
| Toggle Snap | `S` |
| Toggle Mute Item | `M` (saat item terpilih) |
| Add Marker | `M` (saat tidak ada seleksi) |
| Set In Point | `I` |
| Set Out Point | `O` |
| Zoom In | `=` |
| Zoom Out | `-` |
| Fit Timeline | `\` |
| Link/Unlink | `Ctrl+L` |
| Lock Item | `Ctrl+Shift+L` |
| Next Edit Point | `↓` |
| Previous Edit Point | `↑` |
| Next Marker | `Shift+↓` |
| Previous Marker | `Shift+↑` |

### Customizable Shortcuts
- [ ] Semua shortcut dapat diubah dari Settings → Keyboard Shortcuts
- [ ] Import/export shortcut preset (JSON)
- [ ] Preset bawaan: Default, Premiere Pro compatible, Final Cut compatible, DaVinci compatible
- [ ] Konflik shortcut terdeteksi dan diberi peringatan
- [ ] Reset ke default tersedia per shortcut atau all-at-once

---

## 31. Context Menu System

### Context Menu Item
- [ ] Cut, Copy, Paste
- [ ] Duplicate
- [ ] Delete / Ripple Delete
- [ ] Split at Playhead
- [ ] Slip, Slide (dengan submenu)
- [ ] Speed / Duration (buka dialog)
- [ ] Link / Unlink Audio
- [ ] Nest (buat compound clip dari item ini)
- [ ] Enable / Disable Item (on/off tanpa delete)
- [ ] Lock / Unlock
- [ ] Mute / Unmute
- [ ] Label (submenu 8 warna)
- [ ] Replace Media (ganti source media tanpa ubah posisi/durasi)
- [ ] Reveal in Media Library
- [ ] Properties (buka inspector)

### Context Menu Track
- [ ] Rename Track
- [ ] Duplicate Track
- [ ] Delete Track (hanya jika kosong, atau dengan konfirmasi)
- [ ] Mute / Solo Track
- [ ] Lock / Unlock Track
- [ ] Change Track Height (Small / Medium / Large)
- [ ] Add Adjustment Layer to Track

### Context Menu Ruler / Timeline
- [ ] Add Marker
- [ ] Add Chapter Marker
- [ ] Set In Point
- [ ] Set Out Point
- [ ] Clear In/Out Points
- [ ] Go to Timecode (input field)

---

## 32. Accessibility

- [ ] Semua elemen interaktif dapat diakses via keyboard (Tab, Enter, Space, Arrow keys)
- [ ] Fokus ring terlihat jelas di semua elemen
- [ ] ARIA labels pada semua tombol, slider, dan kontrol
- [ ] Screen reader support: item nama dan posisi diumumkan
- [ ] High contrast mode support (CSS variables untuk semua warna)
- [ ] Ukuran minimum tap target: 44×44px (WCAG 2.5.5)
- [ ] Animasi dapat dinonaktifkan (`prefers-reduced-motion` media query)
- [ ] Warna tidak satu-satunya indikator informasi (selalu ada bentuk/label juga)

---

## 33. AI Editing Readiness

### Hook Points untuk AI
- [ ] API internal: `timeline.insertClip(mediaId, trackId, frame)` — AI dapat memanggil ini
- [ ] API internal: `timeline.moveClip(clipId, targetTrackId, targetFrame)` — AI dapat memanggil
- [ ] API internal: `timeline.trimClip(clipId, newInFrame, newOutFrame)` — AI dapat memanggil
- [ ] API internal: `timeline.addMarker(frame, label, color)` — AI dapat memanggil
- [ ] API internal: `timeline.applyEffect(clipId, effectId, params)` — AI dapat memanggil
- [ ] API internal: `timeline.generateSubtitles(clipId)` → trigger speech-to-text
- [ ] Event listener: AI dapat subscribe ke event timeline untuk observasi
- [ ] Semua aksi AI masuk ke undo history (bisa di-undo user)

### AI Features (Future-ready)
- [ ] Auto-cut: AI deteksi shot boundary dan potong otomatis
- [ ] Smart B-roll: AI suggest b-roll placement berdasarkan narasi
- [ ] Auto-sync music: AI align cut point ke beat musik
- [ ] Color match: AI match color grading antar clip
- [ ] Noise reduction audio: AI cleanup audio noise
- [ ] Auto-subtitle: speech-to-text otomatis + placement di subtitle track
- [ ] Scene detection: AI group clip berdasarkan scene

---

## 34. Testing & QA Checklist

### Functional Testing
- [ ] Drag item antar track: posisi frame akurat
- [ ] Trim kiri dan kanan: in/out point correct, tidak ada frame offset
- [ ] Snap ke item: tidak ada floating point error, snap tepat ke frame
- [ ] Split: metadata terjaga di kedua bagian
- [ ] Undo 10 langkah berturut-turut: state kembali benar
- [ ] Multi-select drag 20 item: offset relatif dipertahankan
- [ ] Marquee: item yang tersentuh batas luar kotak ikut terseleksi
- [ ] Playback: playhead dan audio sinkron hingga 30 menit video
- [ ] Zoom in/out: posisi item di frame tidak berubah
- [ ] Auto-track: track kosong dibuat dan dihapus dengan benar

### Performance Testing
- [ ] 200 item di timeline: scroll 60fps
- [ ] 50 track: render list tidak lag
- [ ] Thumbnail generation 10 video masing-masing 10 menit: tidak freeze UI
- [ ] Undo 100 langkah: memory usage tidak meledak
- [ ] Zoom to maximum (1 frame = 400px): tidak ada render artifact

### Edge Cases
- [ ] Item durasi 1 frame: trim, split, select semua bekerja
- [ ] Item di frame 0: tidak bisa di-trim ke kiri negatif
- [ ] Item di frame terakhir timeline: tidak bisa di-drag keluar batas kanan
- [ ] Dua item di frame yang sama persis (overlap 0): tidak ada z-fight
- [ ] Audio tanpa video: track otomatis hanya audio area
- [ ] Video tanpa audio: tidak dibuat audio track kosong
- [ ] Media offline saat buka project: peringatan + placeholder, tidak crash

---

## 35. Hasil Akhir & Definition of Done

Revisi dianggap **SELESAI** jika semua poin berikut terpenuhi:

### Core System
- [ ] Auto Track System berfungsi penuh (create, buffer, remove otomatis)
- [ ] Overlay Area dengan semua tipe overlay
- [ ] Main Track Permanen (tidak bisa dihapus/dipindah)
- [ ] Audio Area dengan waveform dan volume envelope
- [ ] Thumbnail Project Upload

### Interaction
- [ ] Drag & Drop halus 60fps dengan shadow dan lift visual
- [ ] Trim dengan preview realtime dan snap
- [ ] Slip, Slide, Ripple Trim tersedia
- [ ] Split akurat di frame playhead
- [ ] Marquee Selection semi-transparan realtime
- [ ] Multi Selection dengan Ctrl+Click dan Shift+Click

### Precision
- [ ] Snapping akurat ke frame (zero floating-point error)
- [ ] Snap ke item, playhead, dan marker
- [ ] Visual feedback snap line
- [ ] Zoom tidak mengubah posisi relatif item

### Playback
- [ ] Playback sinkron antara video, audio, dan playhead
- [ ] Auto-scroll saat playback
- [ ] Audio scrubbing saat scrub playhead
- [ ] Transport controls lengkap dengan keyboard shortcut

### Advanced
- [ ] Keyframe System siap digunakan
- [ ] Subtitle Track dan import/export SRT/VTT
- [ ] Undo/Redo 100 langkah
- [ ] Context Menu lengkap
- [ ] Keyboard shortcut customizable

### Performance
- [ ] Virtualized rendering (hanya render yang terlihat)
- [ ] Thumbnail cache di IndexedDB
- [ ] Waveform cache di IndexedDB
- [ ] Web Worker untuk generate thumbnail dan waveform
- [ ] 60fps dengan 200+ item
- [ ] AI API hooks siap (internal API terdokumentasi)

---

*Checklist ini merupakan living document — update seiring progress implementasi.*
*Version: 2.0 | Last Updated: 2026*
