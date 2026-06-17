# CapCut Clone — PART 2: Import, Export, Cut, Trim, Freeze Frame

> **Prasyarat**: Part 1 selesai — layout, store, dan timeline shell sudah jalan.
> Fokus Part 2: operasi dasar editing yang paling sering dipakai.

---

## Fitur yang Dibangun di Part 2

| Fitur | API yang Dipakai |
|-------|-----------------|
| Import video/audio/gambar | File System Access API + `<input type="file">` |
| Generate thumbnail | Canvas + `HTMLVideoElement.seeked` |
| Export video | FFmpeg.wasm |
| Cut (split) klip | Logic di projectStore |
| Trim (in/out point) | Resize handle di timeline |
| Freeze frame | FFmpeg extract frame → tambah sebagai klip gambar |
| Proxy media | OffscreenCanvas downscale untuk preview cepat |

---

## Prompt untuk Codex — PART 2A: Media Import

```
Tambahkan fitur import media ke MediaImporter.jsx dan useMediaImport.js.

Logika import:
1. Saat user klik "+ Impor":
   - Buka file picker: accept="video/*,audio/*,image/*" multiple
   - Atau drag & drop ke LeftPanel

2. Untuk setiap file yang dipilih:
   a. Buat object URL: URL.createObjectURL(file)
   b. Jika video: buat HTMLVideoElement tersembunyi, tunggu 'loadedmetadata',
      ambil file.duration, width, height
   c. Generate thumbnail:
      - Buat canvas 160x90
      - Seek video ke 10% durasi
      - Saat event 'seeked': ctx.drawImage(video, 0, 0, 160, 90)
      - canvas.toDataURL() → simpan sebagai thumbnailUrl
   d. Simpan ke mediaStore:
      {
        id: nanoid(),
        name: file.name,
        type: 'video'|'audio'|'image',
        file,
        url,
        thumbnailUrl,
        duration,       // detik
        width, height,
        size: file.size,
        addedToTimeline: false
      }

3. Tampilkan di grid MediaLibrary saat selesai.

4. Double-click thumbnail → preview di PreviewPlayer (bukan timeline).

5. Drag thumbnail ke timeline → trigger addClip di projectStore.

Gunakan useMediaImport.js sebagai custom hook, export fungsi importFiles(fileList).
```

---

## Prompt untuk Codex — PART 2B: Drag Media ke Timeline

```
Implementasikan drag-and-drop dari media library ke timeline.

Di MediaThumbnail.jsx:
- onDragStart: set dataTransfer.setData('mediaId', item.id)
- Set custom drag image (thumbnail)

Di TrackLane.jsx (atau Timeline.jsx):
- onDragOver: preventDefault() agar bisa drop, hitung posisi waktu dari mouseX
- Tampilkan ghost klip semi-transparan di posisi drop
- onDrop:
  1. Ambil mediaId dari dataTransfer
  2. Hitung startTime = (mouseX - timelineOffsetLeft) / pixelsPerSecond
  3. Snap ke detik terdekat jika magnet aktif
  4. Cek tabrakan dengan klip lain di track yang sama
  5. Panggil projectStore.addClip({
       id: nanoid(),
       mediaId,
       trackId: targetTrackId,
       start: startTime,
       end: startTime + mediaDuration,
       inPoint: 0,        // trim start
       outPoint: mediaDuration,  // trim end
     })

Di Timeline: kalkulasi pixelsPerSecond = basePixels * zoomLevel
Saat zoom berubah, re-render semua klip tanpa memuat ulang media.
```

---

## Prompt untuk Codex — PART 2C: Cut (Split) Klip

```
Implementasikan fitur Cut/Split klip di timeline.

Trigger split:
1. Posisikan playhead di tengah klip
2. Tekan tombol split (ikon gunting) di toolbar timeline, ATAU tekan shortcut S/Cmd+B

Logika di projectStore.splitClip(clipId, atTime):
- Validasi: atTime harus berada antara clip.start dan clip.end
- Hitung splitOffset = atTime - clip.start (posisi dalam media asli)
- Buat dua klip baru:
  clipA = { ...clip, end: atTime, outPoint: clip.inPoint + splitOffset }
  clipB = { ...clip, id: nanoid(), start: atTime, inPoint: clip.inPoint + splitOffset }
- Hapus clip asli, tambahkan clipA dan clipB ke track
- Push ke history untuk undo

Di UI:
- Saat playhead berada di atas klip, tampilkan visual indicator (highlight klip)
- Setelah split: kedua klip bisa digeser independen
- Shortcut keyboard: S untuk split di posisi playhead

Buat fungsi helper findClipAtTime(trackId, time) → return clip atau null.
```

---

## Prompt untuk Codex — PART 2D: Trim (Resize Handle)

```
Implementasikan trim in/out point di Clip.jsx (komponen klip di timeline).

Tampilan Clip:
- Div dengan background warna track (biru untuk video, hijau untuk audio)
- Kiri: resize handle (div 8px lebar, cursor: ew-resize)
- Kanan: resize handle
- Tengah: thumbnail strip atau nama file, bisa di-drag untuk pindah posisi

Trim kiri (ubah inPoint):
onMouseDown di handle kiri:
  - Mulai drag mode 'trim-left'
  - onMouseMove: 
    delta = (mouseX - startX) / pixelsPerSecond
    newInPoint = clip.inPoint + delta (min: 0)
    newStart = clip.start + delta
    Jangan boleh newStart < 0 atau inPoint > outPoint
  - onMouseUp: panggil projectStore.trimClip(clipId, { inPoint: newInPoint, start: newStart })

Trim kanan (ubah outPoint):
  - Sama tapi ubah outPoint dan end
  - Jangan boleh outPoint > mediaDuration

Pindah klip (drag tengah):
  - onMouseDown di tengah: mulai drag mode 'move'
  - onMouseMove: hitung newStart, cegah tumpang tindih dengan klip lain
  - onMouseUp: panggil projectStore.moveClip(clipId, newStart)

Visual feedback:
- Saat drag trim: tampilkan tooltip dengan durasi baru dan timecode
- Snap ke playhead, ke awal/akhir klip lain (jarak < 5px = snap)
- Magnetic snap bisa di-toggle dari toolbar
```

---

## Prompt untuk Codex — PART 2E: Freeze Frame

```
Implementasikan fitur Freeze Frame menggunakan FFmpeg.wasm.

Setup FFmpeg (ffmpegHelper.js):
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();
export async function initFFmpeg() {
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
}

Fungsi extractFrame(videoFile, timeInSeconds) → return ImageFile:
  await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile));
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-ss', String(timeInSeconds),
    '-frames:v', '1',
    '-q:v', '2',
    'frame.jpg'
  ]);
  const data = ffmpeg.readFile('frame.jpg');
  return new File([data.buffer], 'freeze_frame.jpg', { type: 'image/jpeg' });

Alur Freeze Frame di UI:
1. User klik kanan pada klip → context menu → "Freeze Frame di Posisi Ini"
   ATAU: posisikan playhead, klik tombol freeze di toolbar
2. Ambil currentTime dari playbackStore
3. Panggil extractFrame(clip.file, currentTime - clip.start + clip.inPoint)
4. Tambahkan hasil sebagai media baru di mediaStore
5. Insert klip gambar baru di timeline:
   - Posisi: tepat di currentTime
   - Durasi default: 3 detik
   - Klip setelahnya digeser ke kanan (ripple insert)
6. Tampilkan loading spinner saat FFmpeg memproses

Buat komponen FreezeFrameModal untuk konfirmasi durasi sebelum insert.
```

---

## Prompt untuk Codex — PART 2F: Export Video

```
Implementasikan export video menggunakan FFmpeg.wasm.

Buat ExportModal.jsx:
1. Opsi export:
   - Resolusi: 480p | 720p | 1080p | 4K
   - Format: MP4 (H.264) | WebM (VP9)
   - FPS: 24 | 30 | 60
   - Quality: slider 1-100 (map ke CRF: 100=18, 1=51)
   - Audio: AAC | MP3 | tanpa audio

2. Tombol "Ekspor" → mulai proses

Pipeline export (exportProject.js):
Karena Web tidak bisa composite langsung, gunakan pendekatan:

Tahap 1 - Render ke Canvas:
  Buat OffscreenCanvas sesuai resolusi output
  Loop frame by frame (1/fps detik per step):
    - Untuk setiap frame time:
      - Cari klip aktif di semua track video
      - Seek masing-masing video element ke posisi yang sesuai
      - drawImage ke canvas berlapis (track bawah dulu)
      - Aplikasikan efek/filter jika ada (Part 5)
    - Ambil frame: canvas.captureStream() 

Tahap 2 - Rekam dengan MediaRecorder:
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  Kumpulkan chunks, saat selesai: new Blob(chunks)

Tahap 3 - Convert ke MP4 (jika dipilih):
  Kirim blob ke FFmpeg.wasm:
  ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-crf', String(crf), 'output.mp4'])

Tahap 4 - Download:
  const url = URL.createObjectURL(outputBlob);
  const a = document.createElement('a');
  a.href = url; a.download = `${projectName}.mp4`; a.click();

Tampilkan progress bar (FFmpeg emit 'progress' event).
Estimasi waktu tersisa berdasarkan progress.
```

---

## Prompt untuk Codex — PART 2G: Undo/Redo

```
Implementasikan sistem Undo/Redo di projectStore.js.

Sistem berbasis snapshot (immutable history):
- history: array of snapshots (deep clone dari { tracks, duration })
- historyIndex: pointer ke snapshot aktif
- Setiap action editing (addClip, removeClip, moveClip, trimClip, splitClip, dll)
  harus memanggil pushHistory() SEBELUM mengubah state

pushHistory():
  // Hapus "future" jika ada (redo tidak relevan lagi)
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(deepClone({ tracks, duration }));
  if (newHistory.length > 50) newHistory.shift(); // batasi 50
  set({ history: newHistory, historyIndex: newHistory.length - 1 });

undo():
  if (historyIndex <= 0) return;
  const prev = history[historyIndex - 1];
  set({ ...prev, historyIndex: historyIndex - 1 });

redo():
  if (historyIndex >= history.length - 1) return;
  const next = history[historyIndex + 1];
  set({ ...next, historyIndex: historyIndex + 1 });

Keyboard shortcuts (di App.jsx dengan useEffect):
  Ctrl+Z → undo()
  Ctrl+Shift+Z atau Ctrl+Y → redo()

Tampilkan tombol undo/redo di TopBar dengan disabled state jika tidak bisa.
```

---

## Checklist Part 2

- [ ] Import: file picker buka, thumbnail ter-generate
- [ ] Import: drag & drop dari OS ke app berfungsi
- [ ] Drag ke timeline: klip muncul di posisi yang benar
- [ ] Snap: klip snap ke klip lain dan ke playhead
- [ ] Cut: S key split klip di posisi playhead
- [ ] Trim kiri: resize handle ubah inPoint
- [ ] Trim kanan: resize handle ubah outPoint
- [ ] Freeze frame: frame ter-extract dan insert ke timeline
- [ ] Export: modal terbuka, progress bar tampil, file terdownload
- [ ] Undo: Ctrl+Z balik operasi terakhir
- [ ] Redo: Ctrl+Shift+Z ulangi operasi

---

## Catatan Penting

- FFmpeg.wasm butuh `SharedArrayBuffer` → server harus kirim header:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
  Di Vite: tambahkan di `vite.config.js` plugin server headers.

- Export untuk video panjang (>5 menit) bisa sangat lambat di browser.
  Tampilkan peringatan ke user.

- Untuk proxy: saat import video >1080p, auto-generate versi 480p untuk preview,
  gunakan versi asli saat export.

---

*Lanjut ke PART 3: Audio editing, Text overlay, Transisi*
