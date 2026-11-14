import { NextRequest, NextResponse } from 'next/server';
import { appOrigin, readProviderSession, setProviderSession } from '@/lib/auth/provider-session';

export const runtime = 'nodejs';

function randomState() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
}

function pkceVerifier() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString('base64url');
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 };
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'spotify' && provider !== 'youtube') {
    return NextResponse.json({ error: 'Supported OAuth providers are spotify and youtube.' }, { status: 404 });
  }
  const clientId = provider === 'spotify' ? process.env.SPOTIFY_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: `${provider} OAuth is not configured.` }, { status: 503 });

  const state = randomState();
  const verifier = pkceVerifier();
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  const callback = `${appOrigin(request)}/api/auth/${provider}/callback`;
  const authorizeUrl = provider === 'spotify'
    ? new URL('https://accounts.spotify.com/authorize')
    : new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: callback,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (provider === 'spotify') {
    params.set('scope', 'user-read-private user-read-email playlist-read-private playlist-read-collaborative streaming user-read-playback-state user-modify-playback-state');
  } else {
    params.set('scope', 'openid email profile https://www.googleapis.com/auth/youtube.readonly');
    params.set('access_type', 'offline');
    params.set('include_granted_scopes', 'true');
    params.set('prompt', 'consent');
  }
  authorizeUrl.search = params.toString();

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(`oauth_state_${provider}`, state, cookieOptions());
  response.cookies.set(`oauth_verifier_${provider}`, verifier, cookieOptions());
  return response;
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'spotify' && provider !== 'youtube' && provider !== 'apple') {
    return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 });
  }
  const session = readProviderSession(request);
  delete session[provider];
  try {
    const response = NextResponse.json({ ok: true });
    setProviderSession(response, session);
    return response;
  } catch {
    return NextResponse.json({ error: 'Session encryption is not configured.' }, { status: 503 });
  }
}
