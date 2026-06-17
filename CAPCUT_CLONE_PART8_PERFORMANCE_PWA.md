# CapCut Clone — PART 8: Performance, PWA, WebGL Renderer, Polish

> **Prasyarat**: Part 1–7 selesai — semua fitur inti berjalan.
> Fokus Part 8: optimasi performa berat, WebGL rendering, offline support, dan UI polish.

---

## Fitur yang Dibangun di Part 8

| Fitur | Keterangan |
|-------|-----------|
| WebGL Renderer | Ganti Canvas 2D dengan WebGL untuk 60fps |
| Web Worker | Pindah heavy compute ke background thread |
| Virtual scrolling | Timeline dengan 100+ klip tetap smooth |
| PWA + Offline | App bisa diinstall dan dipakai offline |
| Lazy loading | Media dimuat sesuai kebutuhan |
| Memory management | Revoke object URLs, garbage collect |
| UI polish & micro-interactions | Animasi transisi, loading states |
| Accessibility | Keyboard navigation, screen reader labels |
| Error boundary | Graceful error handling |
| Dark/Light theme | Toggle tema |

---

## Prompt untuk Codex — PART 8A: WebGL Rendering Engine

```
Ganti Canvas 2D renderer dengan WebGL untuk performa lebih baik.

Buat src/rendering/WebGLRenderer.js:

Setup WebGL:
class WebGLRenderer {
  constructor(canvas) {
    this.gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      antialias: false,
    })
    this.initShaders()
    this.initBuffers()
    this.textureCache = new Map()
  }

  initShaders() {
    // Vertex shader: posisi quad layar penuh
    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texcoord;
      varying vec2 v_texcoord;
      void main() {
        gl_Position = vec4(a_position, 0, 1);
        v_texcoord = a_texcoord;
      }
    `
    
    // Fragment shader dengan semua efek
    const fsSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_hue;
      uniform float u_opacity;
      uniform vec3 u_chromaKey;
      uniform float u_chromaTolerance;
      varying vec2 v_texcoord;
      
      vec3 rgb2hsv(vec3 c) { ... }
      vec3 hsv2rgb(vec3 c) { ... }
      
      void main() {
        vec4 color = texture2D(u_texture, v_texcoord);
        
        // Apply color adjustments
        color.rgb += u_brightness;
        color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast) + 0.5;
        
        // Saturation via HSV
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.y *= (1.0 + u_saturation);
        color.rgb = hsv2rgb(hsv);
        
        // Chroma key
        float chromaDist = distance(color.rgb, u_chromaKey);
        float alpha = smoothstep(u_chromaTolerance - 0.05, u_chromaTolerance + 0.05, chromaDist);
        
        gl_FragColor = vec4(color.rgb, color.a * alpha * u_opacity);
      }
    `
    // Compile dan link shaders
  }

  uploadTexture(videoElement, mediaId) {
    // Buat atau update texture dari video frame
    if (!this.textureCache.has(mediaId)) {
      const texture = this.gl.createTexture()
      this.textureCache.set(mediaId, texture)
    }
    const texture = this.textureCache.get(mediaId)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, videoElement)
    return texture
  }

  renderClip(clip, videoElement, transform, filters) {
    const texture = this.uploadTexture(videoElement, clip.mediaId)
    // Set uniforms, draw quad
    this.gl.uniform1f(this.u_brightness, filters.brightness / 100)
    // ... set semua uniforms
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  renderFrame(clips, currentTime) {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    clips.sort((a,b) => a.zIndex - b.zIndex)
    clips.forEach(clip => {
      if (clip.videoElement) this.renderClip(clip, ...)
    })
  }
}

Integrasi: ganti ctx.drawImage() calls di PreviewPlayer dengan WebGLRenderer.renderFrame().
Fallback ke Canvas 2D jika WebGL tidak tersedia.
```

---

## Prompt untuk Codex — PART 8B: Web Workers

```
Pindahkan heavy computation ke Web Worker agar UI tidak freeze.

Operasi yang dipindah ke worker:
1. Thumbnail generation
2. Waveform calculation
3. Smart cut silence detection
4. Color grading histogram
5. Chroma key mask calculation (jika tidak pakai WebGL)

Buat src/workers/processingWorker.js:
// Worker menerima pesan dengan { type, payload }
self.addEventListener('message', async (e) => {
  const { type, payload, id } = e.data
  
  switch(type) {
    case 'GENERATE_WAVEFORM': {
      const { arrayBuffer } = payload
      // Decode audio
      const audioCtx = new OfflineAudioContext(1, 1, 44100)
      const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice())
      const channelData = buffer.getChannelData(0)
      const peaks = downsample(channelData, 1000)
      self.postMessage({ id, type: 'WAVEFORM_DONE', peaks })
      break
    }
    
    case 'DETECT_SILENCE': {
      const { arrayBuffer, threshold, minDuration, sampleRate } = payload
      const silenceRanges = analyzeSilence(arrayBuffer, threshold, minDuration, sampleRate)
      self.postMessage({ id, type: 'SILENCE_DONE', silenceRanges })
      break
    }
    
    case 'CALCULATE_HISTOGRAM': {
      const { imageData } = payload
      const histogram = calcHistogram(imageData)
      self.postMessage({ id, type: 'HISTOGRAM_DONE', histogram })
      break
    }
  }
})

Wrapper hook useWorker.js:
  const worker = useMemo(() => new Worker(new URL('../workers/processingWorker.js', import.meta.url)), [])
  
  function postMessage(type, payload) {
    return new Promise((resolve) => {
      const id = nanoid()
      const handler = (e) => {
        if (e.data.id === id) {
          worker.removeEventListener('message', handler)
          resolve(e.data)
        }
      }
      worker.addEventListener('message', handler)
      worker.postMessage({ type, payload, id })
    })
  }
```

---

## Prompt untuk Codex — PART 8C: Timeline Virtual Scrolling

```
Optimasi timeline untuk handle 100+ klip tanpa lag.

Masalah: render semua klip sekaligus, bahkan yang tidak terlihat, sangat berat.

Solusi: Virtual scrolling — hanya render klip yang visible di viewport.

Di Timeline.jsx:
  const containerRef = useRef()
  const [scrollX, setScrollX] = useState(0)
  const containerWidth = containerRef.current?.offsetWidth || 800
  
  // Hanya render klip yang visible
  function getVisibleClips(clips, scrollX, containerWidth, pxPerSec) {
    const viewStart = scrollX / pxPerSec
    const viewEnd = (scrollX + containerWidth) / pxPerSec
    const BUFFER = 2  // detik buffer di kiri/kanan
    
    return clips.filter(clip =>
      clip.end > viewStart - BUFFER && clip.start < viewEnd + BUFFER
    )
  }
  
  const visibleClips = useMemo(
    () => tracks.flatMap(t => getVisibleClips(t.clips, scrollX, containerWidth, pixelsPerSecond)),
    [tracks, scrollX, containerWidth, pixelsPerSecond]
  )

Untuk ruler virtual:
  Hitung tick marks yang visible saja:
  const startSec = Math.floor(scrollX / pixelsPerSecond)
  const endSec = Math.ceil((scrollX + containerWidth) / pixelsPerSecond)
  const ticks = range(startSec, endSec, tickInterval)

Timeline canvas rendering (ganti DOM rendering):
  Untuk performa maksimal, render timeline ke canvas bukan DOM:
  
  function renderTimeline(ctx, state) {
    // Clear
    ctx.clearRect(0, 0, canvasW, canvasH)
    
    // Render tracks background
    // Render visible clips
    // Render playhead
    // Render ruler
  }
  
  useEffect(() => {
    renderTimeline(timelineCtx, { tracks, scrollX, zoom, currentTime })
  }, [tracks, scrollX, zoom, currentTime])
  
  // Handle interactions via canvas mouse events, map koordinat ke klip
  function handleCanvasClick(e) {
    const { x, y } = getCanvasPosition(e)
    const time = (x + scrollX) / pixelsPerSecond
    const track = getTrackAtY(y)
    const clip = findClipAt(track, time)
    // ...
  }
```

---

## Prompt untuk Codex — PART 8D: Progressive Web App (PWA)

```
Konfigurasi app sebagai PWA yang bisa diinstall dan dipakai offline.

1. Buat public/manifest.json:
{
  "name": "Video Editor",
  "short_name": "VidEdit",
  "description": "Professional video editor in your browser",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d0d0d",
  "theme_color": "#0d0d0d",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/screenshot-wide.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide" }
  ]
}

2. Service Worker (public/sw.js):
const CACHE_NAME = 'video-editor-v1'
const STATIC_ASSETS = ['/', '/index.html', '/assets/...']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)))
})

self.addEventListener('fetch', (e) => {
  // Cache-first untuk assets statis
  // Network-first untuk API calls
  if (STATIC_ASSETS.includes(new URL(e.request.url).pathname)) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)))
  }
})

3. Register SW di main.jsx:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}

4. Install prompt (InstallBanner.jsx):
  Detect beforeinstallprompt event
  Tampilkan banner "Install app untuk pengalaman lebih baik"
  Tombol "Install" → deferredPrompt.prompt()

5. Vite PWA Plugin:
  npm install vite-plugin-pwa
  Di vite.config.js: tambahkan VitePWA plugin dengan config manifest
```

---

## Prompt untuk Codex — PART 8E: Memory Management

```
Implementasikan memory management untuk mencegah memory leak.

1. Object URL management (urlManager.js):
   const activeUrls = new Set()
   
   export function createManagedURL(blob) {
     const url = URL.createObjectURL(blob)
     activeUrls.add(url)
     return url
   }
   
   export function revokeManagedURL(url) {
     URL.revokeObjectURL(url)
     activeUrls.delete(url)
   }
   
   export function revokeAllURLs() {
     activeUrls.forEach(url => URL.revokeObjectURL(url))
     activeUrls.clear()
   }
   
   // Revoke saat komponen unmount
   window.addEventListener('unload', revokeAllURLs)

2. Video element pool:
   // Reuse video elements daripada buat baru setiap saat
   class VideoElementPool {
     constructor(size = 5) {
       this.pool = Array.from({ length: size }, () => document.createElement('video'))
       this.inUse = new Map()
     }
     
     acquire(mediaId) {
       if (this.inUse.has(mediaId)) return this.inUse.get(mediaId)
       const el = this.pool.find(v => !Array.from(this.inUse.values()).includes(v))
       if (!el) return null  // pool exhausted
       this.inUse.set(mediaId, el)
       return el
     }
     
     release(mediaId) {
       const el = this.inUse.get(mediaId)
       if (el) { el.src = ''; this.inUse.delete(mediaId) }
     }
   }

3. Texture cache limits (WebGL):
   // Hapus texture yang tidak dipakai sejak 30 detik terakhir
   function evictStaleTextures() {
     const now = Date.now()
     for (const [id, { texture, lastUsed }] of textureCache) {
       if (now - lastUsed > 30000) {
         gl.deleteTexture(texture)
         textureCache.delete(id)
       }
     }
   }
   setInterval(evictStaleTextures, 10000)

4. Monitor memory usage:
   if ('memory' in performance) {
     setInterval(() => {
       const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory
       if (usedJSHeapSize > jsHeapSizeLimit * 0.9) {
         console.warn('Memory usage critical, clearing caches')
         evictStaleTextures()
         thumbnailCache.clear()
       }
     }, 5000)
   }
```

---

## Prompt untuk Codex — PART 8F: UI Polish & Micro-interactions

```
Tambahkan animasi dan micro-interactions untuk UI yang terasa premium.

1. Transisi halaman (React Router):
   Gunakan Framer Motion atau CSS transitions:
   HomePage → Editor: slide up animation (300ms)
   Modal open: fade + scale dari 0.95 ke 1.0
   Modal close: reverse
   
2. Timeline interactions:
   - Klip hover: border highlight dengan CSS transition 100ms
   - Klip drag: opacity 0.8 + box-shadow
   - Drop zone: highlight teal saat klip di-drag di atas
   - Split animation: klip berpisah dengan gap animation
   
3. Button states:
   - Semua tombol: active state scale(0.96)
   - Destructive buttons: shake animation jika confirm diperlukan
   - Loading buttons: spinner dengan opacity fade-in
   
4. Toast notifications (ToastManager.jsx):
   Tampil di pojok kanan bawah untuk:
   - "Klip dipotong", "Efek diterapkan", "Disimpan", dll
   - Success: hijau, Error: merah, Info: biru
   - Auto-dismiss setelah 3 detik
   - Slide in dari bawah, slide out ke bawah
   
5. Tooltip system:
   - Semua tombol icon punya tooltip dengan nama + shortcut
   - Delay 1000ms sebelum tampil
   - Posisi otomatis (flip jika dekat tepi layar)
   
6. Drag & Drop visual feedback:
   - Ghost klip semi-transparan saat drag
   - Snap indicator: garis vertikal teal saat klip snap ke titik
   - Collision indicator: warna merah saat akan tumpang tindih

7. Loading states:
   - Skeleton UI saat proyek loading dari IndexedDB
   - Progress bar di atas halaman saat export
   - Spinner di thumbnail saat generate
```

---

## Prompt untuk Codex — PART 8G: Accessibility

```
Tambahkan accessibility (a11y) ke semua komponen utama.

1. Keyboard navigation timeline:
   - Tab → pindah fokus antar klip
   - Enter/Space → select klip yang difokus
   - Arrow keys saat klip dipilih → pindah klip
   - Delete/Backspace → hapus klip terpilih
   - Escape → deselect

2. ARIA labels:
   Semua tombol icon: aria-label="Potong klip" dll
   Timeline track: role="listbox", aria-label="Video track 1"
   Klip: role="option", aria-selected, aria-label="Klip: nama_file, durasi 5 detik, mulai 0:00"
   PreviewPlayer: role="region", aria-label="Preview video"

3. Focus management:
   - Modal: trap focus saat modal terbuka
   - Saat modal tutup: return focus ke trigger element
   - Gunakan: useEffect hook + querySelectorAll('[tabindex]')

4. Color contrast:
   - Pastikan semua teks memenuhi WCAG AA (4.5:1 untuk teks normal)
   - Terutama teks abu-abu di atas background gelap
   - Gunakan tool: https://webaim.org/resources/contrastchecker/

5. Screen reader announcements (useAnnounce.js):
   const announce = useAnnounce()
   // Setelah split: announce('Klip dipotong menjadi dua bagian')
   // Setelah export: announce('Export selesai, file sedang didownload')
   
   Implementasi: div dengan aria-live="polite" yang diupdate
```

---

## Prompt untuk Codex — PART 8H: Error Handling & Recovery

```
Buat sistem error handling yang robust.

1. Error Boundary (ErrorBoundary.jsx):
   class ErrorBoundary extends React.Component {
     state = { hasError: false, error: null }
     
     static getDerivedStateFromError(error) {
       return { hasError: true, error }
     }
     
     componentDidCatch(error, info) {
       console.error('Editor error:', error, info)
       // Opsional: kirim ke error tracking service
     }
     
     render() {
       if (this.state.hasError) {
         return <EditorCrashScreen error={this.state.error} onReset={this.handleReset} />
       }
       return this.props.children
     }
   }
   
   Wrap seluruh Editor dalam ErrorBoundary.
   EditorCrashScreen: tampilkan pesan ramah + tombol "Muat ulang" + tombol "Laporkan bug"

2. FFmpeg error handling:
   try {
     await ffmpeg.exec([...])
   } catch (err) {
     if (err.message.includes('out of memory')) {
       showToast('File terlalu besar untuk diproses. Coba resolusi lebih rendah.', 'error')
     } else {
       showToast(`Proses gagal: ${err.message}`, 'error')
     }
   }

3. Media loading errors:
   videoElement.onerror = () => {
     // Tandai klip sebagai error state
     clip.status = 'error'
     // Tampilkan placeholder error di timeline: warna merah + icon ⚠
     showToast(`Gagal memuat media: ${clip.name}`, 'error')
   }

4. IndexedDB quota exceeded:
   try {
     await saveProject(...)
   } catch (err) {
     if (err.name === 'QuotaExceededError') {
       showModal('StorageFullModal')
       // Tampilkan berapa storage yang dipakai, mana yang bisa dihapus
     }
   }

5. Auto-recovery:
   Saat app dibuka, cek apakah ada "crash recovery":
   localStorage.setItem('editorOpen', projectId)  // set saat editor dibuka
   window.addEventListener('beforeunload', () => localStorage.removeItem('editorOpen'))
   
   Saat startup: jika 'editorOpen' masih ada → tawarkan recovery
   "Sepertinya editor ditutup tidak normal. Muat autosave terakhir?"
```

---

## Checklist Part 8

- [ ] WebGL renderer: frame rate meningkat dibanding Canvas 2D
- [ ] Web Worker: waveform generation tidak block UI
- [ ] Timeline: 50 klip di timeline tidak lag saat scroll
- [ ] PWA: app bisa diinstall dari browser
- [ ] PWA: assets basic tersedia offline
- [ ] Memory: tidak ada object URL leak setelah hapus media
- [ ] Toast notifications tampil untuk semua operasi penting
- [ ] Tooltip tampil di semua tombol icon
- [ ] Keyboard: Tab navigation di timeline berfungsi
- [ ] ARIA: screen reader bisa baca nama dan status klip
- [ ] Error boundary: crash di satu komponen tidak kill seluruh app
- [ ] FFmpeg error: pesan error informatif muncul

---

*Lanjut ke PART 9: Advanced Export, Multi-format, Social Media Integration*
