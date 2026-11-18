import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { notify, requireAdmin, supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const db = supabase(auth.token);
  const { data, error } = await db.from('opportunity_applications')
    .select('*,opportunities(title,kind,department),application_status_history(id,previous_status,new_status,changed_at)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = Array.from(new Set((data || []).map((row) => row.applicant_id).filter((id): id is string => typeof id === 'string')));
  const { data: profiles } = ids.length
    ? await db.from('profiles').select('id,full_name,phone,education,skills,experience,linkedin_url,github_url,portfolio_url').in('id', ids)
    : { data: [] };
  const emails: Record<string, string> = {};
  if (hasServerSupabaseConfig()) {
    const admin = supabaseAdmin();
    await Promise.all(ids.map(async (id) => {
      const { data: result } = await admin.auth.admin.getUserById(id);
      if (result.user?.email) emails[id] = result.user.email;
    }));
  }
  const mapped = (data || []).map((row) => ({
    ...row,
    email: (row.applicant_id ? emails[row.applicant_id] : null) || row.applicant_email || null,
    profiles: (profiles || []).find((profile) => profile.id === row.applicant_id) || null,
  }));
  return NextResponse.json({ data: mapped });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const { id, status, internal_notes } = await request.json();
    const validStatuses = ['submitted','under_review','shortlisted','assessment','interview','selected','onboarding','in_progress','completed','rejected','withdrawn'];
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid application update.' }, { status: 400 });
    }
    const updates: Record<string, unknown> = { status, status_updated_at: new Date().toISOString() };
    if (typeof internal_notes === 'string') updates.internal_notes = internal_notes.slice(0, 5000);
    const { error } = await supabase(auth.token).from('opportunity_applications').update(updates).eq('id', id);
    if (error) throw error;
    await notify('RILORA application status updated', `<p>An administrator updated application <strong>${escapeHtml(id)}</strong> to <strong>${escapeHtml(status)}</strong>.</p>`);
    // Candidate selection/rejection messages are only sent by the explicit admin email action.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unable to update the application status.' }, { status: 400 });
  }
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
