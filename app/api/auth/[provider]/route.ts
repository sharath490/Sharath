import { NextResponse } from 'next/server';

// Provider OAuth exchanges belong on the server. Add provider-specific token
// exchange logic here; never return client secrets or access tokens to the browser.
export async function POST() {
  return NextResponse.json(
    { error: 'Provider authorization is not configured yet.' },
    { status: 501 },
  );
}
