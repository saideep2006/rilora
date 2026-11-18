import { NextResponse } from 'next/server';
import { requireAdmin, supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const { data, error } = await supabase(auth.token).from('service_enquiries').select('*').order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: 'Could not load enquiries. Apply the latest database migration.' }, { status: 503 });
  return NextResponse.json({ data: data || [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const { id, status, internal_notes, read } = await request.json();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid enquiry reference.' }, { status: 400 });
    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!['new', 'in_progress', 'resolved'].includes(status)) return NextResponse.json({ error: 'Choose a valid enquiry status.' }, { status: 400 });
      updates.status = status;
    }
    if (read !== undefined) {
      if (typeof read !== 'boolean') return NextResponse.json({ error: 'Read status must be true or false.' }, { status: 400 });
      updates.read_at = read ? new Date().toISOString() : null;
    }
    if (internal_notes !== undefined) {
      if (typeof internal_notes !== 'string' || internal_notes.length > 5000) return NextResponse.json({ error: 'Internal notes must be 5,000 characters or fewer.' }, { status: 400 });
      updates.internal_notes = internal_notes;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'No enquiry changes supplied.' }, { status: 400 });
    const { error } = await supabase(auth.token).from('service_enquiries').update(updates).eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not update the enquiry.' }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const { id } = await request.json();
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid enquiry reference.' }, { status: 400 });
    const { error } = await supabase(auth.token).from('service_enquiries').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not delete the enquiry.' }, { status: 503 });
  }
}
