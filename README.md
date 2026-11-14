# Sonder — unified music streaming starter

A Next.js 15 App Router starter for a unified music listening experience. It includes a responsive Apple Music-inspired shell, a shared provider-agnostic music schema, a Zustand player store, searchable demo tracks, and server-side provider search integrations.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Unified search

The Search page is available at `/search`. It debounces input and requests `/api/search?q=...`, which queries Spotify, Apple Music, and YouTube concurrently and normalizes results into the shared `Track` schema. Provider failures or missing credentials fall back independently to matching demo catalog entries; the response includes `mockedProviders` so the UI can identify demo results.

Configure credentials in `.env.local` (never use `NEXT_PUBLIC_` for secrets): Spotify client ID/secret, Apple Music team ID/key ID/private key, and YouTube Data API key. The server route keeps credentials and provider tokens off the client.

## Project structure

- `types/music.ts` — `Track`, `Playlist`, and `ProviderType` schema.
- `store/usePlayerStore.ts` — active track, queue, playback, progress, volume, shuffle, repeat, and provider state.
- `components/AppShell.tsx` — responsive frosted-glass navigation, scrollable content area, and persistent playback bar.
- `app/api/search/route.ts` — parallel, server-side provider search and mock fallback.
- `app/search/page.tsx` — debounced search interface and provider filters.

The included catalog and playback actions are demo-only; playback provider SDK integrations are not configured yet.
