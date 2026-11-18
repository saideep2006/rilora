import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { requireAdmin, supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const { data, error } = await supabase(auth.token)
    .from('career_interest_submissions')
    .select('id,full_name,email,role_title,status,created_at,resume_path')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load career interest submissions.' }, { status: 503 });
  return NextResponse.json({ data: data || [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const { id, status } = await request.json();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !['new', 'reviewed', 'contacted', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid career interest update.' }, { status: 400 });
    }
    const { error } = await supabase(auth.token)
      .from('career_interest_submissions')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not update the career interest status.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  if (!hasServerSupabaseConfig()) return NextResponse.json({ error: 'Resume storage is not connected.' }, { status: 503 });
  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid submission ID.' }, { status: 400 });
    const { data: record, error: recordError } = await supabase(auth.token)
      .from('career_interest_submissions')
      .select('resume_path')
      .eq('id', id)
      .single();
    if (recordError || !record?.resume_path) return NextResponse.json({ error: 'Resume is unavailable.' }, { status: 404 });
    const { data, error } = await supabaseAdmin().storage.from('candidate-resumes').createSignedUrl(record.resume_path, 60);
    if (error) throw error;
    return NextResponse.json({ url: data.signedUrl });
  } catch {
    return NextResponse.json({ error: 'Could not prepare the private resume link.' }, { status: 503 });
  }
}
