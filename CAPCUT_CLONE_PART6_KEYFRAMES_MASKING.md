# CapCut Clone — PART 6: Keyframe Animation, Masking, Multi-track Lanjutan

> **Prasyarat**: Part 1–5 selesai.
> Fokus Part 6: animasi properti via keyframe, masking, picture-in-picture, dan multi-track advanced.

---

## Fitur yang Dibangun di Part 6

| Fitur | Keterangan |
|-------|-----------|
| Keyframe animation | Animasikan posisi, skala, opacity, filter sepanjang waktu |
| Masking (shape mask) | Sembunyikan bagian video dengan bentuk tertentu |
| Picture-in-Picture | Video kecil di atas video utama |
| Track compositing | Blend modes antar track (multiply, screen, overlay) |
| Motion path | Gerakkan elemen mengikuti jalur yang digambar |
| Chroma key | Green screen / blue screen removal |
| Dynamic text | Teks yang nilainya berubah (counter, timer) |

---

## Prompt untuk Codex — PART 6A: Keyframe System

```
Implementasikan sistem keyframe animation untuk semua properti animatable klip.

Data model keyframe:
clip.keyframes = {
  posX:     [{ time: 0, value: 0.5, easing: 'linear' }, { time: 2, value: 0.8, easing: 'easeInOut' }],
  posY:     [],
  scaleX:   [],
  scaleY:   [],
  rotation: [],
  opacity:  [],
  'filters.brightness': [],
  'filters.saturation': [],
  // dst semua properti animatable
}

Fungsi getValueAtTime(keyframes, time):
  if (keyframes.length === 0) return defaultValue
  if (time <= keyframes[0].time) return keyframes[0].value
  if (time >= keyframes.at(-1).time) return keyframes.at(-1).value
  
  // Cari dua keyframe yang mengapit time
  const prev = last keyframe where kf.time <= time
  const next = first keyframe where kf.time > time
  
  const t = (time - prev.time) / (next.time - prev.time)  // 0-1
  const easedT = applyEasing(t, prev.easing)
  return prev.value + (next.value - prev.value) * easedT

Fungsi applyEasing(t, type):
  switch(type):
    'linear':     return t
    'easeIn':     return t * t
    'easeOut':    return t * (2 - t)
    'easeInOut':  return t < 0.5 ? 2*t*t : -1+(4-2*t)*t
    'bounce':     // bounce formula
    'elastic':    // elastic formula

Di timeline, tampilkan keyframe marker:
  - Diamond kecil ◆ di bawah klip untuk setiap keyframe
  - Klik diamond → select dan edit nilai di panel
  - Drag diamond → pindah ke waktu lain

Keyframe Editor di RightPanel:
  - Saat properti punya keyframe, tampilkan tombol ◆ di samping nilai
  - Klik ◆ → tambah keyframe di currentTime dengan nilai saat ini
  - Klik ◆ lagi → hapus keyframe di currentTime
  - List semua keyframe: waktu + nilai + easing dropdown
  - Mini graph easing curve preview

Di renderFrame(): sebelum render klip, resolve semua properti via getValueAtTime()
```

---

## Prompt untuk Codex — PART 6B: Motion Path

```
Implementasikan motion path — animasikan posisi elemen mengikuti jalur kurva.

Ekstensi dari keyframe system untuk posX dan posY.

MotionPath.jsx (overlay di preview canvas):
  Tampilkan saat elemen teks/stiker/PiP dipilih dan mode "Motion Path" aktif

  Render:
  - Gambar garis menghubungkan semua posisi keyframe
  - Kurva Bezier antara titik jika lebih dari 2 keyframe
  - Titik kontrol Bezier bisa di-drag

  Interaksi:
  - Drag titik keyframe → update posX/posY keyframe
  - Double-click di jalur → tambah keyframe baru di posisi itu
  - Klik kanan keyframe point → hapus keyframe

  Render path di canvas:
  ctx.beginPath()
  ctx.moveTo(keyframes[0].screenX, keyframes[0].screenY)
  keyframes.forEach((kf, i) => {
    if (i === 0) return
    // Bezier curve ke titik berikutnya
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, kf.screenX, kf.screenY)
  })
  ctx.strokeStyle = 'rgba(77, 158, 255, 0.8)'
  ctx.setLineDash([5, 3])
  ctx.stroke()

Konversi koordinat: screenX/Y → posX/Y (0-1 relatif canvas) saat drag selesai.
```

---

## Prompt untuk Codex — PART 6C: Masking

```
Implementasikan shape masking untuk menyembunyikan bagian video.

clip.mask = {
  enabled: false,
  type: 'none',        // none | rectangle | circle | ellipse | path | image
  inverted: false,     // mask dalam atau luar
  feather: 0,          // blur tepi mask (0-50px)
  shape: {
    // untuk rectangle: { x, y, w, h } relatif 0-1
    // untuk circle: { cx, cy, r }
    // untuk path: array of {x, y} points (polygon)
  }
}

Render dengan masking:
  ctx.save()
  
  // Buat clipping path sesuai shape
  ctx.beginPath()
  if (mask.type === 'rectangle') {
    ctx.rect(mx, my, mw, mh)
  } else if (mask.type === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  } else if (mask.type === 'path') {
    ctx.moveTo(pts[0].x, pts[0].y)
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y))
    ctx.closePath()
  }
  
  if (mask.inverted) {
    // Full canvas rect dulu, lalu shape berlawanan arah
    ctx.rect(0, 0, canvasW, canvasH)  // outer rect
    // path sudah di dalam (even-odd fill rule)
    ctx.clip('evenodd')
  } else {
    ctx.clip()
  }
  
  // Feather via shadow blur
  if (mask.feather > 0) {
    // Render ke offscreen canvas, lalu blur
  }
  
  ctx.drawImage(videoElement, ...)
  ctx.restore()

MaskEditor.jsx (overlay di preview):
  - Toolbar: Rectangle | Circle | Freehand | Bezier Pen
  - Rectangle: drag untuk buat, handles di 8 titik untuk resize
  - Freehand: klik untuk titik, close path saat klik titik pertama
  - Semua shape bisa di-keyframe (animasi mask bergerak)
```

---

## Prompt untuk Codex — PART 6D: Picture-in-Picture & Blend Modes

```
Implementasikan Picture-in-Picture dan blend modes antar track.

PiP (Picture in Picture):
  Track video kedua (atau ketiga) yang dirender di atas track utama.
  
  Di projectStore, tracks memiliki urutan (z-index):
  tracks[0] = track paling bawah (background)
  tracks[n] = track paling atas

  renderFrame() merender dari bawah ke atas:
  tracks.forEach(track => {
    const activeClips = getActiveClips(track, currentTime)
    activeClips.forEach(clip => {
      renderClip(ctx, clip, currentTime)
    })
  })

  Untuk PiP: klip di track atas punya transform.scaleX = 0.3, transform.posX = 0.7, transform.posY = 0.2
  User bisa drag langsung di preview untuk posisikan.

Blend modes per klip:
  clip.blendMode = 'normal' // normal|multiply|screen|overlay|darken|lighten|color-dodge|hard-light|soft-light|difference|exclusion

  Implementasi:
  ctx.save()
  ctx.globalCompositeOperation = clip.blendMode
  renderClipToCanvas(clip, ctx)
  ctx.restore()

Di RightPanel saat klip dipilih:
  Dropdown "Blend Mode" (semua mode Canvas 2D)
  Slider "Opacity": 0-100%
  
  Preview blend mode: tampilkan thumbnail before/after saat hover option.

Shortcut: tekan [ dan ] untuk pindah klip ke track di atas/bawah.
```

---

## Prompt untuk Codex — PART 6E: Chroma Key (Green Screen)

```
Implementasikan chroma key removal (green screen / blue screen).

clip.chromaKey = {
  enabled: false,
  color: '#00ff00',    // warna yang dihapus
  tolerance: 0.3,      // 0-1
  softness: 0.1,       // 0-1 (edge feathering)
  spillReduction: 0.5, // kurangi color spill
}

Render chroma key via ImageData per frame (atau WebGL untuk performa):

Canvas 2D approach:
  1. drawImage(videoElement) ke offscreen canvas
  2. const imageData = offCtx.getImageData(0, 0, w, h)
  3. const { r: kr, g: kg, b: kb } = hexToRgb(clip.chromaKey.color)
  4. Loop setiap pixel:
     // Hitung jarak warna ke chroma color dalam HSV space
     const dist = colorDistance(r, g, b, kr, kg, kb)
     if (dist < tolerance) {
       alpha = 0  // transparan penuh
     } else if (dist < tolerance + softness) {
       alpha = (dist - tolerance) / softness  // transisi halus
     }
     pixels[i+3] = Math.round(alpha * 255)
  5. putImageData ke offscreen canvas
  6. drawImage offscreen ke main canvas

Optimasi: gunakan WebGL shader untuk real-time 30fps:
  Fragment shader GLSL:
    uniform vec3 chromaColor;
    uniform float tolerance;
    uniform float softness;
    float dist = distance(texColor.rgb, chromaColor);
    float alpha = smoothstep(tolerance, tolerance + softness, dist);
    gl_FragColor = vec4(texColor.rgb, texColor.a * alpha);

Di RightPanel:
  Toggle "Chroma Key"
  Color picker dengan eyedropper (klik warna di canvas preview)
  Slider: Tolerance, Softness, Spill Reduction
  Live preview dengan checkerboard background (transparan)
```

---

## Prompt untuk Codex — PART 6F: Dynamic Text (Counter, Timer)

```
Implementasikan teks dinamis yang nilainya berubah sesuai waktu video.

clip.dynamicText = {
  type: 'static',    // static | counter | timer | date | random
  // untuk counter:
  countFrom: 0,
  countTo: 100,
  format: '{value}',  // template: "Score: {value}" → "Score: 42"
  // untuk timer:
  timerMode: 'countdown',  // countdown | countup
  timerStart: 60,    // detik
  // untuk date:
  dateFormat: 'DD/MM/YYYY',
}

Di renderFrame() untuk text clips dengan dynamicText:
  let displayText = clip.text

  if (dynamic.type === 'counter') {
    const progress = (currentTime - clip.start) / (clip.end - clip.start)
    const value = Math.round(dynamic.countFrom + (dynamic.countTo - dynamic.countFrom) * progress)
    displayText = dynamic.format.replace('{value}', value)
  }

  if (dynamic.type === 'timer') {
    const elapsed = currentTime - clip.start
    const remaining = dynamic.type === 'countdown' ? dynamic.timerStart - elapsed : elapsed
    const mins = Math.floor(Math.abs(remaining) / 60)
    const secs = Math.floor(Math.abs(remaining) % 60)
    displayText = `${pad(mins)}:${pad(secs)}`
  }

Di RightPanel text editor:
  Dropdown "Tipe Teks": Static | Counter | Timer | Tanggal
  Tampilkan field sesuai tipe yang dipilih.
  Preview real-time di player berubah saat drag playhead.
```

---

## Checklist Part 6

- [ ] Keyframe: bisa tambah/hapus keyframe di posX untuk animasi gerak
- [ ] Keyframe: interpolasi smooth antara dua keyframe
- [ ] Keyframe: diamond marker tampil di timeline
- [ ] Easing: linear, easeInOut berfungsi (terlihat beda di preview)
- [ ] Motion path: jalur tampil di preview, titik bisa di-drag
- [ ] Masking: rectangle mask memotong video
- [ ] Masking: inverted mask berfungsi
- [ ] PiP: video kedua tampil di atas video pertama
- [ ] PiP: bisa di-drag posisinya di preview
- [ ] Blend modes: screen dan multiply menghasilkan efek berbeda
- [ ] Chroma key: green screen terhapus dari frame
- [ ] Counter text: angka berubah dari 0 ke 100 sepanjang klip
- [ ] Semua fitur bisa di-keyframe

---

*Lanjut ke PART 7: Project Management, Autosave, Templates, Collaboration*
