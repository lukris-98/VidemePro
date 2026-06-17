# CapCut Clone — PART 9: Advanced Export, Multi-format, Social Media

> **Prasyarat**: Part 1–8 selesai.
> Fokus Part 9: export pipeline lengkap, format beragam, share ke platform sosial.

---

## Fitur yang Dibangun di Part 9

| Fitur | Keterangan |
|-------|-----------|
| Export preset per platform | YouTube, Instagram, TikTok, WhatsApp Status |
| Batch export | Export beberapa format sekaligus |
| Export audio saja | MP3/AAC/WAV |
| Export frame sequence | PNG/JPG per frame |
| Share to clipboard | Copy video ke clipboard |
| Watermark/branding | Logo overlay saat export |
| Export queue | Antrian export dengan priority |
| Progress yang akurat | Per-frame progress tracking |

---

## Prompt untuk Codex — PART 9A: Platform Export Presets

```
Buat sistem preset export untuk berbagai platform media sosial.

Buat exportPresets.js:
export const exportPresets = {
  youtube_1080p: {
    name: 'YouTube 1080p',
    icon: '▶',
    width: 1920, height: 1080,
    fps: 30,
    videoBitrate: '8000k',
    audioBitrate: '192k',
    format: 'mp4',
    codec: 'libx264',
    audioCodec: 'aac',
    crf: 18,
    maxFileSize: null,
    description: 'Kualitas terbaik untuk YouTube',
  },
  youtube_4k: {
    name: 'YouTube 4K',
    width: 3840, height: 2160,
    fps: 60, crf: 18, format: 'mp4',
  },
  instagram_feed: {
    name: 'Instagram Feed',
    width: 1080, height: 1080,
    fps: 30, crf: 23, format: 'mp4',
    maxDuration: 60,
    maxFileSize: 100 * 1024 * 1024,  // 100MB
  },
  instagram_reels: {
    name: 'Instagram Reels',
    width: 1080, height: 1920,
    fps: 30, crf: 23, format: 'mp4',
    maxDuration: 90,
  },
  tiktok: {
    name: 'TikTok',
    width: 1080, height: 1920,
    fps: 30, crf: 23, format: 'mp4',
    maxDuration: 600,
    maxFileSize: 287 * 1024 * 1024,
  },
  whatsapp_status: {
    name: 'WhatsApp Status',
    width: 1080, height: 1920,
    fps: 25, crf: 28, format: 'mp4',
    maxDuration: 30,
    maxFileSize: 16 * 1024 * 1024,  // 16MB
  },
  twitter: {
    name: 'Twitter/X',
    width: 1280, height: 720,
    fps: 40, crf: 23, format: 'mp4',
    maxDuration: 140,
    maxFileSize: 512 * 1024 * 1024,
  },
  gif: {
    name: 'Animated GIF',
    width: 480, height: 270,
    fps: 15, format: 'gif',
    maxDuration: 30,
    palette: true,  // FFmpeg palette trick untuk kualitas GIF bagus
  },
}

ExportModal.jsx — redesign dengan preset tabs:
  Tabs: Platform | Kustom
  
  Platform tab:
    Grid cards preset (icon platform + nama + resolusi)
    Klik untuk select preset
    Info: max durasi, max file size, resolusi
    Peringatan jika proyek melebihi batasan platform
  
  Kustom tab:
    Form manual: resolusi, fps, bitrate, format
  
  Tombol "Ekspor" di bawah, tampilkan estimasi file size.
```

---

## Prompt untuk Codex — PART 9B: Accurate Export Progress

```
Perbaiki export progress agar akurat per-frame.

Masalah sebelumnya: progress FFmpeg tidak linear dan tidak informatif.

Implementasi baru:

1. Hitung total frames terlebih dahulu:
   const totalFrames = Math.ceil(projectDuration * exportFps)

2. Dua fase export dengan progress terpisah:

FASE 1 - Render frames ke canvas (bisa hitung akurat):
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const time = frameIndex / exportFps
    renderFrameAt(time)  // set semua video currentTime, drawImage, effects
    const frameBlob = await canvasToBlob(exportCanvas)
    frames.push(frameBlob)
    
    const progress = (frameIndex / totalFrames) * 50  // 0-50%
    updateProgress(progress, `Render frame ${frameIndex}/${totalFrames}`)
    
    // Yield ke event loop setiap 10 frame agar UI tidak freeze
    if (frameIndex % 10 === 0) await sleep(0)
  }

FASE 2 - FFmpeg encode:
  ffmpeg.on('progress', ({ progress }) => {
    const totalProgress = 50 + progress * 50  // 50-100%
    updateProgress(totalProgress, `Encoding... ${Math.round(totalProgress)}%`)
  })

ExportProgressModal.jsx:
  - Progress bar dua warna: biru untuk render, hijau untuk encode
  - Label fase aktif
  - Estimasi waktu tersisa (hitung dari average frame time)
  - Preview thumbnail dari frame terakhir yang dirender
  - Tombol "Batalkan" dengan cleanup (hapus file temp FFmpeg)
  - Setelah selesai: tampilkan file size, durasi proses, tombol "Download" + "Share"
```

---

## Prompt untuk Codex — PART 9C: Export Audio Only & Frame Sequence

```
Tambahkan opsi export audio saja dan frame sequence.

EXPORT AUDIO:
Tombol "Ekspor Audio" di ExportModal (tab Audio):

Options:
  - Format: MP3 | AAC | WAV | FLAC | OGG
  - Bitrate: 128 | 192 | 256 | 320 kbps (untuk lossy)
  - Sample rate: 44100 | 48000 Hz
  - Channels: Mono | Stereo

Pipeline:
  1. Mix semua audio tracks ke AudioBuffer menggunakan OfflineAudioContext:
     const offline = new OfflineAudioContext(2, sampleRate * duration, sampleRate)
     
     audioClips.forEach(clip => {
       const source = offline.createBufferSource()
       source.buffer = clip.audioBuffer
       source.playbackRate.value = clip.speed
       const gain = offline.createGain()
       gain.gain.value = clip.volume
       // Apply fade in/out
       source.connect(gain).connect(offline.destination)
       source.start(clip.start, clip.inPoint)
       source.stop(clip.end)
     })
     
     const mixedBuffer = await offline.startRendering()
  
  2. Encode via FFmpeg.wasm ke format yang dipilih
  3. Download hasil

EXPORT FRAME SEQUENCE:
Options:
  - Format: PNG | JPEG
  - Range: Semua frame | Dari-sampai | Setiap N detik
  - Naming: frame_001.png, frame_002.png, ...
  - Quality (JPEG): 60-100

Pipeline:
  1. Loop per frame (atau per interval)
  2. Render ke canvas
  3. canvas.toBlob() → simpan ke array
  4. Setelah selesai: zip semua dengan JSZip
  5. Download ZIP
  
Ini berguna untuk: membuat thumbnail YouTube, sprite sheet, NFT art.
```

---

## Prompt untuk Codex — PART 9D: Export Watermark / Branding

```
Tambahkan opsi watermark/branding saat export.

Di ExportModal tab "Branding":
clip-level watermark = overlay yang selalu tampil di semua frame export

WatermarkSettings:
{
  enabled: false,
  type: 'text',         // text | image
  text: 'My Channel',
  imageUrl: null,
  position: 'bottom-right', // top-left|top-right|bottom-left|bottom-right|center
  opacity: 0.7,
  scale: 0.1,           // relatif terhadap lebar video
  padding: 20,          // pixel dari tepi
  color: '#ffffff',
  fontSize: 32,
}

Render watermark dalam setiap frame saat export (SETELAH semua klip):
  const { x, y } = calculateWatermarkPosition(settings, canvasW, canvasH)
  
  if (settings.type === 'text') {
    ctx.save()
    ctx.globalAlpha = settings.opacity
    ctx.font = `${settings.fontSize}px Arial`
    ctx.fillStyle = settings.color
    // Drop shadow untuk readability
    ctx.shadowBlur = 4
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.fillText(settings.text, x, y)
    ctx.restore()
  } else if (settings.type === 'image' && watermarkImg) {
    ctx.save()
    ctx.globalAlpha = settings.opacity
    const w = canvasW * settings.scale
    const h = w * (watermarkImg.height / watermarkImg.width)
    ctx.drawImage(watermarkImg, x, y, w, h)
    ctx.restore()
  }

Preview watermark real-time di PreviewPlayer saat export modal terbuka dengan watermark aktif.
Opsi: "Sembunyikan watermark di preview" (hanya tampil saat export).
```

---

## Prompt untuk Codex — PART 9E: Export Queue

```
Buat sistem antrian export (Export Queue) untuk multiple exports.

Useful case: export satu proyek ke berbagai format sekaligus (1080p + 9:16 + GIF).

ExportQueueStore (exportQueueStore.js):
{
  queue: [
    {
      id: nanoid(),
      projectId,
      preset: 'youtube_1080p',
      status: 'pending',  // pending|processing|done|error
      progress: 0,
      filePath: null,
      error: null,
      createdAt,
    }
  ],
  currentJobId: null,
}

Actions:
  addToQueue(projectId, preset) → tambah job ke queue
  startNext() → ambil job pertama yang pending, mulai proses
  onJobProgress(id, progress) → update progress
  onJobDone(id, blobUrl) → mark done, simpan URL
  onJobError(id, error) → mark error
  removeFromQueue(id) → hapus job

ExportQueuePanel.jsx (panel slide-in dari kanan):
  List semua jobs:
    - Progress bar per job
    - Tombol download saat done
    - Tombol cancel saat processing
    - Tombol retry saat error
    - Tombol "Tambah format lain"

Tombol "Ekspor Multi-format" di ExportModal:
  Checkbox list preset yang tersedia
  Pilih beberapa sekaligus → semua masuk ke queue
  Proses satu per satu (tidak paralel, karena FFmpeg.wasm tidak thread-safe)
```

---

## Checklist Part 9

- [ ] Preset YouTube 1080p: export menghasilkan file yang bisa diplay
- [ ] Preset Instagram Reels (9:16): aspect ratio benar
- [ ] Peringatan muncul jika proyek melebihi max durasi platform
- [ ] Progress bar akurat per-frame (bukan estimasi kasar)
- [ ] Estimasi waktu tersisa tampil dan update
- [ ] Export audio: MP3 terdownload dengan audio yang benar
- [ ] Frame sequence: ZIP berisi PNG frames
- [ ] Watermark teks tampil di video hasil export
- [ ] Export queue: bisa tambah 2 job, proses satu per satu
- [ ] Cancel export: membersihkan file temp, bisa mulai lagi

---

*Lanjut ke PART 10: Final Polish, Testing, Deployment*
