# Sonder — unified music streaming starter

A Next.js 15 App Router starter for a unified music listening experience.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

The persistent player opens the Now Playing drawer from the cover, track title, or player details button. It offers an Up Next queue with drag-and-drop and keyboard reorder controls, synced LRCLIB lyrics that follow playback position, and a reactive visualizer view. The bottom player includes a subtle waveform; the background glow samples the current cover art when the image host permits canvas access.

`GET /api/lyrics?title=...&artist=...&duration=...` proxies LRCLIB lookups server-side. The API returns synced LRC lyrics when available and plain lyrics as a fallback. Queue entries use the shared Track type and can mix Spotify, Apple Music, and YouTube tracks.

Provider login, encrypted session, and merged playlist setup are described below in the provider connection section of the project documentation.
