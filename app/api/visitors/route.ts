import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET() {
  if (!hasServerSupabaseConfig()) return NextResponse.json({ configured: false, data: null });
  try {
    const { data, error } = await supabaseAdmin().rpc('get_public_site_visit_stats');
    if (error) throw error;
    return NextResponse.json({ configured: true, trackingEnabled: Boolean(process.env.VISITOR_HASH_SECRET && process.env.VISITOR_HASH_SECRET.length >= 32), data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ configured: false, data: null }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!hasServerSupabaseConfig()) return NextResponse.json({ configured: false, data: null });
  const secret = process.env.VISITOR_HASH_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'Visitor analytics are not configured.' }, { status: 503 });
  if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Invalid analytics origin.' }, { status: 403 });
  try {
    const origin = request.headers.get('origin');
    const allowed = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin : new URL(request.url).origin;
    if (origin && origin !== allowed) return NextResponse.json({ error: 'Invalid analytics origin.' }, { status: 403 });
  } catch { return NextResponse.json({ error: 'Invalid analytics origin.' }, { status: 403 }); }
  try {
    const body = await request.json();
    const { visitorId, sessionId, eventId } = body;
    if (![visitorId, sessionId, eventId].every(value => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value))) return NextResponse.json({ error: 'Invalid analytics event.' }, { status: 400 });
    if (typeof body.pagePath !== 'string' || body.pagePath.length > 200 || !/^\/(?!\/)[^?#]*$/.test(body.pagePath) || body.pagePath.startsWith('/admin')) return NextResponse.json({ error: 'Invalid page path.' }, { status: 400 });
    const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const visitorHash = hash(visitorId);
    const sessionHash = hash(sessionId);
    const client = supabaseAdmin();
    const { data: result, error: recordError } = await client.rpc('record_website_page_view', {
      p_event_id: eventId, p_visitor_hash: visitorHash, p_session_hash: sessionHash, p_page_path: body.pagePath,
    });
    if (recordError) throw recordError;
    if (result === 'limited') return NextResponse.json({ error: 'Analytics event limit reached.' }, { status: 429 });
    return NextResponse.json({ configured: true, recorded: result === 'recorded' });
  } catch {
    return NextResponse.json({ error: 'Unable to record this page view.' }, { status: 503 });
  }
}
