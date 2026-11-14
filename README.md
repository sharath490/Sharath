# Sonder — unified music streaming starter

A Next.js 15 App Router starter for a unified music listening experience. It includes a responsive Apple Music-inspired shell, a shared provider-agnostic music schema, a Zustand player store, searchable demo tracks, and server-side provider search integrations.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Playback engine

`components/player/PlaybackEngine.tsx` coordinates the YouTube IFrame Player API, Spotify Web Playback SDK, Spotify 30-second previews/deep-link fallback, and MusicKit JS playback. It pauses all other adapters when switching tracks, syncs provider playback progress into the Zustand store, and forwards shared scrubber/volume controls to the active provider.

YouTube's embedded player remains visible in a compact playback panel (with a video minimize control) to comply with the IFrame API's player requirements; it is not hidden or used to bypass ads or access restrictions. Some videos may disallow embedding, and YouTube will report those errors.

### Credentials and authorization

- Add Apple Music key details to `.env.local`; `/api/apple-token` signs a short-lived developer token server-side. Apple Music also requires the listener to authorize their account in MusicKit.
- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` is the public Spotify app ID used to initialize the SDK. Spotify playback requires a user-authorized OAuth access token with the Web Playback scopes and a Premium account. Pass the access token to `<PlaybackEngine spotifyAccessToken={token} />` from your authenticated session layer; never use a client-credentials token for user playback or expose the Spotify client secret.
- Without a Spotify device/token, the engine uses a returned preview URL when available; otherwise it offers a Spotify deep link. Previews may not be available for every catalog item.

## Project structure

- `types/music.ts` — `Track`, `Playlist`, and `ProviderType` schema.
- `store/usePlayerStore.ts` — shared playback state, queue, progress, volume, shuffle, repeat, and provider.
- `components/AppShell.tsx` — responsive shell and persistent player controls.
- `components/player/PlaybackEngine.tsx` — provider SDK adapters and synchronization.
- `app/api/apple-token/route.ts` — server-only Apple Music developer token signing.
- `app/api/search/route.ts` — parallel, server-side provider search and mock fallback.

The app does not bypass provider subscription requirements, ads, territorial restrictions, or playback restrictions.
