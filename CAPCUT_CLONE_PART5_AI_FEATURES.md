# CapCut Clone — PART 5: Fitur AI

> **Prasyarat**: Part 1–4 selesai.
> Fokus Part 5: semua fitur berlabel "AI" di CapCut — auto caption, background remove, face tracking, smart cut, AI image/video generation.

---

## Fitur yang Dibangun di Part 5

| Fitur | API / Library |
|-------|--------------|
| Auto Caption / Subtitle | OpenAI Whisper API atau whisper.cpp WASM |
| Background Remover | MediaPipe Selfie Segmentation atau remove.bg API |
| Face Tracking / Blur | MediaPipe Face Detection |
| Smart Cut (hapus silence) | Web Audio API analysis |
| AI Image Generator | Anthropic Claude API (image gen) |
| Auto Reframe | Canvas crop tracking |
| Voice Changer | Web Audio API + pitch shift |
| Noise Reduction | RNNoise WASM |

---

## Prompt untuk Codex — PART 5A: Auto Caption (Whisper)

```
Implementasikan fitur Auto Caption menggunakan OpenAI Whisper API.

Buat AutoCaptionModal.jsx:
1. Pilih bahasa: Auto | Indonesia | English | dll
2. Pilih style caption: Subtitle biasa | Word-by-word highlight | Karaoke
3. Tombol "Generate Caption"

Alur (captionGenerator.js):
1. Ekstrak audio dari video klip:
   - Gunakan FFmpeg.wasm: ffmpeg.exec(['-i', 'input.mp4', '-vn', '-ar', '16000', '-ac', '1', '-f', 'wav', 'audio.wav'])
   - Baca file: const audioData = ffmpeg.readFile('audio.wav')

2. Kirim ke Whisper API:
   const formData = new FormData()
   formData.append('file', new Blob([audioData], {type:'audio/wav'}), 'audio.wav')
   formData.append('model', 'whisper-1')
   formData.append('response_format', 'verbose_json')   // dapat timestamps per kata
   formData.append('language', selectedLang)
   const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
     method: 'POST',
     headers: { Authorization: `Bearer ${apiKey}` },
     body: formData
   })
   const data = await res.json()

3. Parse hasil → array word segments:
   [{ word: 'Hello', start: 0.0, end: 0.5 }, ...]

4. Convert ke text clips:
   - Mode "Subtitle": group per kalimat, buat 1 text clip per kalimat
   - Mode "Word-by-word": 1 text clip per kata, durasi = word duration
   - Tambahkan semua ke track teks baru "Auto Caption"

5. Tampilkan di timeline, bisa edit manual tiap kata.

Fallback jika tidak ada API key:
  Gunakan Web Speech API (SpeechRecognition) — akurasi lebih rendah,
  tidak ada timestamps, tapi gratis dan offline.

Buat CaptionEditor.jsx (panel kanan saat track caption dipilih):
  - List semua caption dengan timecode
  - Edit teks langsung inline
  - Ubah style (font, ukuran, warna) untuk semua sekaligus
  - Tombol "Export SRT" dan "Export VTT"
```

---

## Prompt untuk Codex — PART 5B: Export SRT / VTT

```
Tambahkan export subtitle ke file SRT dan VTT.

Fungsi exportSRT(textClips) → string:
  let srt = ''
  textClips.forEach((clip, i) => {
    const start = formatSRTTime(clip.start)
    const end = formatSRTTime(clip.end)
    srt += `${i+1}\n${start} --> ${end}\n${clip.text}\n\n`
  })
  return srt

formatSRTTime(seconds):
  // Format: 00:00:01,234
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms,3)}`

Fungsi exportVTT(textClips) → string:
  Sama tapi format waktu: 00:00:01.234 (titik bukan koma), dan mulai dengan "WEBVTT\n\n"

Tombol export di CaptionEditor dan di ExportModal.
Download via anchor click seperti export video.
```

---

## Prompt untuk Codex — PART 5C: Background Remover

```
Implementasikan background remover menggunakan MediaPipe Selfie Segmentation.

Setup (backgroundRemover.js):
import { SelfieSegmentation } from '@mediapipe/selfie_segmentation'

const selfieSegmentation = new SelfieSegmentation({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
})
selfieSegmentation.setOptions({ modelSelection: 1 })

Alur per frame saat background remove aktif:
1. Kirim frame video ke segmentation:
   await selfieSegmentation.send({ image: videoElement })

2. Callback onResults({ segmentationMask }):
   - segmentationMask adalah canvas/image dengan alpha (putih=orang, hitam=background)
   - Di renderFrame():
     a. Draw frame asli ke offscreen canvas A
     b. Apply mask sebagai alpha channel
     c. Buat offscreen canvas B untuk background (warna solid / gambar / video lain)
     d. Composite: background dulu, lalu subject di atas

Penggantian background:
clip.bgRemove = {
  enabled: false,
  bgType: 'color',    // color | image | video | blur
  bgColor: '#00ff00', // green screen effect
  bgImageUrl: null,
  bgVideoUrl: null,
  blurAmount: 15,
}

Di RightPanel: toggle "Hapus Background", pilih pengganti background.

Optimasi:
- Jalankan segmentation setiap 2-3 frame, interpolasi di antara (lebih cepat)
- Tampilkan badge "AI" + progress saat pertama kali memproses
- Cache mask per frame jika tidak ada gerakan besar

Alternatif: remove.bg API (lebih akurat tapi butuh API key dan per-gambar, bukan real-time)
```

---

## Prompt untuk Codex — PART 5D: Face Detection & Auto Blur

```
Implementasikan deteksi wajah menggunakan MediaPipe Face Detection.

Setup (faceDetector.js):
import { FaceDetection } from '@mediapipe/face_detection'

const faceDetection = new FaceDetection({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
})
faceDetection.setOptions({ model: 'short', minDetectionConfidence: 0.5 })

Dua mode penggunaan:

MODE 1 - Face Blur (sensor wajah):
  clip.faceBlur = { enabled: false, intensity: 20 }
  
  Per frame:
  1. Detect wajah → dapat bounding boxes
  2. Draw frame normal
  3. Untuk setiap bounding box:
     ctx.filter = `blur(${intensity}px)`
     ctx.drawImage(videoElement, fx, fy, fw, fh, fx, fy, fw, fh)  // re-draw region
     ctx.filter = 'none'

MODE 2 - Auto Reframe (follow wajah):
  clip.autoReframe = { enabled: false, targetAspect: '9:16' }

  Analisis tracking (sekali saat enable):
  1. Sample setiap 30 frame, detect posisi wajah
  2. Buat smooth path dari posisi wajah
  3. Simpan sebagai keyframes: [{ time, centerX, centerY }]

  Per frame render:
  1. Lookup posisi dari keyframes (interpolasi)
  2. Crop canvas ke target aspect ratio, centered ke posisi wajah
  3. Scale crop ke output size

Di LeftPanel tab "AI":
  Card "Deteksi Wajah":
    - Toggle "Blur semua wajah"
    - Toggle "Auto Reframe ke 9:16"
    - Slider intensitas blur
  
  Setelah toggle aktif, proses berjalan dengan progress bar.
```

---

## Prompt untuk Codex — PART 5E: Smart Cut (Hapus Silence)

```
Implementasikan Smart Cut — otomatis hapus bagian video yang sunyi.

Buat SmartCutModal.jsx:
1. Slider "Batas volume kebisingan": -60dB sampai -20dB (default -40dB)
2. Slider "Durasi minimum silence": 0.3 - 3.0 detik (default 0.5s)
3. Slider "Padding di sekitar potongan": 0 - 0.5 detik
4. Checkbox "Preview sebelum apply"
5. Tombol "Analisis"

Analisis audio (smartCut.js):
1. Decode audio file dengan AudioContext
2. Bagi menjadi chunks kecil (10ms per chunk)
3. Untuk setiap chunk: hitung RMS energy
   rms = sqrt(mean(samples^2))
   db = 20 * log10(rms)
4. Tandai chunk sebagai 'silence' jika db < threshold
5. Group silence chunks yang berdekatan
6. Filter: hanya silence yang durasi > minDuration
7. Tambahkan padding ke setiap sisi

Hasil: array silenceRanges = [{ start, end }, ...]

Preview SmartCut:
  Tampilkan waveform dengan silence regions di-highlight merah
  User bisa klik silence region untuk exclude dari penghapusan

Apply:
  Untuk setiap silence range:
    splitClip di start (dengan padding)
    splitClip di end (dengan padding)
    deleteClip untuk bagian silence
    moveClip klip setelahnya ke kiri (ripple delete)
  Push semua ke satu history entry (bisa undo sekaligus)
```

---

## Prompt untuk Codex — PART 5F: Noise Reduction

```
Implementasikan noise reduction audio menggunakan RNNoise.

Setup:
  Download rnnoise.wasm dari: https://github.com/jorisvr/rnnoise-wasm
  Atau gunakan npm: @jorisvr/rnnoise-wasm

  import RNNoise from '@jorisvr/rnnoise-wasm'

Proses (noiseReduction.js):
async function reduceNoise(audioFile) {
  1. Decode audio: AudioContext.decodeAudioData()
  2. Pastikan mono, 48000 Hz (RNNoise requirement)
     Jika tidak: resample dengan OfflineAudioContext
  3. Init RNNoise: const rnnoise = await RNNoise.newInstance()
  4. Bagi audio menjadi frames 480 sampel
  5. Untuk setiap frame:
     const processedFrame = rnnoise.processFrame(frame)
  6. Gabungkan frames menjadi buffer baru
  7. Encode kembali ke WAV dengan FFmpeg.wasm
  8. Return sebagai File baru
  9. Update clip.audioUrl ke file yang sudah diproses
}

Di RightPanel saat audio klip dipilih:
  Tombol "Kurangi Noise" → loading → selesai
  Slider "Intensitas" (0-100) → tidak ada di RNNoise standar,
    implementasikan sebagai mix antara original dan processed:
    output[i] = original[i] * (1 - intensity) + processed[i] * intensity

Tampilkan before/after waveform comparison.
```

---

## Prompt untuk Codex — PART 5G: Voice Changer

```
Implementasikan voice changer real-time menggunakan Web Audio API.

clip.voiceEffect = {
  enabled: false,
  type: 'none',   // none | robot | chipmunk | deep | echo | reverb
  pitchShift: 0,  // semitones, -12 to +12
}

Setup audio graph untuk voice effect:
  source → PitchShiftNode → EffectNode → GainNode → destination

PitchShift menggunakan Phase Vocoder:
  Gunakan library: soundtouchjs
  import { PitchShifter } from 'soundtouchjs'
  
  const shifter = new PitchShifter(audioContext, audioBuffer, 16384)
  shifter.pitch = Math.pow(2, semitones/12)  // e.g. +12 semitones = 2.0

Preset effects:
  robot:     pitch = 0, + oscillator modulation + distortion
  chipmunk:  pitch = +8 semitones
  deep:      pitch = -8 semitones
  echo:      + DelayNode (delay=0.3, feedback=0.4)
  reverb:    + ConvolverNode dengan impulse response ruangan

Buat impulse response untuk reverb:
  function createReverb(duration, decay) {
    const rate = audioContext.sampleRate
    const length = rate * duration
    const impulse = audioContext.createBuffer(2, length, rate)
    for (let i = 0; i < length; i++) {
      impulse.getChannelData(0)[i] = (Math.random()*2-1) * Math.pow(1-i/length, decay)
      impulse.getChannelData(1)[i] = (Math.random()*2-1) * Math.pow(1-i/length, decay)
    }
    return impulse
  }

Di RightPanel: dropdown preset + pitch slider + intensity.
```

---

*Lanjut ke PART 6: Multi-track lanjutan, Keyframe animation, Masking*
