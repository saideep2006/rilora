import { NextResponse } from 'next/server';
import { hasServerSupabaseConfig } from '@/lib/public-config';
import { recordApplicationEmail, requireAdmin, sendEmail, supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  const db = supabase(auth.token);
  const { data, error } = await db.from('application_email_history')
    .select('id,application_id,recipient_email,email_type,subject,delivery_status,provider_message_id,created_at,sent_at')
    .order('created_at', { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: 'Could not load email history. Apply the latest database migrations.' }, { status: 503 });
  const [sent, failed] = await Promise.all([
    db.from('application_email_history').select('id', { count: 'exact', head: true }).eq('delivery_status', 'sent'),
    db.from('application_email_history').select('id', { count: 'exact', head: true }).eq('delivery_status', 'failed'),
  ]);
  return NextResponse.json({
    configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    serverStorageConfigured: hasServerSupabaseConfig(),
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || 'rilora.official@gmail.com',
    totals: { sent: sent.count || 0, failed: failed.count || 0 },
    data: data || [],
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.authorized) return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
  try {
    const body = await request.json();
    if (body.action !== 'test') return NextResponse.json({ error: 'Unsupported email action.' }, { status: 400 });
    const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_EMAIL || 'rilora.official@gmail.com';
    const subject = 'RILORA email configuration test';
    const result = await sendEmail(recipient, subject, '<p>This is a test email from the protected RILORA Admin Dashboard.</p><p>If this arrived, outgoing email is configured.</p>');
    await recordApplicationEmail({ recipient, emailType: 'test', subject, result, createdBy: auth.user?.id });
    if (!result.configured) return NextResponse.json({ error: 'Email provider is not configured.', configured: false }, { status: 503 });
    if (!result.sent) return NextResponse.json({ error: 'The email provider did not confirm delivery. Review provider settings and email history.', configured: true }, { status: 502 });
    return NextResponse.json({ ok: true, sent: true });
  } catch {
    return NextResponse.json({ error: 'Could not run the email test.' }, { status: 503 });
  }
}
