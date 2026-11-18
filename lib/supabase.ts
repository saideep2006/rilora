import { createClient } from '@supabase/supabase-js';
import { hasPublicSupabaseConfig, hasServerSupabaseConfig } from '@/lib/public-config';

export function supabaseConfigured() {
  return hasPublicSupabaseConfig();
}

export function supabase(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !hasPublicSupabaseConfig()) throw new Error('Supabase is not connected. Add your real project URL and publishable key to .env.local, then restart the app.');
  return createClient(url, key, token ? { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } } : {});
}

export function supabaseAdmin() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key||!hasServerSupabaseConfig())throw new Error('Add real Supabase project keys to .env.local before using server-side admin access.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

export async function currentUser(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('rilora-admin-session='))?.slice('rilora-admin-session='.length);
  const token = bearer || cookie || '';
  if (!token) return { token: '', user: null };
  const client = supabase(token);
  const { data, error } = await client.auth.getUser(token);
  return { token, user: error ? null : data.user };
}

export async function requireAdmin(request: Request) {
  const session = await currentUser(request);
  if (!session.user) return { ...session, authorized: false };
  const client = supabase(session.token);
  const { data } = await client.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
  return { ...session, authorized: data?.role === 'admin' };
}

export type EmailResult = { configured: boolean; sent: boolean; providerId?: string };

export async function sendEmail(recipient: string, subject: string, html: string, attachments?: Array<{ filename: string; content: string }>): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { configured: false, sent: false };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipient], subject, html, ...(attachments?.length ? { attachments } : {}) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { console.error('Email delivery failed:', response.status); return { configured: true, sent: false }; }
    return { configured: true, sent: true, providerId: typeof payload.id === 'string' ? payload.id : undefined };
  } catch { return { configured: true, sent: false }; }
}

export async function recordApplicationEmail(input: { applicationId?: string | null; recipient: string; emailType: string; subject: string; result: EmailResult; createdBy?: string | null }) {
  if (!hasServerSupabaseConfig()) return;
  const { error } = await supabaseAdmin().from('application_email_history').insert({
    application_id: input.applicationId || null,
    recipient_email: input.recipient,
    email_type: input.emailType,
    subject: input.subject,
    delivery_status: input.result.sent ? 'sent' : input.result.configured ? 'failed' : 'not_configured',
    provider_message_id: input.result.providerId || null,
    created_by: input.createdBy || null,
    sent_at: input.result.sent ? new Date().toISOString() : null,
  });
  if (error) console.error('Email history could not be recorded:', error.code);
}

export async function notify(subject: string, html: string, attachments?: Array<{ filename: string; content: string }>, recipient = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.NOTIFICATION_EMAIL || 'rilora.official@gmail.com'): Promise<boolean> {
  return (await sendEmail(recipient, subject, html, attachments)).sent;
}
