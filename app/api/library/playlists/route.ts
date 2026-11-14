import { NextRequest, NextResponse } from 'next/server';
import { readProviderSession, setProviderSession, type ProviderTokens } from '@/lib/auth/provider-session';
import type { Playlist } from '@/types/music';

export const runtime = 'nodejs';

async function spotifyToken(session: ReturnType<typeof readProviderSession>) {
  const current = session.spotify;
  if (!current) return null;
  if (current.expiresAt > Date.now() + 60_000 || !current.refreshToken) return current.accessToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return current.accessToken;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: clientId, client_secret: clientSecret }), cache: 'no-store',
  });
  if (!response.ok) { delete session.spotify; return null; }
  const data = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  const updated: ProviderTokens = { ...current, accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000, ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}) };
  session.spotify = updated;
  return updated.accessToken;
}

async function youtubeToken(session: ReturnType<typeof readProviderSession>) {
  const current = session.youtube;
  if (!current) return null;
  if (current.expiresAt > Date.now() + 60_000 || !current.refreshToken) return current.accessToken;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return current.accessToken;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: clientId, client_secret: clientSecret }), cache: 'no-store',
  });
  if (!response.ok) { delete session.youtube; return null; }
  const data = await response.json() as { access_token: string; expires_in?: number };
  session.youtube = { ...current, accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return data.access_token;
}

async function spotifyPlaylists(token: string): Promise<Playlist[]> {
  const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error('Spotify playlist request failed');
  const data = await response.json() as { items?: Array<{ id: string; name: string; description?: string | null; images?: Array<{ url: string }>; tracks?: { total?: number } }> };
  return (data.items ?? []).map((item) => ({ id: `spotify:${item.id}`, name: item.name, description: item.description ?? undefined, coverUrl: item.images?.[0]?.url, tracks: Array.from({ length: Math.min(item.tracks?.total ?? 0, 0) }), provider: 'spotify' }));
}

async function youtubePlaylists(token: string): Promise<Playlist[]> {
  const params = new URLSearchParams({ part: 'snippet,contentDetails', mine: 'true', maxResults: '50' });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error('YouTube playlist request failed');
  const data = await response.json() as { items?: Array<{ id: string; snippet: { title: string; description?: string; thumbnails?: { medium?: { url: string }; default?: { url: string } } }> }> };
  return (data.items ?? []).map((item) => ({ id: `youtube:${item.id}`, name: item.snippet.title, description: item.snippet.description, coverUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url, tracks: [], provider: 'youtube' }));
}

async function applePlaylists(developerToken: string, userToken: string): Promise<Playlist[]> {
  const response = await fetch('https://api.music.apple.com/v1/me/library/playlists?limit=100', {
    headers: { Authorization: `Bearer ${developerToken}`, 'Music-User-Token': userToken }, cache: 'no-store',
  });
  if (!response.ok) throw new Error('Apple Music playlist request failed');
  const data = await response.json() as { data?: Array<{ id: string; attributes?: { name?: string; description?: { standard?: string }; artwork?: { url?: string } }> }> };
  return (data.data ?? []).map((item) => ({ id: `apple:${item.id}`, name: item.attributes?.name ?? 'Untitled playlist', description: item.attributes?.description?.standard, coverUrl: item.attributes?.artwork?.url?.replace('{w}', '300').replace('{h}', '300'), tracks: [], provider: 'apple' }));
}

export async function GET(request: NextRequest) {
  const session = readProviderSession(request);
  const results = await Promise.allSettled([
    spotifyToken(session).then((token) => token ? spotifyPlaylists(token) : []),
    youtubeToken(session).then((token) => token ? youtubePlaylists(token) : []),
    session.apple?.userToken && process.env.APPLE_MUSIC_TEAM_ID && process.env.APPLE_MUSIC_KEY_ID && process.env.APPLE_MUSIC_PRIVATE_KEY
      ? fetch(new URL('/api/apple-token', request.nextUrl.origin), { cache: 'no-store' }).then(async (response) => {
          if (!response.ok) throw new Error('Apple Music developer token unavailable');
          const { token } = await response.json() as { token: string };
          return applePlaylists(token, session.apple!.userToken!);
        })
      : Promise.resolve([] as Playlist[]),
  ]);
  const playlists = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const response = NextResponse.json({ playlists, unavailableProviders: results.flatMap((result, index) => result.status === 'rejected' ? [['spotify', 'youtube', 'apple'][index]] : []) }, { headers: { 'Cache-Control': 'private, no-store' } });
  try { setProviderSession(response, session); } catch { /* Read-only playlist results still work without an encryption key. */ }
  return response;
}
