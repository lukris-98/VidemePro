# CapCut Clone — PART 10: Final Polish, Testing & Deployment (100% Complete)

> **Prasyarat**: Part 1–9 selesai semua.
> Fokus Part 10: testing, bug fixes sistematis, deployment, dan final checklist 100%.

---

## Apa yang Difinalisasi di Part 10

| Area | Yang Diselesaikan |
|------|------------------|
| Integration testing | Semua fitur bekerja bersama |
| Edge case handling | File rusak, durasi 0, browser berbeda |
| Browser compatibility | Chrome, Firefox, Edge, Safari |
| Mobile responsiveness | Tablet layout (desktop-first tapi ada fallback) |
| Performance profiling | Identifikasi bottleneck nyata |
| Deployment config | Vite build, Netlify/Vercel/self-hosted |
| Environment variables | API keys management |
| Final UI audit | Semua screen konsisten |
| Onboarding flow | User baru tahu cara pakai |
| Documentation | README untuk developer |

---

## Prompt untuk Codex — PART 10A: Integration & Edge Cases

```
Lakukan integration testing dan tangani edge cases berikut.

1. File edge cases:
   a. Video tanpa audio track → jangan crash, skip audio processing
   b. Video dengan durasi 0 → tampilkan error "File video tidak valid"
   c. File sangat besar (>4GB) → peringatan "File mungkin lambat diproses"
   d. Format tidak didukung browser → "Format tidak didukung, coba convert dulu"
   e. Gambar sebagai video track → tampilkan sebagai still frame (duration default 5s)
   f. Corrupt file → onerror handler yang informatif

2. Timeline edge cases:
   a. Klip di posisi negatif → clamp ke 0
   b. Overlap klip (harusnya dicegah) → auto-push ke posisi setelah konflik
   c. Trim hingga durasi 0 → minimum durasi 1 frame (1/fps detik)
   d. Split di ujung klip → tidak melakukan apa-apa, tampilkan info
   e. Undo hingga empty project → state kembali ke awal bersih

3. Playback edge cases:
   a. Loop playback: saat currentTime >= duration, reset ke 0
   b. Seek ke mana pun saat pause: frame ter-render dengan benar
   c. Seek sambil audio playing: stop audio, restart dari posisi baru
   d. Multiple video tracks: semua video di-seek bersamaan

4. Export edge cases:
   a. Export proyek kosong (tanpa klip) → peringatan
   b. Export proyek hanya audio → skip video rendering
   c. FFmpeg wasm belum load → tampilkan loading state, retry
   d. Storage penuh saat export → error yang jelas
   e. Cancel saat encoding → revoke semua object URL

Buat test file: src/tests/edgeCases.test.js
Gunakan Vitest: npm install -D vitest @vitest/ui
Test minimal untuk: splitClip, trimClip, getValueAtTime (keyframe), exportSRT
```

---

## Prompt untuk Codex — PART 10B: Browser Compatibility

```
Pastikan app berfungsi di semua browser modern.

Browser targets: Chrome 90+, Firefox 88+, Edge 90+, Safari 15+

Feature detection dan polyfills:

1. WebGL2 fallback:
   const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
   if (!gl) {
     console.warn('WebGL tidak tersedia, menggunakan Canvas 2D')
     renderer = new Canvas2DRenderer(canvas)
   }

2. File System Access API (Chrome only):
   if ('showOpenFilePicker' in window) {
     // Gunakan modern API
   } else {
     // Fallback ke <input type="file">
   }

3. SharedArrayBuffer (butuh COOP/COEP headers):
   Di vite.config.js:
   server: {
     headers: {
       'Cross-Origin-Opener-Policy': 'same-origin',
       'Cross-Origin-Embedder-Policy': 'require-corp',
     }
   }
   
   Jika tidak tersedia: FFmpeg.wasm jalankan di single-thread mode (lebih lambat)
   Detect: typeof SharedArrayBuffer !== 'undefined'

4. OffscreenCanvas fallback:
   if ('OffscreenCanvas' in window) {
     // Use OffscreenCanvas in Web Worker
   } else {
     // Process on main thread (slower)
   }

5. Safari specific:
   - AudioContext: gunakan (window.AudioContext || window.webkitAudioContext)
   - Video format: Safari prefer H.264/AAC, tidak support VP9/Opus
   - IndexedDB: Safari punya bug dengan large transactions, batch writes

6. Mobile browser:
   - Deteksi: /Mobi|Android/i.test(navigator.userAgent)
   - Tampilkan banner: "Editor ini dioptimalkan untuk desktop. 
     Beberapa fitur mungkin tidak tersedia di mobile."
   - Sembunyikan timeline, hanya tampilkan preview + basic controls
   - Tetap bisa: view proyek, play preview, export yang sudah dirender
```

---

## Prompt untuk Codex — PART 10C: Onboarding Flow

```
Buat onboarding untuk user baru.

Trigger: localStorage 'hasSeenOnboarding' === null

OnboardingOverlay.jsx:
Overlay dengan backdrop blur, tidak blocking klik di belakang.
Step-by-step dengan panah menunjuk ke elemen UI.

Step 1 (HomePage):
  Highlight tombol "+ Buat proyek"
  Tooltip: "Mulai dengan membuat proyek baru atau pilih template"
  Tombol: "Selanjutnya" | "Lewati"

Step 2 (Editor - setelah buat proyek):
  Highlight LeftPanel
  "Import video, audio, atau gambar dari sini"

Step 3:
  Highlight area drag ke timeline
  "Seret media ke timeline di bawah"

Step 4:
  Highlight tombol Play
  "Tekan Play atau Spacebar untuk preview"

Step 5:
  Highlight tombol Ekspor
  "Siap? Ekspor videomu ke berbagai format"

Selesai: tampilkan modal "Siap untuk edit! 🎬"
  Tombol "Mulai Edit"
  Checkbox "Jangan tampilkan lagi"
  
Simpan: localStorage.setItem('hasSeenOnboarding', 'true')

Juga buat HelpMenu.jsx (tombol ? di TopBar):
  - Link ke keyboard shortcuts (ShortcutHelp dari Part 3)
  - Link ke "Mulai ulang tutorial"
  - FAQ singkat (accordion): 
    "Bagaimana cara export?" | "Format apa yang didukung?" | "Apakah data saya aman?"
```

---

## Prompt untuk Codex — PART 10D: Environment Variables & API Keys

```
Setup environment variables yang aman untuk semua API keys.

Buat .env.example (commit ke git):
  VITE_OPENAI_API_KEY=             # Untuk Whisper auto-caption
  VITE_REMOVE_BG_API_KEY=          # Untuk background remover (opsional)
  VITE_APP_NAME=Video Editor
  VITE_APP_VERSION=1.0.0

Buat .env.local (jangan commit, tambahkan ke .gitignore):
  VITE_OPENAI_API_KEY=sk-...
  VITE_REMOVE_BG_API_KEY=...

Akses di kode:
  const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY

ApiKeySettings.jsx (di Settings modal):
  User bisa input API key mereka sendiri
  Simpan di localStorage (bukan kirim ke server)
  Input type="password" dengan toggle show/hide
  Tombol "Test" untuk verifikasi key valid
  
  Prioritas: env var → localStorage → prompt user untuk input

Tampilkan di HelpMenu:
  "Fitur AI membutuhkan API key OpenAI. Masukkan key Anda di Settings > API Keys."
  Link ke instruksi mendapatkan key.
```

---

## Prompt untuk Codex — PART 10E: Vite Build & Deployment

```
Konfigurasi build production dan deployment.

vite.config.js (final):
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { /* dari Part 8 */ },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'cdn-cache', expiration: { maxAgeSeconds: 7 * 24 * 60 * 60 } }
          }
        ]
      }
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'editor-core': ['zustand', 'idb'],
          'media-processing': ['jszip'],
        }
      }
    },
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  }
})

Deploy ke Netlify:
  netlify.toml:
  [[headers]]
    for = "/*"
    [headers.values]
      Cross-Origin-Opener-Policy = "same-origin"
      Cross-Origin-Embedder-Policy = "require-corp"
      X-Frame-Options = "DENY"
      X-Content-Type-Options = "nosniff"

  [build]
    command = "npm run build"
    publish = "dist"

Deploy ke Vercel:
  vercel.json:
  {
    "headers": [
      {
        "source": "/(.*)",
        "headers": [
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
        ]
      }
    ]
  }

npm run build → dist/
npm run preview → test production build lokal
```

---

## Prompt untuk Codex — PART 10F: README & Developer Docs

```
Buat README.md yang komprehensif untuk proyek.

# Video Editor — Open Source CapCut Alternative

## Demo
[link demo]

## Fitur
- ✅ Import video, audio, gambar (drag & drop)
- ✅ Timeline multi-track
- ✅ Cut, Trim, Split, Freeze Frame
- ✅ Audio editing + waveform
- ✅ Text overlay + animasi
- ✅ Transisi (cross-dissolve, wipe, slide)
- ✅ Color grading + filter preset
- ✅ Efek video (blur, vignette, chroma key)
- ✅ Masking & Keyframe animation
- ✅ AI: Auto-caption, Background remove, Smart cut
- ✅ Export: MP4, WebM, GIF, MP3, Frame sequence
- ✅ Preset platform: YouTube, Instagram, TikTok, WhatsApp
- ✅ Project save/load (IndexedDB)
- ✅ PWA: Installable, offline-capable

## Tech Stack
- React 18 + Vite
- Zustand (state management)
- FFmpeg.wasm (video processing)
- MediaPipe (AI features)
- Web Audio API (audio processing)
- WebGL2 (rendering)
- IndexedDB via idb (storage)

## Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Install
npm install

### Environment Variables
cp .env.example .env.local
# Edit .env.local dan isi API keys

### Run Development
npm run dev
# Buka http://localhost:5173

### Build Production
npm run build
npm run preview

## Browser Support
| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 15+ | ⚠️ Limited (no SharedArrayBuffer) |
| Mobile | ⚠️ View only |

## Architecture
[link ke PART 1 untuk detail arsitektur]

## Contributing
[standard contributing guide]

## License
MIT
```

---

## MASTER CHECKLIST — 100% Complete

### Part 1 — UI Layout ✅
- [ ] App shell + routing berjalan
- [ ] LeftPanel tabs switching
- [ ] PreviewPlayer canvas render
- [ ] Timeline shell dengan ruler

### Part 2 — Core Editing ✅
- [ ] Import file + thumbnail
- [ ] Drag ke timeline
- [ ] Cut/Split (S key)
- [ ] Trim handles
- [ ] Freeze frame
- [ ] Export MP4
- [ ] Undo/Redo 50 level

### Part 3 — Audio & Text ✅
- [ ] Waveform tampil
- [ ] Audio sync playback
- [ ] Fade in/out
- [ ] Text overlay + drag
- [ ] Text animation
- [ ] Transisi cross-dissolve + wipe
- [ ] Speed control
- [ ] Keyboard shortcuts

### Part 4 — Effects ✅
- [ ] Filter preset
- [ ] Color grading sliders
- [ ] Crop + rotate
- [ ] Stiker
- [ ] Blur + vignette
- [ ] Chroma key

### Part 5 — AI ✅
- [ ] Auto caption (Whisper)
- [ ] Export SRT/VTT
- [ ] Background remover
- [ ] Face blur
- [ ] Smart cut silence
- [ ] Noise reduction
- [ ] Voice changer

### Part 6 — Advanced ✅
- [ ] Keyframe animation
- [ ] Motion path
- [ ] Shape masking
- [ ] PiP + blend modes
- [ ] Dynamic text counter

### Part 7 — Projects ✅
- [ ] Save/load IndexedDB
- [ ] Autosave indicator
- [ ] HomePage grid
- [ ] Export/Import .ccproj
- [ ] Templates

### Part 8 — Performance ✅
- [ ] WebGL renderer
- [ ] Web Workers
- [ ] Virtual timeline scrolling
- [ ] PWA installable
- [ ] Memory management
- [ ] Toast + tooltips + a11y

### Part 9 — Export ✅
- [ ] Platform presets
- [ ] Accurate progress
- [ ] Audio-only export
- [ ] Frame sequence ZIP
- [ ] Watermark
- [ ] Export queue

### Part 10 — Final ✅
- [ ] Edge cases handled
- [ ] Browser compat tested
- [ ] Onboarding flow
- [ ] API keys settings
- [ ] Production build
- [ ] Deployed + headers correct
- [ ] README lengkap

---

## Urutan Pengerjaan yang Disarankan

```
Week 1: Part 1 + Part 2 (fondasi + editing dasar)
Week 2: Part 3 + Part 4 (audio, text, effects)
Week 3: Part 5 + Part 6 (AI, keyframes, masking)
Week 4: Part 7 + Part 8 (project mgmt, performance)
Week 5: Part 9 + Part 10 (export, polish, deploy)
```

**Total: ~200+ prompt Codex, ~50 komponen React, ~20 utility files**

---

## 🎉 Selesai — 100% CapCut Clone
