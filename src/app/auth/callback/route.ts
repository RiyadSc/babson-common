import { NextRequest, NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env';
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const requested = req.nextUrl.searchParams.get('next') || '/app';
  const destination = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/app';
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${appUrl()}${destination}`);
  }
  return NextResponse.redirect(`${appUrl()}/login?auth_error=1`);
}
