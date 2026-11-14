import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { appOrigin, readProviderSession, setProviderSession, type ProviderTokens } from '@/lib/auth/provider-session';

export const runtime = 'nodejs';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'spotify' && provider !== 'youtube') return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });

  const code = request.nextUrl.searchParams.get('code');
  const returnedState = request.nextUrl.searchParams.get('state') ?? '';
  const expectedState = request.cookies.get(`oauth_state_${provider}`)?.value ?? '';
  const verifier = request.cookies.get(`oauth_verifier_${provider}`)?.value;
  const error = request.nextUrl.searchParams.get('error');
  const redirect = (result: string) => NextResponse.redirect(new URL(`/settings?connection=${result}`, appOrigin(request)));

  if (error || !code || !expectedState || !safeEqual(returnedState, expectedState) || !verifier) return redirect('failed');

  const clientId = provider === 'spotify' ? process.env.SPOTIFY_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  const clientSecret = provider === 'spotify' ? process.env.SPOTIFY_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return redirect('failed');

  try {
    const callback = `${appOrigin(request)}/api/auth/${provider}/callback`;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callback,
      client_id: clientId,
      code_verifier: verifier,
    });
    if (provider === 'spotify') body.set('client_secret', clientSecret);
    const tokenResponse = await fetch(provider === 'spotify' ? 'https://accounts.spotify.com/api/token' : 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    });
    if (!tokenResponse.ok) return redirect('failed');
    const data = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    const tokens: ProviderTokens = {
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    const session = readProviderSession(request);
    session[provider] = tokens;
    const response = redirect('connected');
    setProviderSession(response, session);
    response.cookies.delete(`oauth_state_${provider}`);
    response.cookies.delete(`oauth_verifier_${provider}`);
    return response;
  } catch {
    return redirect('failed');
  }
}
