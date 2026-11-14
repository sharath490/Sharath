import { createSign } from 'node:crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function createDeveloperToken() {
  const teamId = process.env.APPLE_MUSIC_TEAM_ID;
  const keyId = process.env.APPLE_MUSIC_KEY_ID;
  const privateKey = process.env.APPLE_MUSIC_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!teamId || !keyId || !privateKey) return null;

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: issuedAt, exp: issuedAt + 1800 })).toString('base64url');
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign('SHA256');
  signer.update(unsignedToken);
  signer.end();
  return `${unsignedToken}.${signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

export async function GET() {
  try {
    const token = createDeveloperToken();
    if (!token) return NextResponse.json({ error: 'Apple Music token is not configured.' }, { status: 503 });
    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not create Apple Music developer token.' }, { status: 500 });
  }
}
