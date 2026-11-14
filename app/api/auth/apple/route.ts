import { NextRequest, NextResponse } from 'next/server';
import { readProviderSession, setProviderSession } from '@/lib/auth/provider-session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { musicUserToken?: string };
  try { body = await request.json() as { musicUserToken?: string }; }
  catch { return NextResponse.json({ error: 'Expected a MusicKit user token.' }, { status: 400 }); }
  if (!body.musicUserToken || body.musicUserToken.length > 4096) {
    return NextResponse.json({ error: 'A valid MusicKit user token is required.' }, { status: 400 });
  }
  try {
    const session = readProviderSession(request);
    session.apple = { accessToken: '', userToken: body.musicUserToken, expiresAt: 0 };
    const response = NextResponse.json({ ok: true });
    setProviderSession(response, session);
    return response;
  } catch {
    return NextResponse.json({ error: 'Session encryption is not configured.' }, { status: 503 });
  }
}
