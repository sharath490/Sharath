import { NextRequest, NextResponse } from 'next/server';

const LRCLIB_API = 'https://lrclib.net/api';

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title')?.trim();
  const artist = request.nextUrl.searchParams.get('artist')?.trim();
  const rawDuration = Number(request.nextUrl.searchParams.get('duration'));
  if (!title || !artist || title.length > 200 || artist.length > 200) {
    return NextResponse.json({ error: 'Track title and artist (up to 200 characters each) are required.' }, { status: 400 });
  }
  const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(Math.round(rawDuration), 86_400) : undefined;
  const params = new URLSearchParams({ track_name: title, artist_name: artist });
  if (duration) params.set('duration', String(duration));

  try {
    const response = await fetch(`${LRCLIB_API}/get?${params}`, {
      headers: { 'User-Agent': 'SonderMusic/1.0 (lyrics lookup)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });
    if (response.status === 404) return NextResponse.json({ syncedLyrics: null, plainLyrics: null }, { headers: { 'Cache-Control': 'no-store' } });
    if (!response.ok) return NextResponse.json({ error: 'Lyrics service is temporarily unavailable.' }, { status: 502 });
    const data = await response.json() as { syncedLyrics?: string | null; plainLyrics?: string | null };
    return NextResponse.json({ syncedLyrics: data.syncedLyrics ?? null, plainLyrics: data.plainLyrics ?? null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not reach the lyrics service.' }, { status: 502 });
  }
}
