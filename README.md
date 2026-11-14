# Sonder — unified music streaming starter

A Next.js 15 App Router starter for a unified music listening experience. It includes a dark glassmorphism UI, a shared provider-agnostic `Track` model, a Zustand player store, searchable demo tracks, and a server-side OAuth route placeholder.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000.

## Provider integrations

The included catalog and playback actions are demo-only; they do not call Spotify, Apple Music, or YouTube. Add provider adapters that normalize results to `Track`, and connect the provider SDK/player in a client component. Handle SDK initialization, iframe readiness, expired sessions, and provider restrictions before reporting playback as active.

Keep secrets in `.env.local` and never prefix them with `NEXT_PUBLIC_`. Complete provider token exchanges in `app/api/auth/[provider]/route.ts`; the starter returns `501` until provider-specific OAuth handling is implemented. Use `.env.example` as the list of expected environment variables and do not commit `.env.local`.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run typecheck` — TypeScript check
