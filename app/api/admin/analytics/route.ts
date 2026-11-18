import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { requireAdmin, supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

function indiaDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  if (!hasServerSupabaseConfig()) return NextResponse.json({ error: 'Set the server-only Supabase service key to enable analytics.' }, { status: 503 });
  const url = new URL(request.url);
  const today = indiaDate(new Date());
  const startDefault = new Date(`${today}T00:00:00Z`);
  startDefault.setUTCDate(startDefault.getUTCDate() - 29);
  const from = url.searchParams.get('from') || startDefault.toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || today;
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (!validDate(from) || !validDate(to) || days < 0 || days > 365 || Date.parse(`${to}T00:00:00Z`) > Date.parse(`${today}T00:00:00Z`)) return NextResponse.json({ error: 'Choose a valid date range of up to 366 days ending today or earlier.' }, { status: 400 });
  try {
    const { data, error } = await supabaseAdmin().rpc('get_site_analytics', { p_from: from, p_to: to });
    if (error) throw error;
    return NextResponse.json({ data, from, to }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Analytics are unavailable. Apply migration 202611180008 and verify Supabase configuration.' }, { status: 503 });
  }
}
