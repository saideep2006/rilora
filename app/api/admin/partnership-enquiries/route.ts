import { NextResponse } from 'next/server';
import { requireAdmin, supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const { data, error } = await supabase(auth.token).from('service_enquiries')
    .select('id,enquiry_id,partnership_id,name,organisation,email,phone,service_required,project_description,partnership_status,internal_notes,created_at,read_at')
    .eq('category', 'partnership').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load partnership enquiries. Apply migration 202611180008.' }, { status: 503 });
  return NextResponse.json({ data: data || [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({ error: 'Invalid partnership enquiry reference.' }, { status: 400 });
    if (!['pending', 'under_review', 'approved', 'active', 'rejected'].includes(body.status)) return NextResponse.json({ error: 'Choose a valid partnership status.' }, { status: 400 });
    const notes = body.internal_notes === undefined ? null : typeof body.internal_notes === 'string' ? body.internal_notes.trim() : '';
    if (notes !== null && notes.length > 5000) return NextResponse.json({ error: 'Internal notes must be 5,000 characters or fewer.' }, { status: 400 });
    const { error } = await supabase(auth.token).rpc('admin_update_partnership_enquiry', {
      p_enquiry_id: body.id, p_status: body.status, p_internal_notes: notes,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, status: body.status });
  } catch (error) {
    console.error('Partnership enquiry update failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Unable to update the partnership enquiry.' }, { status: 503 });
  }
}
