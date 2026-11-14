# Sonder — unified music streaming starter

A Next.js 15 App Router starter for a unified music listening experience.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `SESSION_ENCRYPTION_KEY` to a long random secret. Configure Spotify OAuth (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) and Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) with callback URLs `https://your-domain/api/auth/spotify/callback` and `https://your-domain/api/auth/youtube/callback`. Use `NEXT_PUBLIC_APP_URL` to set the exact public origin. Apple Music requires its MusicKit key credentials.

## Provider connections and playlists

`components/auth/ProviderConnect.tsx` provides connection controls and live status for Spotify, Google/YouTube, and Apple Music. Spotify and Google use OAuth authorization-code flows with PKCE, state verification, and server-side code exchange. Access and refresh tokens plus the Apple Music user token are stored in an encrypted AES-256-GCM, HTTP-only, same-site cookie; the session encryption key never reaches the browser. OAuth credentials and provider tokens are not returned by status or playlist routes.

`GET /api/library/playlists` merges saved playlist metadata from connected providers. It refreshes expiring Spotify/Google tokens where possible and isolates provider errors. The sidebar reloads the merged list when the app regains focus and after a connection flow.

For production deployments with multiple app instances, consider moving encrypted provider sessions into a shared server-side session store keyed by a secure session ID. This avoids browser cookie size limits and enables centralized revocation. Ensure OAuth callback URLs and allowed origins exactly match provider console settings.
