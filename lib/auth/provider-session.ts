import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'sonder_provider_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userToken?: string;
}

export interface ProviderSession {
  spotify?: ProviderTokens;
  youtube?: ProviderTokens;
  apple?: ProviderTokens;
}

function encryptionKey() {
  const secret = process.env.SESSION_ENCRYPTION_KEY;
  if (!secret) throw new Error('SESSION_ENCRYPTION_KEY is required to store provider sessions.');
  return createHash('sha256').update(secret).digest();
}

export function readProviderSession(request: NextRequest): ProviderSession {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  if (!value) return {};
  try {
    const [ivText, tagText, encryptedText] = value.split('.');
    if (!ivText || !tagText || !encryptedText) return {};
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext) as ProviderSession;
  } catch {
    return {};
  }
}

export function setProviderSession(response: NextResponse, session: ProviderSession) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  const value = `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  response.cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearProviderSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function appOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || request.nextUrl.origin;
}
