# Sonder — unified music streaming starter

A Next.js 15 App Router starter for a unified music listening experience. It includes a responsive Apple Music-inspired shell, a shared provider-agnostic music schema, a Zustand player store, searchable demo tracks, and a server-side OAuth route placeholder.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Project structure

- `types/music.ts` — `Track`, `Playlist`, and `ProviderType` schema.
- `store/usePlayerStore.ts` — active track, queue, playback, progress, volume, shuffle, repeat, and provider state.
- `components/AppShell.tsx` — responsive frosted-glass navigation, scrollable content area, and persistent playback bar.
- `app/api/auth/[provider]/route.ts` — server-side provider authorization placeholder.

The included catalog and playback actions are demo-only; they do not call Spotify, Apple Music, or YouTube. Keep credentials in `.env.local` and complete provider token exchanges in the Next.js route handler. Never expose client secrets using `NEXT_PUBLIC_` variables.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run typecheck` — TypeScript check
