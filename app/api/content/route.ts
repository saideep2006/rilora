import { NextResponse } from 'next/server';
import { currentUser, requireAdmin, supabase, supabaseConfigured } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ data: {}, records: [], configured: false });
  try {
    const auth = await currentUser(request);
    const isAdmin = auth.user ? (await requireAdmin(request)).authorized : false;
    let query = supabase(auth.token || undefined).from('site_content').select('content_key,content_value,is_public');
    if (!isAdmin) query = query.eq('is_public', true);
    const { data, error } = await query;
    if (error) throw error;
    const records = data || [];
    return NextResponse.json({
      data: Object.fromEntries(records.map(row => [row.content_key, row.content_value])),
      records: isAdmin ? records : undefined,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load content.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const { content_key, content_value, is_public } = await request.json();
    if (typeof content_key !== 'string' || !/^[a-z0-9_-]{2,80}$/.test(content_key) || typeof content_value !== 'string' || content_value.length > 5000 || (is_public !== undefined && typeof is_public !== 'boolean')) {
      return NextResponse.json({ error: 'Invalid content key, visibility or value.' }, { status: 400 });
    }
    const { error } = await supabase(auth.token).from('site_content').upsert({ content_key, content_value, is_public: is_public === true, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to save website content.' }, { status: 400 });
  }
}
