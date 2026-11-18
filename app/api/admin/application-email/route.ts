import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { recordApplicationEmail, requireAdmin, sendEmail, supabase, supabaseAdmin } from '@/lib/supabase';

const allowedTypes = ['general', 'shortlist', 'interview', 'selection', 'rejection'] as const;
const requiredStatus: Partial<Record<(typeof allowedTypes)[number], string>> = {
  shortlist: 'shortlisted', interview: 'interview', selection: 'selected', rejection: 'rejected',
};

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  if (!hasServerSupabaseConfig()) return NextResponse.json({ error: 'Configure the server-only Supabase service role key before sending applicant email.' }, { status: 503 });
  try {
    const body = await request.json();
    const type = body.email_type as (typeof allowedTypes)[number];
    if (typeof body.application_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.application_id) || !allowedTypes.includes(type)) {
      return NextResponse.json({ error: 'Choose an application and a supported email type.' }, { status: 400 });
    }
    if (typeof body.subject !== 'string' || !body.subject.trim() || body.subject.length > 200 || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 5000) {
      return NextResponse.json({ error: 'Enter a subject and a message of at most 5,000 characters.' }, { status: 400 });
    }

    const db = supabase(auth.token);
    const { data: application, error } = await db.from('opportunity_applications')
      .select('id,status,applicant_id,applicant_email,applicant_full_name,opportunities(title)')
      .eq('id', body.application_id)
      .single();
    if (error) throw error;
    if (requiredStatus[type] && application.status !== requiredStatus[type]) {
      return NextResponse.json({ error: `Change the application status to ${requiredStatus[type]} before sending this email.` }, { status: 409 });
    }

    let applicantEmail = application.applicant_email as string | null;
    let applicantName = String(application.applicant_full_name || 'Candidate');
    if (application.applicant_id) {
      const admin = supabaseAdmin();
      const { data: userResult, error: userError } = await admin.auth.admin.getUserById(application.applicant_id);
      if (userError || !userResult.user?.email) return NextResponse.json({ error: 'Applicant email is unavailable.' }, { status: 404 });
      applicantEmail = userResult.user.email;
      applicantName = String(userResult.user.user_metadata?.full_name || applicantName || userResult.user.email);
    }
    const recipient = typeof body.recipient === 'string' ? body.recipient.trim().toLowerCase() : applicantEmail;
    if (!recipient || recipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return NextResponse.json({ error: 'Enter a valid recipient email.' }, { status: 400 });
    const opportunity = Array.isArray(application.opportunities) ? application.opportunities[0] : application.opportunities;
    const html = `<p>Dear ${escapeHtml(applicantName)},</p><div style="white-space:pre-wrap">${escapeHtml(body.message.trim())}</div><p>Position: ${escapeHtml(opportunity?.title || 'RILORA opportunity')}</p><p>Application reference: ${escapeHtml(application.id)}</p><p>Regards,<br/>RILORA Recruitment Team</p>`;
    const result = await sendEmail(recipient, body.subject.trim(), html);
    await recordApplicationEmail({
      applicationId: application.id,
      recipient,
      emailType: type,
      subject: body.subject.trim(),
      result,
      createdBy: auth.user?.id,
    });
    return NextResponse.json({ ok: result.sent, configured: result.configured, sent: result.sent, error: result.configured && !result.sent ? 'The provider did not confirm delivery. Check email logs and provider configuration.' : undefined });
  } catch (error) {
    console.error('Manual application email failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Could not send this applicant email.' }, { status: 503 });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}
