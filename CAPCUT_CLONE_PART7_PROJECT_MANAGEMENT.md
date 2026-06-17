# CapCut Clone — PART 7: Project Management, Autosave, Templates

> **Prasyarat**: Part 1–6 selesai.
> Fokus Part 7: simpan/load proyek, autosave, template, dan halaman beranda.

---

## Fitur yang Dibangun di Part 7

| Fitur | Storage |
|-------|---------|
| Simpan proyek lokal | IndexedDB (via idb library) |
| Autosave | setInterval + beforeunload |
| Load proyek | IndexedDB query |
| Template proyek | JSON preset + media placeholder |
| Halaman beranda | Grid proyek + recent files |
| Project settings | Resolusi, FPS, aspect ratio |
| Export/Import project file | .ccproj (JSON + zip) |

---

## Prompt untuk Codex — PART 7A: IndexedDB Storage

```
Implementasikan penyimpanan proyek menggunakan IndexedDB via library 'idb'.

Install: npm install idb

Buat src/storage/db.js:
import { openDB } from 'idb'

const DB_NAME = 'VideoEditorDB'
const DB_VERSION = 1

export const db = await openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // Store untuk proyek
    const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
    projectStore.createIndex('updatedAt', 'updatedAt')
    
    // Store untuk media files (simpan sebagai ArrayBuffer)
    const mediaStore = db.createObjectStore('mediaFiles', { keyPath: 'id' })
    mediaStore.createIndex('projectId', 'projectId')
  }
})

Fungsi CRUD proyek:
export async function saveProject(projectData) {
  // projectData: { id, name, tracks, duration, settings, thumbnail, updatedAt }
  await db.put('projects', { ...projectData, updatedAt: Date.now() })
}

export async function loadProject(projectId) {
  return await db.get('projects', projectId)
}

export async function getAllProjects() {
  return await db.getAllFromIndex('projects', 'updatedAt')
}

export async function deleteProject(projectId) {
  await db.delete('projects', projectId)
  // Hapus juga semua media files terkait
  const mediaKeys = await db.getAllKeysFromIndex('mediaFiles', 'projectId', projectId)
  await Promise.all(mediaKeys.map(key => db.delete('mediaFiles', key)))
}

export async function saveMediaFile(mediaItem) {
  // Simpan ArrayBuffer dari file
  const buffer = await mediaItem.file.arrayBuffer()
  await db.put('mediaFiles', {
    id: mediaItem.id,
    projectId: mediaItem.projectId,
    name: mediaItem.name,
    type: mediaItem.type,
    mimeType: mediaItem.file.type,
    buffer,
    thumbnailUrl: mediaItem.thumbnailUrl,
    duration: mediaItem.duration,
    width: mediaItem.width,
    height: mediaItem.height,
  })
}

export async function loadMediaFile(mediaId) {
  const data = await db.get('mediaFiles', mediaId)
  if (!data) return null
  const file = new File([data.buffer], data.name, { type: data.mimeType })
  return { ...data, file, url: URL.createObjectURL(file) }
}
```

---

## Prompt untuk Codex — PART 7B: Autosave System

```
Implementasikan autosave proyek setiap 30 detik dan saat window ditutup.

Buat src/hooks/useAutosave.js:

export function useAutosave() {
  const project = useProjectStore()
  const [lastSaved, setLastSaved] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  async function save() {
    setIsSaving(true)
    try {
      // Generate thumbnail dari frame pertama di preview
      const thumbnail = await capturePreviewThumbnail()
      
      // Serialize state: tidak simpan File objects (sudah di IndexedDB terpisah)
      const projectData = {
        id: project.id,
        name: project.projectName,
        tracks: project.tracks,  // clips hanya punya mediaId, bukan File
        duration: project.duration,
        settings: project.settings,
        thumbnail,
        updatedAt: Date.now(),
      }
      
      await saveProject(projectData)
      setLastSaved(new Date())
      console.log('Autosaved:', projectData.name)
    } finally {
      setIsSaving(false)
    }
  }

  // Autosave setiap 30 detik jika ada perubahan
  useEffect(() => {
    const interval = setInterval(() => {
      if (project.isDirty) {  // flag dirty saat ada perubahan
        save()
        project.setDirty(false)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [project.isDirty])

  // Simpan saat tab/window ditutup
  useEffect(() => {
    const handler = (e) => {
      save()  // best-effort sync save
      // Untuk Chrome: tampilkan konfirmasi jika ada perubahan belum tersimpan
      if (project.isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  return { save, lastSaved, isSaving }
}

Di TopBar: tampilkan status "Simpan otomatis: 14:20:49" mirip CapCut.
Tombol Ctrl+S → save() manual.
Indicator isSaving: spinner kecil saat sedang menyimpan.
```

---

## Prompt untuk Codex — PART 7C: Halaman Beranda

```
Buat halaman beranda (HomePage.jsx) mirip screenshot CapCut gambar 1.

Router: gunakan React Router.
  '/'         → HomePage
  '/editor'   → Editor (App.jsx yang sudah dibuat)
  '/editor/:projectId' → Editor dengan proyek yang diload

HomePage layout:
1. Sidebar kiri (lebar 200px, bg #111):
   - Avatar + nama user + nomor
   - Tombol "Gabung Pro" (ungu/pink gradient)
   - Menu: Beranda, Template, Ruang
   - Divider
   - Studio Desain, Buat dengan AI, Alat Pemasaran
   - Undang teman (bawah)

2. Area utama:
   a. Hero card besar: "+ Buat proyek" (gradient teal besar, klik → buat proyek baru)
   
   b. Row cards: "Studio Video" | "Rekam layar"
      Masing-masing card dengan thumbnail dan badge AI
   
   c. Section "Alat lainnya":
      Grid icon: Video panjang→pendek | Video AI | Gambar AI | Penerjemah video |
      Adegan dialog AI | Model fashion AI | Teks ke ucapan | Sempurnakan kualitas |
      Pemotongan gambar otomatis
      Semua dengan badge AI biru
   
   d. Section "Proyek":
      - Toolbar: search, sort, view toggle, Sampah, Sinkronisasi
      - Grid thumbnail proyek dari IndexedDB
      - Setiap card: thumbnail, nama proyek, tanggal edit, durasi
      - Hover: tampilkan tombol Edit, Rename, Delete
      - Klik → navigate ke /editor/:projectId

Buat proyek baru:
  - Klik "+ Buat proyek" → ProjectSetupModal.jsx
  - Pilih: Aspect ratio (16:9 | 9:16 | 1:1 | 4:3 | 21:9)
  - Input nama proyek
  - Pilih FPS: 24 | 30 | 60
  - Tombol "Buat" → navigate ke /editor dengan proyek baru
```

---

## Prompt untuk Codex — PART 7D: Project Settings

```
Buat ProjectSettingsModal.jsx untuk konfigurasi proyek.

Settings yang bisa diubah:
project.settings = {
  name: '0525',
  aspectRatio: '16:9',
  width: 1920,
  height: 1080,
  fps: 30,
  backgroundColor: '#000000',
  colorSpace: 'Rec.709 SDR',   // Rec.709 SDR | Rec.2020 HDR
  audioSampleRate: 48000,
  audioBitrate: 320,
}

Saat aspect ratio berubah:
  Update width/height:
    '16:9'  → 1920x1080
    '9:16'  → 1080x1920
    '1:1'   → 1080x1080
    '4:3'   → 1440x1080
    '21:9'  → 2560x1080
  
  Semua klip yang sudah ada: tampilkan dialog konfirmasi
  "Klip mungkin perlu di-reframe. Lanjutkan?"

Di TopBar: klik nama proyek → buka settings modal.
Di RightPanel section "Detail" (seperti screenshot gambar 2):
  Nama, Jalur file, Ruang warna, Proxy, Nama timeline
  Tombol "Ubah" untuk setiap field.
```

---

## Prompt untuk Codex — PART 7E: Export/Import .ccproj File

```
Implementasikan export dan import file proyek (.ccproj format).

Format .ccproj: ZIP file berisi:
  project.json   → semua data proyek (tracks, clips, settings, dll)
  media/         → folder berisi semua file media yang dipakai
  thumbnails/    → folder thumbnail

Export .ccproj (exportProject.js):
  import JSZip from 'jszip'  // npm install jszip
  
  async function exportCCPROJ(projectId) {
    const zip = new JSZip()
    const project = await loadProject(projectId)
    
    // Simpan project.json (tanpa binary data)
    zip.file('project.json', JSON.stringify(project, null, 2))
    
    // Kumpulkan semua media yang dipakai
    const mediaFolder = zip.folder('media')
    const allMediaIds = getAllMediaIdsFromTracks(project.tracks)
    
    for (const mediaId of allMediaIds) {
      const media = await loadMediaFile(mediaId)
      if (media) {
        mediaFolder.file(media.name, media.buffer)
      }
    }
    
    // Generate ZIP
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    downloadBlob(blob, `${project.name}.ccproj`)
  }

Import .ccproj:
  async function importCCPROJ(file) {
    const zip = await JSZip.loadAsync(file)
    
    // Baca project.json
    const projectJson = await zip.file('project.json').async('text')
    const project = JSON.parse(projectJson)
    project.id = nanoid()  // ID baru agar tidak konflik
    
    // Restore media files
    const mediaFolder = zip.folder('media')
    for (const [filename, zipEntry] of Object.entries(mediaFolder.files)) {
      const buffer = await zipEntry.async('arraybuffer')
      // Re-map mediaId ke project baru
      await saveMediaFile({ id: newMediaId, buffer, name: filename, projectId: project.id })
    }
    
    await saveProject(project)
    navigate(`/editor/${project.id}`)
  }

Tombol di HomePage: "Impor Proyek" (terima file .ccproj).
Tombol di editor Menu: "Ekspor Proyek (.ccproj)".
```

---

## Prompt untuk Codex — PART 7F: Template System

```
Buat sistem template proyek.

Template adalah proyek preset dengan:
- Placeholder media (gambar/video placeholder abu-abu)
- Teks yang bisa diganti
- Efek, transisi, dan timing sudah dikonfigurasi
- Thumbnail preview

Data template (templates.js):
export const builtinTemplates = [
  {
    id: 'promo-16x9',
    name: 'Promo Properti 16:9',
    category: 'Bisnis',
    thumbnail: '/templates/promo-thumb.jpg',
    duration: 30,
    settings: { aspectRatio: '16:9', fps: 30 },
    tracks: [
      {
        type: 'video',
        clips: [
          { start: 0, end: 5, placeholder: true, label: 'Video Eksterior' },
          { start: 5, end: 10, placeholder: true, label: 'Video Interior' },
        ]
      },
      {
        type: 'text',
        clips: [
          { start: 0, end: 30, text: 'Nama Properti', fontSize: 64, editable: true },
          { start: 2, end: 8, text: 'Klik untuk edit lokasi', fontSize: 32 },
        ]
      },
      {
        type: 'audio',
        clips: [
          { start: 0, end: 30, placeholder: true, label: 'Background Music' }
        ]
      }
    ]
  },
  // ... template lainnya
]

TemplateGallery.jsx (tab "Template" di HomePage):
  - Filter kategori: Semua | Bisnis | Sosial Media | Vlog | Pendidikan
  - Grid template dengan preview hover (play animasi thumbnail)
  - Klik → UseTemplateModal:
    "Gunakan template ini?"
    Preview singkat template
    Tombol "Gunakan" → buat proyek baru dari template

Saat load template:
  Placeholder media tampil sebagai abu-abu di timeline
  User bisa replace placeholder: klik kanan → "Ganti Media" → file picker
```

---

## Checklist Part 7

- [ ] IndexedDB: proyek tersimpan dan bisa diload kembali
- [ ] IndexedDB: media files tersimpan sebagai ArrayBuffer
- [ ] Autosave: indikator "Simpan otomatis: HH:MM:SS" muncul di TopBar
- [ ] Autosave: proyek tersimpan otomatis setiap 30 detik
- [ ] HomePage: tampil grid proyek dari IndexedDB
- [ ] Buat proyek baru dari HomePage dengan aspect ratio pilihan
- [ ] Load proyek lama dari grid thumbnail
- [ ] Hapus proyek dari HomePage
- [ ] Project settings: ganti nama dan aspect ratio
- [ ] Export .ccproj: ZIP terdownload dengan media di dalamnya
- [ ] Import .ccproj: proyek muncul di HomePage
- [ ] Template: minimal 1 template bisa dipakai dan placeholder ter-replace

---

*Lanjut ke PART 8: Performance, PWA, Rendering Engine, Polish*
