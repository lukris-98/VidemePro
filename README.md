# VidemePro+

VidemePro+ is a modern web and desktop video editor built with React, Vite, Electron, and FFmpeg. The project is designed as a CapCut-style editing workspace with a media library, timeline editing, preview canvas, AI-assisted tools, online stock media search, and export workflows.

The app can run in the browser during development and can also be packaged as a Windows portable `.exe` with Electron.

## Highlights

- Multi-panel editor layout with media, preview canvas, inspector, and timeline.
- Media library with local upload, Pexels search, and Pixabay search.
- Online media workflow with thumbnail previews, original download cache, favorites, large preview, and add-to-timeline actions.
- Modern sidebar source tabs for Upload, Pexels, and Pixabay.
- Modern dropdowns and horizontal category rails with scroll affordances.
- Timeline editing with tracks, clips, trimming, snapping, preview scrubbing, and playback controls.
- Preview canvas ratio presets for YouTube, Shorts/Reels/TikTok, Instagram, Facebook/X, and cinema formats.
- Right-side preview tools for Snapshot, Safe Area, Alpha Grid, and Compare.
- Inspector panels for metadata, transform, filters, visual adjustments, transitions, audio tools, captions, and advanced FFmpeg commands.
- AI-oriented tools including image generation hooks, auto captions, freeze frame, background removal, face blur, and auto reframe foundations.
- Browser and Electron support with local file download/cache handling.

## Tech Stack

- React 18
- Vite 5
- Electron 31
- Tailwind CSS
- Zustand
- FFmpeg WASM/native helper flows
- MediaPipe Selfie Segmentation and Face Detection
- Pexels API
- Pixabay API

## Getting Started

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
VITE_PEXELS_API_KEY=your_pexels_key
VITE_PIXABAY_API_KEY=your_pixabay_key
```

For Electron/native search handlers, you can also add:

```env
PEXELS_API_KEY=your_pexels_key
PIXABAY_API_KEY=your_pixabay_key
```

Run the browser app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run the desktop app:

```bash
npm run desktop
```

Build Windows portable `.exe`:

```bash
npm run dist:win
```

## Project Structure

```text
src/
  components/
    layout/      Main editor panels, preview, timeline, inspector
    media/       Media import, online media providers, thumbnails
    modals/      Export, capture, convert, AI, captions, freeze frame
    timeline/    Timeline clips, tracks, ruler, editing UI
    ui/          Shared controls such as ModernSelect and HorizontalRail
  store/         Zustand stores for media, project, playback, and UI state
  utils/         FFmpeg, preview rendering, export, effects, captions, AI helpers
electron/        Electron main/preload process integrations
public/          Static assets
```

## Environment And Secrets

API keys are intentionally not committed to the repository. Use `.env.local` for local development and configure the same variables in your deployment or build environment.

`.env.example` is safe to commit because it only contains empty placeholders.

## Current Status

VidemePro+ is an active editor prototype. The current focus is improving the media sourcing workflow, stock asset integration, preview experience, timeline ergonomics, and desktop/browser parity.

## License

Private project. Add a license file before distributing publicly.
