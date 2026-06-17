# CapCut Clone — PART 3: Audio, Text Overlay, Transisi

> **Prasyarat**: Part 1 + Part 2 selesai.
> Fokus Part 3: audio editing, teks animasi, dan efek transisi antar klip.

---

## Fitur yang Dibangun di Part 3

| Fitur | Keterangan |
|-------|-----------|
| Audio track & waveform | Web Audio API + Canvas waveform renderer |
| Volume & fade in/out | GainNode per klip |
| Teks / caption overlay | Canvas 2D text rendering |
| Animasi teks | Preset animasi (fade, slide, typewriter) |
| Transisi | Cross-dissolve, slide, wipe antar klip video |
| Speed control | Playback rate per klip |
| Mute/solo track | Per-track audio control |

---

## Prompt untuk Codex — PART 3A: Audio Track & Waveform

```
Tambahkan audio track support dan visualisasi waveform ke timeline.

1. Saat media audio/video diimport, generate waveform data:
   Fungsi generateWaveform(file) di audioHelper.js:
   - Decode file dengan AudioContext.decodeAudioData()
   - Ambil channel data: audioBuffer.getChannelData(0)
   - Downsample ke 1000 titik: loop setiap (totalSamples/1000), ambil max abs value
   - Return: Float32Array berisi 1000 nilai 0-1
   - Cache di mediaStore item: item.waveformData

2. Render waveform di klip audio di timeline (AudioClip.jsx):
   - Canvas ukuran clip width x track height
   - Background: #1a3a2a (hijau gelap untuk audio)
   - Gambar batang waveform: fillRect per titik, tinggi = value * canvasHeight
   - Warna batang: #4ade80
   - Update saat klip di-zoom (re-render canvas)

3. Playback audio:
   - Buat AudioContext satu kali di playbackStore
   - Untuk setiap audio klip aktif saat play:
     AudioContext.createBufferSource() → GainNode → destination
     source.start(audioContext.currentTime, clip.inPoint + offset)
   - Saat pause: source.stop() semua
   - Sinkronisasi dengan video via AudioContext.currentTime

4. Track controls di label kiri:
   - Toggle Mute (M): set track.muted = true → GainNode.gain = 0
   - Toggle Solo (S): mute semua track lain
   - Volume slider: GainNode.gain.value = 0 sampai 2
```

---

## Prompt untuk Codex — PART 3B: Volume & Fade

```
Implementasikan kontrol volume dan fade in/out per klip audio.

Di RightPanel saat klip audio dipilih, tampilkan:
1. Volume slider: 0% - 200%
2. Tombol "Fade In": input durasi (0.1 - 5 detik)
3. Tombol "Fade Out": input durasi
4. Checkbox "Normalize audio"

Simpan di clip object:
{
  volume: 1.0,           // multiplier
  fadeIn: 0,             // detik
  fadeOut: 0,
}

Implementasi fade dengan AudioContext:
Saat play klip dengan fadeIn > 0:
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(clip.volume, startTime + clip.fadeIn);

Saat mendekati akhir klip dengan fadeOut > 0:
  gainNode.gain.setValueAtTime(clip.volume, endTime - clip.fadeOut);
  gainNode.gain.linearRampToValueAtTime(0, endTime);

Di timeline, tampilkan visual gradient overlay di ujung klip:
- Fade in: gradient transparan → warna solid di sisi kiri klip
- Fade out: gradient warna solid → transparan di sisi kanan
```

---

## Prompt untuk Codex — PART 3C: Text Overlay

```
Implementasikan teks overlay yang bisa ditambahkan ke timeline.

Tambah track teks (type: 'text') di projectStore.
Klip teks memiliki property:
{
  id, trackId, start, end,
  text: 'Hello World',
  fontFamily: 'Arial',
  fontSize: 48,           // dalam pixel di resolusi 1080p
  fontWeight: 'bold',
  color: '#ffffff',
  backgroundColor: 'transparent',
  padding: 8,
  align: 'center',        // left|center|right
  posX: 0.5,             // 0-1 (relatif terhadap lebar video)
  posY: 0.85,            // 0-1 (relatif terhadap tinggi video)
  animation: 'none',      // none|fadeIn|slideUp|slideDown|typewriter
  animDuration: 0.5,      // detik untuk animasi masuk
}

Render teks di PreviewPlayer (dalam renderFrame()):
  Hitung apakah ada text clip aktif di currentTime
  Untuk setiap text clip aktif:
    ctx.font = `${clip.fontWeight} ${clip.fontSize}px ${clip.fontFamily}`
    ctx.fillStyle = clip.color
    ctx.textAlign = clip.align
    Hitung animasi (opacity/posisi) berdasarkan elapsed time sejak clip.start
    ctx.fillText(clip.text, x, y)

TextEditor di RightPanel:
- Input field untuk teks
- Font picker (dropdown list font web-safe + Google Fonts populer)
- Color picker
- Size slider
- Animasi preset (dropdown)
- Tombol "Align" (kiri/tengah/kanan/atas/bawah)

Drag teks di canvas preview untuk ubah posX/posY secara intuitif.
```

---

## Prompt untuk Codex — PART 3D: Animasi Teks

```
Implementasikan preset animasi teks untuk text clips.

Buat animationPresets.js:

export const presets = {
  fadeIn: (progress) => ({ opacity: progress }),        // 0→1
  fadeOut: (progress) => ({ opacity: 1 - progress }),   // 1→0

  slideUp: (progress) => ({                              // masuk dari bawah
    opacity: progress,
    offsetY: (1 - progress) * 50
  }),

  slideDown: (progress) => ({
    opacity: progress,
    offsetY: -(1 - progress) * 50
  }),

  typewriter: (progress, text) => ({
    visibleChars: Math.floor(progress * text.length)
  }),

  bounce: (progress) => ({
    scale: 1 + Math.sin(progress * Math.PI) * 0.1
  }),

  zoomIn: (progress) => ({
    scale: progress,
    opacity: progress
  }),
}

Dalam renderFrame() untuk text clips:
  const elapsed = currentTime - clip.start;
  const animPhase = Math.min(elapsed / clip.animDuration, 1);
  const preset = presets[clip.animation] || presets.fadeIn;
  const { opacity=1, offsetY=0, scale=1, visibleChars } = preset(animPhase, clip.text);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y + offsetY);
  ctx.scale(scale, scale);
  const displayText = visibleChars !== undefined ? clip.text.slice(0, visibleChars) : clip.text;
  ctx.fillText(displayText, 0, 0);
  ctx.restore();

Tampilkan preview animasi real-time di TextEditor panel saat user ganti preset.
```

---

## Prompt untuk Codex — PART 3E: Transisi Antar Klip

```
Implementasikan efek transisi antara dua klip video berurutan.

Data transisi disimpan di dalam klip:
clip.transition = {
  type: 'crossDissolve',  // crossDissolve|fadeToBlack|slideLeft|slideRight|wipeLeft|wipe|none
  duration: 0.5,           // detik (overlap antara dua klip)
}

Logika: saat klip A berakhir dan klip B mulai, overlap selama transition.duration.
Timeline visual: tampilkan badge kecil di sambungan dua klip (icon transisi + durasi).

Render transisi di renderFrame():
  Cek apakah currentTime berada dalam rentang transisi antara clipA dan clipB
  progress = (currentTime - transitionStart) / transition.duration  // 0→1

  switch(transition.type):
    'crossDissolve':
      drawImage(clipA frame, full canvas) dengan alpha = 1 - progress
      drawImage(clipB frame, full canvas) dengan alpha = progress

    'fadeToBlack':
      if progress < 0.5:
        drawImage(clipA frame), fillRect hitam dengan alpha = progress*2
      else:
        fillRect hitam
        drawImage(clipB frame) dengan alpha = (progress-0.5)*2

    'slideLeft':
      drawImage(clipA frame, offsetX = -progress * canvasWidth, ...)
      drawImage(clipB frame, offsetX = (1-progress) * canvasWidth, ...)

    'wipeLeft':
      drawImage(clipA frame)
      // clip region untuk klip B
      ctx.save()
      ctx.rect(0, 0, progress * canvasWidth, canvasHeight)
      ctx.clip()
      drawImage(clipB frame)
      ctx.restore()

UI: klik sambungan antar klip di timeline → buka TransitionPicker panel
  Grid icon transisi, klik untuk apply, preview real-time di player.
```

---

## Prompt untuk Codex — PART 3F: Speed Control

```
Implementasikan speed control per klip video.

Di RightPanel saat video klip dipilih:
- Slider speed: 0.1x - 4.0x (nilai: 0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0, 4.0)
- Tampilkan label: "Lambat" untuk <1, "Normal" untuk 1, "Cepat" untuk >1
- Checkbox: "Pertahankan pitch audio" (gunakan AudioContext detune)

Simpan di clip: { speed: 1.0, preservePitch: true }

Efek pada timeline:
- Lebar klip berubah: clipWidth = (clip.outPoint - clip.inPoint) / clip.speed * pixelsPerSecond
- Tampilkan badge kecepatan di klip (mis. "0.5x")

Saat render frame:
  mediaTime = clip.inPoint + (currentTime - clip.start) * clip.speed
  videoElement.currentTime = mediaTime

Saat playback audio:
  source.playbackRate.value = clip.speed
  if (clip.preservePitch):
    // Web Audio tidak punya built-in pitch preserve
    // Tampilkan peringatan bahwa fitur ini butuh FFmpeg processing
    // Atau gunakan library: soundtouch-js

Untuk slow motion ekstrem (0.1x-0.25x):
  Tampilkan opsi "Optical Flow Interpolation" (placeholder untuk Part 5 AI features).
```

---

## Prompt untuk Codex — PART 3G: Keyboard Shortcuts System

```
Buat sistem keyboard shortcut terpusat di useKeyboardShortcuts.js.

Gunakan useEffect dengan event listener 'keydown' di document.
Buat map shortcut:

const shortcuts = {
  'Space':           () => playbackStore.togglePlay(),
  'KeyS':            () => splitClipAtPlayhead(),
  'Delete':          () => deleteSelectedClip(),
  'Backspace':       () => deleteSelectedClip(),
  'ArrowLeft':       () => movePlayhead(-1/fps),        // 1 frame mundur
  'ArrowRight':      () => movePlayhead(1/fps),         // 1 frame maju
  'Shift+ArrowLeft': () => movePlayhead(-1),             // 1 detik mundur
  'Shift+ArrowRight':() => movePlayhead(1),              // 1 detik maju
  'Ctrl+Z':          () => projectStore.undo(),
  'Ctrl+Shift+Z':    () => projectStore.redo(),
  'Ctrl+C':          () => copySelectedClip(),
  'Ctrl+V':          () => pasteClip(),
  'Ctrl+D':          () => duplicateSelectedClip(),
  'Ctrl+A':          () => selectAllClips(),
  'Escape':          () => uiStore.deselectAll(),
  'Ctrl+Equal':      () => uiStore.zoomIn(),
  'Ctrl+Minus':      () => uiStore.zoomOut(),
  'Ctrl+0':          () => uiStore.fitToWindow(),
  'KeyM':            () => muteSelectedTrack(),
  'KeyI':            () => setInPoint(currentTime),     // trim marker
  'KeyO':            () => setOutPoint(currentTime),
}

Blokir shortcuts saat user sedang mengetik di input/textarea.
Tampilkan tooltip shortcut saat hover tombol toolbar (setelah 1.5 detik).
Buat komponen ShortcutHelp.jsx yang muncul saat tekan '?' — tabel semua shortcuts.
```

---

## Checklist Part 3

- [ ] Audio waveform tampil di klip audio di timeline
- [ ] Audio playback sync dengan video saat play
- [ ] Volume slider mengubah kekerasan audio
- [ ] Fade in/out visual gradient tampil di klip
- [ ] Teks bisa ditambah ke timeline, render di preview
- [ ] Drag teks di preview untuk ubah posisi
- [ ] Animasi teks (fadeIn, slideUp) berjalan saat preview
- [ ] Transisi cross-dissolve tampil di preview
- [ ] Transisi bisa dipilih dari picker panel
- [ ] Speed control 0.5x dan 2x berfungsi
- [ ] Spacebar untuk play/pause
- [ ] Semua keyboard shortcuts berjalan

---

*Lanjut ke PART 4: Efek video, Color grading, Stiker, Filter*
