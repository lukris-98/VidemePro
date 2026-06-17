# CapCut Clone — PART 4: Efek Video, Color Grading, Filter, Stiker

> **Prasyarat**: Part 1–3 selesai.
> Fokus Part 4: manipulasi visual — CSS/Canvas filter, color grading, stiker animasi.

---

## Fitur yang Dibangun di Part 4

| Fitur | Implementasi |
|-------|-------------|
| Filter preset (Vivid, Matte, B&W, dll) | Canvas `filter` property |
| Color grading manual | Brightness/Contrast/Saturation/Hue via CanvasRenderingContext2D |
| Crop & Rotate | Canvas transform |
| Stiker / overlay gambar | Canvas drawImage berlapis |
| Blur & Vignette | Canvas compositing |
| Stabilisasi (badge Stab) | Placeholder FFmpeg vidstab |
| Background remover | AI via remove.bg API atau MediaPipe |

---

## Prompt untuk Codex — PART 4A: Filter System

```
Buat sistem filter video yang bisa diapply ke klip di timeline.

Setiap klip video menyimpan:
{
  filters: {
    preset: 'none',          // nama preset filter
    brightness: 0,           // -100 to 100
    contrast: 0,
    saturation: 0,
    hue: 0,                  // -180 to 180 derajat
    sharpness: 0,            // 0 to 100
    vignette: 0,             // 0 to 100 intensitas
    temperature: 0,          // -100 warm/cool
    tint: 0,                 // -100 to 100 green/magenta
    exposure: 0,
  }
}

Preset filter (presets.js):
export const filterPresets = {
  none:    { brightness: 0, contrast: 0, saturation: 0 },
  vivid:   { brightness: 10, contrast: 20, saturation: 30 },
  matte:   { brightness: 5, contrast: -10, saturation: -20 },
  bw:      { saturation: -100 },
  vintage: { brightness: -5, saturation: -30, hue: 20, temperature: -20 },
  cool:    { temperature: 30 },
  warm:    { temperature: -30 },
  cinematic: { contrast: 15, saturation: -15, brightness: -5 },
  fade:    { brightness: 15, contrast: -15, saturation: -30 },
}

Aplikasikan filter saat renderFrame():
  ctx.filter = buildCSSFilter(clip.filters)
  // buildCSSFilter() → string: "brightness(1.1) contrast(1.2) saturate(1.3)"
  ctx.drawImage(videoElement, 0, 0, canvasW, canvasH)
  ctx.filter = 'none'

Untuk hue, temperature, tint (tidak ada di CSS filter standard):
  Gunakan ImageData manipulation:
  const imageData = ctx.getImageData(...)
  Looping pixel, apply matrix color transform
  ctx.putImageData(...)
  (Ini lambat — optimalkan dengan WebGL jika perlu)

Di RightPanel (tab "Efek"):
  - Grid preset filter dengan preview thumbnail
  - Klik preset → apply ke selected clip
  - Slider individual di bawah preset
```

---

## Prompt untuk Codex — PART 4B: Color Grading Panel

```
Buat ColorGradingPanel.jsx di RightPanel untuk adjustment manual.

UI:
1. Histogram display (canvas 200x80):
   Ambil frame saat ini, hitung distribusi R/G/B/Luma
   Gambar grafik batang tipis, warna sesuai channel

2. Wheels (opsional — bisa slider dulu):
   Lift (shadows), Gamma (midtones), Gain (highlights)
   Implementasikan sebagai circular color picker atau 3 slider RGB per rentang

3. Slider controls:
   - Exposure: -5 to +5 EV
   - Contrast: -100 to +100
   - Highlights: -100 to +100
   - Shadows: -100 to +100
   - Whites: -100 to +100
   - Blacks: -100 to +100
   - Clarity: 0 to +100 (local contrast)
   - Vibrance: -100 to +100 (saturasi selektif)
   - Saturation: -100 to +100

4. Curves editor (canvas interaktif):
   Buat CurvesEditor.jsx:
   - Canvas 200x200, grid diagonal
   - Default: garis lurus dari (0,0) ke (200,200)
   - Click untuk tambah control point, drag untuk adjust
   - Tab: RGB | R | G | B
   - Interpolasi cubic Bezier antar control points
   - Apply: konversi kurva ke lookup table (LUT) 256 values
     Saat render: remap setiap pixel value via LUT

Tombol "Reset" untuk reset semua ke default.
Simpan settings ke clip.colorGrading object.
```

---

## Prompt untuk Codex — PART 4C: Crop & Rotate & Flip

```
Implementasikan Crop, Rotate, dan Flip untuk klip video.

Simpan di clip.transform:
{
  cropX: 0,          // 0-1, relatif lebar video
  cropY: 0,
  cropW: 1,
  cropH: 1,
  rotation: 0,       // derajat, -180 to 180
  scaleX: 1,
  scaleY: 1,
  flipH: false,
  flipV: false,
  posX: 0,           // offset pusat, -1 to 1
  posY: 0,
}

Saat renderFrame():
  ctx.save()
  ctx.translate(centerX + posX * canvasW/2, centerY + posY * canvasH/2)
  ctx.rotate(rotation * Math.PI / 180)
  ctx.scale(scaleX * (flipH ? -1 : 1), scaleY * (flipV ? -1 : 1))
  // Crop source region:
  ctx.drawImage(
    videoElement,
    crop.x * videoW, crop.y * videoH,   // source x,y
    crop.w * videoW, crop.h * videoH,   // source w,h
    -canvasW/2, -canvasH/2,             // dest x,y (centered)
    canvasW, canvasH                    // dest w,h
  )
  ctx.restore()

CropOverlay.jsx (overlay di preview canvas saat mode crop aktif):
  - Tampilkan handles di 4 sudut dan 4 sisi tengah
  - Grid rule-of-thirds overlay
  - Drag handle → update cropX/Y/W/H secara real-time
  - Tombol: Free | 16:9 | 9:16 | 1:1 | 4:3 | Custom ratio
  - Tombol konfirmasi "✓" atau "✗" untuk apply/cancel

Di RightPanel:
  - Input angka untuk rotation
  - Tombol Flip H / Flip V
  - Preset ratio buttons
```

---

## Prompt untuk Codex — PART 4D: Stiker & Overlay Gambar

```
Buat sistem stiker dan gambar overlay.

Track stiker adalah track tipe 'overlay' (mirip text track tapi berisi gambar).

Stiker clip:
{
  id, trackId, start, end,
  src: 'url-atau-dataurl',    // gambar stiker
  posX: 0.5, posY: 0.5,      // 0-1 posisi relatif
  scaleX: 0.2, scaleY: 0.2,  // ukuran relatif terhadap video
  rotation: 0,
  opacity: 1,
  animation: 'none',          // sama seperti text: fadeIn, bounce, dll
  animDuration: 0.5,
}

Sumber stiker:
1. Built-in stiker: array PNG/SVG bundled di assets/stickers/
   Kategori: emoji, arrow, shape, decoration, badge
   Tampilkan grid di LeftPanel tab "Stiker"

2. Upload gambar sendiri (lewat MediaImporter)

Render di renderFrame():
  ctx.save()
  ctx.globalAlpha = sticker.opacity * animOpacity
  ctx.translate(sticker.posX * canvasW, sticker.posY * canvasH)
  ctx.rotate(sticker.rotation * Math.PI/180)
  ctx.scale(sticker.scaleX, sticker.scaleY)
  ctx.drawImage(stickerImage, -imageW/2, -imageH/2)
  ctx.restore()

Interaksi di preview:
  Klik stiker di canvas → select (tampilkan transform handles)
  Drag untuk pindah posisi
  Scroll untuk resize
  Tombol delete untuk hapus
```

---

## Prompt untuk Codex — PART 4E: Blur & Vignette

```
Implementasikan efek Blur dan Vignette.

1. Blur (per klip):
   clip.effects.blur = 0-20 (pixel radius)

   Render:
   ctx.filter = `blur(${clip.effects.blur}px)`
   ctx.drawImage(video, ...)
   ctx.filter = 'none'

   Partial blur (mosaic/face blur):
   - User bisa gambar region di preview
   - Simpan array blurRegions: [{ x, y, w, h, intensity, type: 'blur'|'pixelate' }]
   - Render: drawImage full, lalu untuk setiap region:
     getImageData region → pixelate atau blur → putImageData

2. Vignette:
   clip.effects.vignette = { intensity: 0, softness: 0.5 }

   Render setelah drawImage:
   const gradient = ctx.createRadialGradient(
     canvasW/2, canvasH/2, canvasW * (1 - vignette.softness),
     canvasW/2, canvasH/2, canvasW
   )
   gradient.addColorStop(0, 'transparent')
   gradient.addColorStop(1, `rgba(0,0,0,${vignette.intensity})`)
   ctx.fillStyle = gradient
   ctx.fillRect(0, 0, canvasW, canvasH)

3. Glitch effect (bonus):
   Setiap beberapa frame: offset drawImage secara random di X/Y ±20px
   Tambahkan channel shift: drawImage 3x dengan blending untuk R/G/B offset

Di RightPanel tab "Efek":
- Accordion: Blur | Vignette | Glitch | Noise | Grain
- Setiap efek punya toggle on/off dan slider intensitas
```

---

## Prompt untuk Codex — PART 4F: Stabilisasi (Badge "Stab")

```
Buat placeholder fitur stabilisasi video.

Di RightPanel atau context menu klip:
Tombol "Stabilkan" → tampilkan StabilizeModal.jsx

StabilizeModal:
- Slider "Kekuatan stabilisasi": 0-100
- Slider "Crop tambahan": 0-20% (stabilisasi selalu sedikit crop)
- Tombol "Analisis & Terapkan"

Implementasi (dua opsi):

OPSI A - FFmpeg vidstab (jika tersedia):
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', 'vidstabdetect=shakiness=5:show=1',
    '-f', 'null', '-'
  ])
  await ffmpeg.exec([
    '-i', 'input.mp4',
    '-vf', `vidstabtransform=smoothing=30:crop=black`,
    'stabilized.mp4'
  ])
  // Ganti clip.mediaUrl dengan output stabilized

OPSI B - Placeholder (tampilkan loading lalu badge "Stab"):
  Simulasikan proses 3 detik dengan progress bar
  Set clip.stabilized = true
  Tampilkan badge "Stab" kuning di klip di timeline
  Tampilkan pesan: "Fitur stabilisasi penuh membutuhkan FFmpeg vidstab plugin"

Badge "Stab" di Clip.jsx:
  {clip.stabilized && (
    <span className="badge-stab">Stab</span>
  )}
```

---

## Checklist Part 4

- [ ] Filter preset (Vivid, B&W, dll) tampil di preview
- [ ] Slider brightness/contrast/saturation berfungsi real-time
- [ ] Crop tool dengan handles berfungsi, ratio preset 16:9
- [ ] Rotate dan flip klip tampil di preview
- [ ] Stiker bisa ditambah dari panel, tampil di preview
- [ ] Stiker bisa di-drag di canvas preview untuk posisikan
- [ ] Blur effect tampil di preview
- [ ] Vignette effect tampil di preview
- [ ] Badge "Stab" tampil di klip yang distabilkan

---

*Lanjut ke PART 5: AI Features (Background remove, Auto-caption, Face tracking)*
