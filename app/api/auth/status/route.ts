import { NextRequest, NextResponse } from 'next/server';
import { readProviderSession } from '@/lib/auth/provider-session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = readProviderSession(request);
  return NextResponse.json({
    spotify: { connected: Boolean(session.spotify?.accessToken), expiresAt: session.spotify?.expiresAt ?? null },
    youtube: { connected: Boolean(session.youtube?.accessToken), expiresAt: session.youtube?.expiresAt ?? null },
    apple: { connected: Boolean(session.apple?.userToken), expiresAt: null },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
