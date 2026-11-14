import { createSign } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { demoTracks } from '@/lib/music/demo-tracks';
import type { ProviderType, Track } from '@/types/music';

export const runtime = 'nodejs';

const MAX_RESULTS = 10;
const SEARCH_TIMEOUT_MS = 8_000;
type ProviderResults = Record<ProviderType, Track[]>;
type SearchResult = { tracks: Track[]; mocked: boolean };

function mockResults(provider: ProviderType, query: string): Track[] {
  const normalizedQuery = query.trim().toLowerCase();
  return demoTracks
    .filter((track) => track.provider === provider)
    .filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(normalizedQuery))
    .slice(0, MAX_RESULTS);
}

function imageUrl(template?: string) {
  return template?.replace('{w}', '600').replace('{h}', '600') ?? '';
}

async function spotifySearch(query: string): Promise<Track[]> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials are not configured');

  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!tokenResponse.ok) throw new Error(`Spotify token request failed (${tokenResponse.status})`);
  const tokenData = await tokenResponse.json() as { access_token: string };
  const response = await fetch(`https://api.spotify.com/v1/search?${new URLSearchParams({ q: query, type: 'track', limit: String(MAX_RESULTS) })}`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Spotify search failed (${response.status})`);
  const data = await response.json() as { tracks?: { items?: Array<{ id: string; name: string; artists: Array<{ name: string }>; album: { name: string; images?: Array<{ url: string }> }; duration_ms: number; uri: string }> } };
  return (data.tracks?.items ?? []).map((item) => ({
    id: `spotify:${item.id}`,
    title: item.name,
    artist: item.artists.map((artist) => artist.name).join(', '),
    album: item.album.name,
    durationMs: item.duration_ms,
    coverUrl: item.album.images?.[0]?.url ?? '',
    provider: 'spotify',
    playbackUri: item.uri,
  }));
}

function createAppleDeveloperToken(): string {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) throw new Error('Apple Music credentials are not configured');

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: issuedAt, exp: issuedAt + 300 })).toString('base64url');
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign('SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${unsignedToken}.${signature}`;
}

async function appleSearch(query: string): Promise<Track[]> {
  const developerToken = createAppleDeveloperToken();
  const response = await fetch(`https://api.music.apple.com/v1/catalog/us/search?${new URLSearchParams({ term: query, types: 'songs', limit: String(MAX_RESULTS) })}`, {
    headers: { Authorization: `Bearer ${developerToken}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Apple Music search failed (${response.status})`);
  const data = await response.json() as { results?: { songs?: { data?: Array<{ id: string; attributes: { name: string; artistName: string; albumName: string; durationInMillis?: number; artwork?: { url?: string }; url: string } }> } } };
  return (data.results?.songs?.data ?? []).map((item) => ({
    id: `apple:${item.id}`,
    title: item.attributes.name,
    artist: item.attributes.artistName,
    album: item.attributes.albumName,
    durationMs: item.attributes.durationInMillis ?? 0,
    coverUrl: imageUrl(item.attributes.artwork?.url),
    provider: 'apple',
    playbackUri: item.attributes.url,
  }));
}

function parseIsoDuration(value?: string): number {
  const match = value?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!match) return 0;
  return Math.round(((Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0)) * 1000);
}

async function youtubeSearch(query: string): Promise<Track[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YouTube API key is not configured');

  const searchParams = new URLSearchParams({ part: 'snippet', type: 'video', videoCategoryId: '10', maxResults: String(MAX_RESULTS), q: query, key: apiKey });
  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`, {
    cache: 'no-store', signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!searchResponse.ok) throw new Error(`YouTube search failed (${searchResponse.status})`);
  const searchData = await searchResponse.json() as { items?: Array<{ id: { videoId?: string }; snippet: { title: string; channelTitle: string; thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } } } }> };
  const items = (searchData.items ?? []).filter((item) => item.id.videoId);
  if (!items.length) return [];

  const videoParams = new URLSearchParams({ part: 'contentDetails', id: items.map((item) => item.id.videoId!).join(','), key: apiKey });
  const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${videoParams}`, {
    cache: 'no-store', signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!videoResponse.ok) throw new Error(`YouTube video details failed (${videoResponse.status})`);
  const videoData = await videoResponse.json() as { items?: Array<{ id: string; contentDetails?: { duration?: string } }> };
  const durationById = new Map((videoData.items ?? []).map((video) => [video.id, parseIsoDuration(video.contentDetails?.duration)]));

  return items.map((item) => {
    const id = item.id.videoId!;
    return {
      id: `youtube:${id}`,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      album: 'YouTube Music',
      durationMs: durationById.get(id) ?? 0,
      coverUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? '',
      provider: 'youtube' as const,
      playbackUri: `https://www.youtube.com/watch?v=${id}`,
    };
  });
}

async function withMockFallback(provider: ProviderType, request: () => Promise<Track[]>, query: string): Promise<SearchResult> {
  try {
    return { tracks: await request(), mocked: false };
  } catch (error) {
    // Provider failures are isolated so one unavailable service won't block the others.
    console.warn(`[search] ${provider} provider unavailable; using demo catalog.`, error instanceof Error ? error.message : 'Unknown error');
    return { tracks: mockResults(provider, query), mocked: true };
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();
  if (!query) return NextResponse.json({ error: 'A non-empty q query parameter is required.' }, { status: 400 });
  if (query.length > 200) return NextResponse.json({ error: 'Search query must be 200 characters or fewer.' }, { status: 400 });

  const [spotify, apple, youtube] = await Promise.all([
    withMockFallback('spotify', () => spotifySearch(query), query),
    withMockFallback('apple', () => appleSearch(query), query),
    withMockFallback('youtube', () => youtubeSearch(query), query),
  ]);
  const results: ProviderResults = { spotify: spotify.tracks, apple: apple.tracks, youtube: youtube.tracks };
  const mockedProviders = (['spotify', 'apple', 'youtube'] as const).filter((provider) => ({ spotify, apple, youtube })[provider].mocked);
  return NextResponse.json({ tracks: [...results.spotify, ...results.apple, ...results.youtube], mockedProviders, query }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
